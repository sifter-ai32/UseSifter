// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {
    Phase,
    PhaseStatus,
    Escrow,
    EscrowStatus,
    BPS_DENOMINATOR,
    MAX_FEE_BPS,
    PhaseAmountZero,
    InvalidShareBps
} from "./EscrowTypes.sol";

// ===========================================================
//  EscrowLogic — internal pure/view helpers inlined at compile
// ===========================================================

library EscrowLogic {

    // ───────── Phase-amount & fee calculation at creation ─────────

    /// @notice Compute each phase's `amount` and `clientFee` from the total
    ///         work value and percentage splits.  Remainder dust is added to
    ///         the last phase so invariants INV-2 and INV-3 hold exactly.
    /// @param totalAmount   Total agreed work value (excl. client fee).
    /// @param halfFeeBps    Half of platformFeeBps (client's portion in bps).
    /// @param percentages   Array of per-phase percentage in bps (must sum to 10 000).
    /// @param phases        Storage array to write into (must already be pushed).
    /// @return totalClientFee  Sum of all phase clientFees (== deposit - totalAmount).
    function computePhaseAmountsAndFees(
        uint256 totalAmount,
        uint16  halfFeeBps,
        uint16[] calldata percentages,
        Phase[] storage phases
    ) internal returns (uint256 totalClientFee) {
        uint256 len = percentages.length;

        // --- amounts ---
        uint256 amountSum;
        for (uint256 i; i < len; ++i) {
            uint256 amt = (totalAmount * percentages[i]) / BPS_DENOMINATOR;
            // casting to 'uint8' is safe because MAX_PHASES = 20
            // forge-lint: disable-next-line(unsafe-typecast)
            if (amt == 0) revert PhaseAmountZero(uint8(i));
            phases[i].amount = amt;
            amountSum += amt;
        }
        // dust to last phase
        if (amountSum < totalAmount) {
            phases[len - 1].amount += totalAmount - amountSum;
        }

        // --- client fees ---
        totalClientFee = (totalAmount * halfFeeBps) / BPS_DENOMINATOR;
        uint256 feeSum;
        for (uint256 i; i < len; ++i) {
            uint256 fee = (phases[i].amount * halfFeeBps) / BPS_DENOMINATOR;
            phases[i].clientFee = fee;
            feeSum += fee;
        }
        // dust to last phase
        if (feeSum < totalClientFee) {
            phases[len - 1].clientFee += totalClientFee - feeSum;
        }
    }

    // ───────── Release helpers ─────────

    /// @notice Calculate freelancer net payout and total platform fee for a phase.
    /// @return freelancerNet  Amount transferred to freelancer.
    /// @return totalPhaseFee  Amount transferred to feeRecipient.
    function computeRelease(Phase storage phase, uint16 feeBps)
        internal
        view
        returns (uint256 freelancerNet, uint256 totalPhaseFee)
    {
        uint16 halfFeeBps = feeBps / 2;
        uint256 freelancerFee = (phase.amount * halfFeeBps) / BPS_DENOMINATOR;
        freelancerNet  = phase.amount - freelancerFee;
        totalPhaseFee  = phase.clientFee + freelancerFee;
    }

    // ───────── Dispute-resolution split ─────────

    /// @notice Compute amounts for an arbitrary freelancer/client split decided
    ///         by the arbitrator.  Fee is charged only on the freelancer's
    ///         portion; the client receives a proportional refund of their fee.
    /// @param phase              The disputed phase.
    /// @param feeBps             Escrow-snapshotted platform fee.
    /// @param freelancerShareBps 0–10 000 bps indicating freelancer's share.
    /// @return freelancerNet     Payout to freelancer (after fee deduction).
    /// @return clientRefund      Refund to client (incl. proportional clientFee).
    /// @return platformFee       Fee sent to feeRecipient.
    function computeDisputeSplit(
        Phase storage phase,
        uint16 feeBps,
        uint16 freelancerShareBps
    )
        internal
        view
        returns (uint256 freelancerNet, uint256 clientRefund, uint256 platformFee)
    {
        if (freelancerShareBps > BPS_DENOMINATOR) revert InvalidShareBps();

        uint16 halfFeeBps = feeBps / 2;

        // Freelancer's gross share of the work value
        uint256 freelancerGross = (phase.amount * freelancerShareBps) / BPS_DENOMINATOR;
        // Client's gross share of the work value
        uint256 clientGross = phase.amount - freelancerGross;

        // Fee only on freelancer's portion
        uint256 freelancerFee = (freelancerGross * halfFeeBps) / BPS_DENOMINATOR;
        freelancerNet = freelancerGross - freelancerFee;

        // Proportional refund of client's fee
        uint256 clientFeeRefund = (phase.clientFee * (BPS_DENOMINATOR - freelancerShareBps)) / BPS_DENOMINATOR;
        uint256 clientFeeCharged = phase.clientFee - clientFeeRefund;

        clientRefund = clientGross + clientFeeRefund;
        platformFee  = clientFeeCharged + freelancerFee;
    }

    // ───────── Remaining-balance helpers ─────────

    /// @notice Compute total remaining balance held in the contract for an
    ///         escrow (deposit minus everything already distributed).
    function remainingBalance(Escrow storage e) internal view returns (uint256) {
        return e.totalDeposit - e.releasedAmount - e.releasedFees - e.refundedAmount;
    }

    /// @notice Sum the `amount + clientFee` of all phases from `startIndex` to
    ///         the end.  Used to compute refund on cancellation / deadline.
    function sumRemainingPhases(Phase[] storage phases, uint8 startIndex)
        internal
        view
        returns (uint256 total)
    {
        for (uint256 i = startIndex; i < phases.length; ++i) {
            if (phases[i].status == PhaseStatus.Pending || phases[i].status == PhaseStatus.Submitted) {
                total += phases[i].amount + phases[i].clientFee;
            }
        }
    }

    /// @notice Mark all phases from `startIndex` onward as Cancelled.
    function cancelRemainingPhases(Phase[] storage phases, uint8 startIndex) internal {
        for (uint256 i = startIndex; i < phases.length; ++i) {
            if (phases[i].status == PhaseStatus.Pending || phases[i].status == PhaseStatus.Submitted) {
                phases[i].status = PhaseStatus.Cancelled;
            }
        }
    }

    // ───────── Mutual-cancellation split ─────────

    /// @notice Compute the split for a mutual cancellation.  Fee is charged
    ///         only on the freelancer's agreed share of the remaining balance.
    /// @param remainingWorkValue  Sum of phase.amount for remaining phases.
    /// @param remainingClientFee  Sum of phase.clientFee for remaining phases.
    /// @param feeBps              Escrow-snapshotted fee.
    /// @param freelancerShareBps  Agreed split (0–10 000).
    function computeMutualSplit(
        uint256 remainingWorkValue,
        uint256 remainingClientFee,
        uint16  feeBps,
        uint16  freelancerShareBps
    )
        internal
        pure
        returns (uint256 freelancerNet, uint256 clientRefund, uint256 platformFee)
    {
        if (freelancerShareBps > BPS_DENOMINATOR) revert InvalidShareBps();

        uint16 halfFeeBps = feeBps / 2;

        uint256 freelancerGross = (remainingWorkValue * freelancerShareBps) / BPS_DENOMINATOR;
        uint256 clientGross     = remainingWorkValue - freelancerGross;

        uint256 freelancerFee  = (freelancerGross * halfFeeBps) / BPS_DENOMINATOR;
        freelancerNet = freelancerGross - freelancerFee;

        uint256 clientFeeRefund  = (remainingClientFee * (BPS_DENOMINATOR - freelancerShareBps)) / BPS_DENOMINATOR;
        uint256 clientFeeCharged = remainingClientFee - clientFeeRefund;

        clientRefund = clientGross + clientFeeRefund;
        platformFee  = clientFeeCharged + freelancerFee;
    }
}
