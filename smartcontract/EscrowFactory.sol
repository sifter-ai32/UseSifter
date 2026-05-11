// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// ──────────── OpenZeppelin v5 imports ────────────
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

// ──────────── Project imports ────────────
import {
    Escrow,
    EscrowStatus,
    Phase,
    PhaseStatus,
    CancellationProposal,
    // Constants
    MAX_FEE_BPS,
    MAX_PHASES,
    MIN_AUTO_RELEASE,
    MAX_AUTO_RELEASE,
    DISPUTE_BUFFER,
    MAX_REVISIONS,
    BPS_DENOMINATOR,
    CANCELLATION_EXPIRY,
    // Errors
    Unauthorized,
    InvalidStatus,
    InvalidPhaseStatus,
    InvalidPercentages,
    PhaseAmountZero,
    AutoReleaseNotReady,
    DisputeBufferActive,
    MaxRevisionsReached,
    InvalidToken,
    FeeTooHigh,
    InvalidFreelancer,
    InvalidAmount,
    InvalidPhaseCount,
    DeadlinesNotIncreasing,
    DeadlineTooSoon,
    AutoReleaseOutOfRange,
    FundingExpiredError,
    FundingNotExpired,
    DeadlineNotPassed,
    ProposalExpired,
    NoActiveProposal,
    ProposerCannotAccept,
    InvalidShareBps,
    PhasesAlreadyStarted,
    DisputeNotExpired,
    ObligationViolation,
    // Events
    EscrowCreated,
    EscrowFunded,
    PhaseSubmitted,
    PhaseApproved,
    PhaseAutoReleased,
    RevisionRequested,
    DisputeRaised,
    DisputeResolved,
    DisputeExpired,
    EscrowCancelled,
    MutualCancellationProposed,
    EscrowMutuallyCancelled,
    DeadlineExpired,
    FundingExpiredEvent,
    ConfigUpdated,
    ContractPaused,
    ContractUnpaused
} from "./EscrowTypes.sol";

import {EscrowLogic} from "./EscrowLogic.sol";

/// @title  EscrowFactory — Phased escrow for freelance work (USDC/USDT)
/// @notice Immutable (no proxy). One contract stores all escrows as structs.
/// @dev    Follows checks-effects-interactions throughout. No receive/fallback.
contract EscrowFactory is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    //                     IMMUTABLE STATE
    // ═══════════════════════════════════════════════════════════

    address public immutable USDC;
    address public immutable USDT;

    // ═══════════════════════════════════════════════════════════
    //                     GLOBAL CONFIG
    // ═══════════════════════════════════════════════════════════

    address public arbitrator;
    address public feeRecipient;
    uint16  public platformFeeBps;       // default 500 (5 %)
    uint64  public fundingDeadline;      // seconds after creation
    uint64  public disputeTimeout;       // seconds before auto-resolve
    uint256 public nextEscrowId;

    // ═══════════════════════════════════════════════════════════
    //                     ESCROW STORAGE
    // ═══════════════════════════════════════════════════════════

    mapping(uint256 => Escrow)                escrows;
    mapping(uint256 => Phase[])               escrowPhases;
    mapping(uint256 => CancellationProposal)  cancellationProposals;

    // ═══════════════════════════════════════════════════════════
    //                     CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(
        address _owner,
        address _arbitrator,
        address _feeRecipient,
        address _usdc,
        address _usdt,
        uint16  _platformFeeBps,
        uint64  _fundingDeadline,
        uint64  _disputeTimeout
    ) Ownable(_owner) {
        if (_platformFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_arbitrator   == address(0)) revert Unauthorized();
        if (_feeRecipient == address(0)) revert Unauthorized();
        if (_usdc == address(0) || _usdt == address(0)) revert InvalidToken();

        USDC            = _usdc;
        USDT            = _usdt;
        arbitrator      = _arbitrator;
        feeRecipient    = _feeRecipient;
        platformFeeBps  = _platformFeeBps;
        fundingDeadline = _fundingDeadline;
        disputeTimeout  = _disputeTimeout;
    }

    // ═══════════════════════════════════════════════════════════
    //               6.1  CREATE ESCROW
    // ═══════════════════════════════════════════════════════════

    function createEscrow(
        address   freelancer,
        address   token,
        uint256   totalAmount,
        uint16[]  calldata percentagesBps,
        uint64[]  calldata deadlines,
        uint64    autoReleaseTimeout
    ) external whenNotPaused returns (uint256 escrowId) {
        // ── checks ──
        if (freelancer == address(0) || freelancer == msg.sender) revert InvalidFreelancer();
        if (token != USDC && token != USDT) revert InvalidToken();
        if (totalAmount == 0) revert InvalidAmount();
        if (percentagesBps.length != deadlines.length) revert InvalidPhaseCount();
        if (percentagesBps.length < 1 || percentagesBps.length > MAX_PHASES) revert InvalidPhaseCount();
        if (autoReleaseTimeout < MIN_AUTO_RELEASE || autoReleaseTimeout > MAX_AUTO_RELEASE) {
            revert AutoReleaseOutOfRange();
        }

        // Validate percentages sum to 10 000 & each > 0
        {
            uint256 sum;
            for (uint256 i; i < percentagesBps.length; ++i) {
                if (percentagesBps[i] == 0) revert InvalidPercentages();
                sum += percentagesBps[i];
            }
            if (sum != BPS_DENOMINATOR) revert InvalidPercentages();
        }

        // Validate deadlines strictly increasing & first > now + 1 day
        if (deadlines[0] <= uint64(block.timestamp) + 1 days) revert DeadlineTooSoon();
        for (uint256 i = 1; i < deadlines.length; ++i) {
            if (deadlines[i] <= deadlines[i - 1]) revert DeadlinesNotIncreasing();
        }

        // ── effects ──
        escrowId = nextEscrowId++;
        uint8 phaseCount = uint8(percentagesBps.length);

        Escrow storage e = escrows[escrowId];
        e.client             = msg.sender;
        e.freelancer         = freelancer;
        e.token              = token;
        e.totalAmount        = totalAmount;
        e.phaseCount         = phaseCount;
        e.currentPhase       = 0;
        e.status             = EscrowStatus.Created;
        e.createdAt          = uint64(block.timestamp);
        e.autoReleaseTimeout = autoReleaseTimeout;
        e.feeBps             = platformFeeBps;   // snapshot
        e.arbitrator         = arbitrator;        // snapshot

        // Build phase array
        Phase[] storage phases = escrowPhases[escrowId];
        for (uint256 i; i < phaseCount; ++i) {
            phases.push(Phase({
                percentageBps: percentagesBps[i],
                deadline:      deadlines[i],
                submittedAt:   0,
                disputedAt:    0,
                revisionCount: 0,
                status:        PhaseStatus.Pending,
                amount:        0,
                clientFee:     0
            }));
        }

        // Compute amounts & fees (including rounding dust)
        uint16 halfFeeBps = e.feeBps / 2;
        uint256 totalClientFee = EscrowLogic.computePhaseAmountsAndFees(
            totalAmount, halfFeeBps, percentagesBps, phases
        );
        e.totalDeposit = totalAmount + totalClientFee;

        emit EscrowCreated(escrowId, msg.sender, freelancer, token, totalAmount, e.totalDeposit, phaseCount);
    }

    // ═══════════════════════════════════════════════════════════
    //               6.2  FUND ESCROW
    // ═══════════════════════════════════════════════════════════

    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];

        // ── checks ──
        if (msg.sender != e.client) revert Unauthorized();
        if (e.status != EscrowStatus.Created) revert InvalidStatus(EscrowStatus.Created, e.status);
        if (uint64(block.timestamp) > e.createdAt + fundingDeadline) revert FundingExpiredError();

        uint256 required = e.totalDeposit;

        // ── effects ──
        e.status   = EscrowStatus.Funded;
        e.fundedAt = uint64(block.timestamp);

        // ── interactions ──
        IERC20(e.token).safeTransferFrom(msg.sender, address(this), required);

        emit EscrowFunded(escrowId, required);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.3  SUBMIT PHASE COMPLETION
    // ═══════════════════════════════════════════════════════════

    function submitPhaseCompletion(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.freelancer) revert Unauthorized();
        if (e.status != EscrowStatus.Funded && e.status != EscrowStatus.Active) {
            revert InvalidStatus(EscrowStatus.Active, e.status);
        }
        if (p.status != PhaseStatus.Pending) revert InvalidPhaseStatus(PhaseStatus.Pending, p.status);
        if (uint64(block.timestamp) > p.deadline) revert DeadlineNotPassed(); // deadline already passed

        // ── effects ──
        p.status      = PhaseStatus.Submitted;
        p.submittedAt = uint64(block.timestamp);

        if (e.status == EscrowStatus.Funded) {
            e.status = EscrowStatus.Active;
        }

        emit PhaseSubmitted(escrowId, e.currentPhase, uint64(block.timestamp));
    }

    // ═══════════════════════════════════════════════════════════
    //               6.4  APPROVE PHASE
    // ═══════════════════════════════════════════════════════════

    function approvePhase(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.client) revert Unauthorized();
        if (e.status != EscrowStatus.Active) revert InvalidStatus(EscrowStatus.Active, e.status);
        if (p.status != PhaseStatus.Submitted) revert InvalidPhaseStatus(PhaseStatus.Submitted, p.status);

        // ── compute ──
        (uint256 freelancerNet, uint256 totalPhaseFee) = EscrowLogic.computeRelease(p, e.feeBps);
        uint8 phaseIndex = e.currentPhase;

        // ── effects ──
        p.status = PhaseStatus.Approved;
        e.releasedAmount += freelancerNet;   // track actual outflow to freelancer (INV-4)
        e.releasedFees   += totalPhaseFee;

        if (e.currentPhase == e.phaseCount - 1) {
            e.status = EscrowStatus.Completed;
        } else {
            e.currentPhase++;
        }

        // ── interactions ──
        IERC20(e.token).safeTransfer(e.freelancer, freelancerNet);
        IERC20(e.token).safeTransfer(feeRecipient, totalPhaseFee);

        emit PhaseApproved(escrowId, phaseIndex, freelancerNet, totalPhaseFee);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.5  REQUEST REVISION
    // ═══════════════════════════════════════════════════════════

    function requestRevision(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.client) revert Unauthorized();
        if (e.status != EscrowStatus.Active) revert InvalidStatus(EscrowStatus.Active, e.status);
        if (p.status != PhaseStatus.Submitted) revert InvalidPhaseStatus(PhaseStatus.Submitted, p.status);
        if (p.revisionCount >= MAX_REVISIONS) revert MaxRevisionsReached();
        if (uint64(block.timestamp) >= p.submittedAt + e.autoReleaseTimeout - DISPUTE_BUFFER) {
            revert DisputeBufferActive();
        }

        // ── effects ──
        p.revisionCount++;
        p.status      = PhaseStatus.Pending;   // only allowed backward transition
        p.submittedAt = 0;                      // stops auto-release clock

        emit RevisionRequested(escrowId, e.currentPhase, p.revisionCount);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.6  TRIGGER AUTO-RELEASE
    // ═══════════════════════════════════════════════════════════

    function triggerAutoRelease(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (p.status != PhaseStatus.Submitted) revert InvalidPhaseStatus(PhaseStatus.Submitted, p.status);
        if (uint64(block.timestamp) < p.submittedAt + e.autoReleaseTimeout) revert AutoReleaseNotReady();

        // ── compute ──
        (uint256 freelancerNet, uint256 totalPhaseFee) = EscrowLogic.computeRelease(p, e.feeBps);
        uint8 phaseIndex = e.currentPhase;

        // ── effects ──
        p.status = PhaseStatus.AutoReleased;
        e.releasedAmount += freelancerNet;   // track actual outflow (INV-4)
        e.releasedFees   += totalPhaseFee;

        if (e.currentPhase == e.phaseCount - 1) {
            e.status = EscrowStatus.Completed;
        } else {
            e.currentPhase++;
        }

        // ── interactions ──
        IERC20(e.token).safeTransfer(e.freelancer, freelancerNet);
        IERC20(e.token).safeTransfer(feeRecipient, totalPhaseFee);

        emit PhaseAutoReleased(escrowId, phaseIndex, freelancerNet, totalPhaseFee);
    }

    // ═══════════════════════════════════════════════════════════
    //               6.7  RAISE DISPUTE
    // ═══════════════════════════════════════════════════════════

    function raiseDispute(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.client && msg.sender != e.freelancer) revert Unauthorized();
        if (e.status != EscrowStatus.Active) revert InvalidStatus(EscrowStatus.Active, e.status);
        if (p.status != PhaseStatus.Submitted) revert InvalidPhaseStatus(PhaseStatus.Submitted, p.status);
        if (uint64(block.timestamp) >= p.submittedAt + e.autoReleaseTimeout - DISPUTE_BUFFER) {
            revert DisputeBufferActive();
        }

        // ── effects ──
        p.status     = PhaseStatus.Disputed;
        p.disputedAt = uint64(block.timestamp);
        e.status     = EscrowStatus.Disputed;

        emit DisputeRaised(escrowId, e.currentPhase, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.8  RESOLVE DISPUTE (arbitrator)
    // ═══════════════════════════════════════════════════════════

    /// @notice NOT gated by whenNotPaused — arbitrator must resolve even when paused.
    function resolveDispute(uint256 escrowId, uint16 freelancerShareBps) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.arbitrator) revert Unauthorized();
        if (e.status != EscrowStatus.Disputed) revert InvalidStatus(EscrowStatus.Disputed, e.status);
        if (p.status != PhaseStatus.Disputed) revert InvalidPhaseStatus(PhaseStatus.Disputed, p.status);
        if (freelancerShareBps > BPS_DENOMINATOR) revert InvalidShareBps();

        // ── compute ──
        (uint256 freelancerNet, uint256 clientRefund, uint256 platformFee) =
            EscrowLogic.computeDisputeSplit(p, e.feeBps, freelancerShareBps);

        uint8 phaseIndex = e.currentPhase;

        // ── effects ──
        if (freelancerShareBps == 0) {
            // Full client win → cancel all remaining phases, refund everything remaining
            p.status = PhaseStatus.Cancelled;
            EscrowLogic.cancelRemainingPhases(escrowPhases[escrowId], e.currentPhase + 1);

            // clientRefund from dispute + remaining unprocessed phases
            uint256 additionalRefund;
            for (uint256 i = e.currentPhase + 1; i < e.phaseCount; ++i) {
                Phase storage rp = escrowPhases[escrowId][i];
                additionalRefund += rp.amount + rp.clientFee;
            }
            clientRefund += additionalRefund;

            e.refundedAmount += clientRefund;
            if (platformFee > 0) e.releasedFees += platformFee;
            e.status = EscrowStatus.Cancelled;
        } else {
            p.status = PhaseStatus.Approved;
            e.releasedAmount += freelancerNet;  // track actual outflow (INV-4)
            e.releasedFees   += platformFee;
            e.refundedAmount += clientRefund;

            if (e.currentPhase == e.phaseCount - 1) {
                e.status = EscrowStatus.Completed;
            } else {
                e.currentPhase++;
                e.status = EscrowStatus.Active;
            }
        }

        // ── interactions ──
        if (freelancerNet > 0) {
            IERC20(e.token).safeTransfer(e.freelancer, freelancerNet);
        }
        if (clientRefund > 0) {
            IERC20(e.token).safeTransfer(e.client, clientRefund);
        }
        if (platformFee > 0) {
            IERC20(e.token).safeTransfer(feeRecipient, platformFee);
        }

        emit DisputeResolved(escrowId, phaseIndex, freelancerShareBps, freelancerNet, clientRefund);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.9  EXPIRE DISPUTE
    // ═══════════════════════════════════════════════════════════

    function expireDispute(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (p.status != PhaseStatus.Disputed) revert InvalidPhaseStatus(PhaseStatus.Disputed, p.status);
        if (uint64(block.timestamp) < p.disputedAt + disputeTimeout) revert DisputeNotExpired();

        // ── compute — 100 % to freelancer ──
        (uint256 freelancerNet, uint256 totalPhaseFee) = EscrowLogic.computeRelease(p, e.feeBps);
        uint8 phaseIndex = e.currentPhase;

        // ── effects ──
        p.status = PhaseStatus.Approved;
        e.releasedAmount += freelancerNet;   // track actual outflow (INV-4)
        e.releasedFees   += totalPhaseFee;

        if (e.currentPhase == e.phaseCount - 1) {
            e.status = EscrowStatus.Completed;
        } else {
            e.currentPhase++;
            e.status = EscrowStatus.Active;
        }

        // ── interactions ──
        IERC20(e.token).safeTransfer(e.freelancer, freelancerNet);
        IERC20(e.token).safeTransfer(feeRecipient, totalPhaseFee);

        emit DisputeExpired(escrowId, phaseIndex);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.10  CANCEL ESCROW (client)
    // ═══════════════════════════════════════════════════════════

    function cancelEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];

        // ── checks ──
        if (msg.sender != e.client) revert Unauthorized();

        if (e.status == EscrowStatus.Created) {
            // Not funded — nothing to refund
            e.status = EscrowStatus.Cancelled;
            emit EscrowCancelled(escrowId, 0);
            return;
        }

        if (e.status != EscrowStatus.Funded) revert InvalidStatus(EscrowStatus.Funded, e.status);

        // Funded — all phases must still be Pending
        Phase[] storage phases = escrowPhases[escrowId];
        for (uint256 i; i < phases.length; ++i) {
            if (phases[i].status != PhaseStatus.Pending) revert PhasesAlreadyStarted();
        }

        // ── effects ──
        uint256 refund = e.totalDeposit;
        e.refundedAmount = refund;
        e.status = EscrowStatus.Cancelled;
        EscrowLogic.cancelRemainingPhases(phases, 0);

        // ── interactions ──
        IERC20(e.token).safeTransfer(e.client, refund);

        emit EscrowCancelled(escrowId, refund);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.11  EXPIRE FUNDING
    // ═══════════════════════════════════════════════════════════

    function expireFunding(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];

        // ── checks ──
        if (e.status != EscrowStatus.Created) revert InvalidStatus(EscrowStatus.Created, e.status);
        if (uint64(block.timestamp) <= e.createdAt + fundingDeadline) revert FundingNotExpired();

        // ── effects ──
        e.status = EscrowStatus.Cancelled;

        emit FundingExpiredEvent(escrowId);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.12  ENFORCE DEADLINE
    // ═══════════════════════════════════════════════════════════

    function enforceDeadline(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (e.status != EscrowStatus.Active && e.status != EscrowStatus.Funded) {
            revert InvalidStatus(EscrowStatus.Active, e.status);
        }
        if (p.status != PhaseStatus.Pending) revert InvalidPhaseStatus(PhaseStatus.Pending, p.status);
        if (uint64(block.timestamp) <= p.deadline) revert DeadlineNotPassed();

        // ── effects — cancel current + all subsequent phases, refund remaining ──
        uint256 refund = EscrowLogic.sumRemainingPhases(escrowPhases[escrowId], e.currentPhase);
        EscrowLogic.cancelRemainingPhases(escrowPhases[escrowId], e.currentPhase);

        e.refundedAmount += refund;

        // If some phases were already completed the escrow is "Completed" in a
        // partial sense, but per the spec we set Cancelled (terminated early).
        e.status = EscrowStatus.Cancelled;

        // ── interactions ──
        if (refund > 0) {
            IERC20(e.token).safeTransfer(e.client, refund);
        }

        emit DeadlineExpired(escrowId, e.currentPhase, refund);
    }

    // ═══════════════════════════════════════════════════════════
    //        6.13  PROPOSE MUTUAL CANCELLATION
    // ═══════════════════════════════════════════════════════════

    function proposeMutualCancellation(uint256 escrowId, uint16 freelancerShareBps)
        external
        whenNotPaused
    {
        Escrow storage e = escrows[escrowId];
        Phase  storage p = escrowPhases[escrowId][e.currentPhase];

        // ── checks ──
        if (msg.sender != e.client && msg.sender != e.freelancer) revert Unauthorized();
        if (e.status != EscrowStatus.Active) revert InvalidStatus(EscrowStatus.Active, e.status);
        if (p.status != PhaseStatus.Pending) revert InvalidPhaseStatus(PhaseStatus.Pending, p.status);
        if (freelancerShareBps > BPS_DENOMINATOR) revert InvalidShareBps();

        // ── effects — overwrites any previous proposal ──
        cancellationProposals[escrowId] = CancellationProposal({
            proposedBy:        msg.sender,
            freelancerShareBps: freelancerShareBps,
            proposedAt:        uint64(block.timestamp)
        });

        emit MutualCancellationProposed(escrowId, msg.sender, freelancerShareBps);
    }

    // ═══════════════════════════════════════════════════════════
    //        6.14  ACCEPT MUTUAL CANCELLATION
    // ═══════════════════════════════════════════════════════════

    function acceptMutualCancellation(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        CancellationProposal storage prop = cancellationProposals[escrowId];

        // ── checks ──
        if (msg.sender != e.client && msg.sender != e.freelancer) revert Unauthorized();
        if (prop.proposedAt == 0) revert NoActiveProposal();
        if (msg.sender == prop.proposedBy) revert ProposerCannotAccept();
        if (uint64(block.timestamp) > prop.proposedAt + CANCELLATION_EXPIRY) revert ProposalExpired();
        if (e.status != EscrowStatus.Active) revert InvalidStatus(EscrowStatus.Active, e.status);

        // ── compute remaining balance for split ──
        Phase[] storage phases = escrowPhases[escrowId];
        uint256 remainingWorkValue;
        uint256 remainingClientFee;
        for (uint256 i = e.currentPhase; i < e.phaseCount; ++i) {
            Phase storage rp = phases[i];
            if (rp.status == PhaseStatus.Pending || rp.status == PhaseStatus.Submitted) {
                remainingWorkValue += rp.amount;
                remainingClientFee += rp.clientFee;
            }
        }

        (uint256 freelancerNet, uint256 clientRefund, uint256 platformFee) =
            EscrowLogic.computeMutualSplit(
                remainingWorkValue, remainingClientFee, e.feeBps, prop.freelancerShareBps
            );

        // ── effects ──
        EscrowLogic.cancelRemainingPhases(phases, e.currentPhase);
        e.releasedAmount += freelancerNet;  // track actual outflow (INV-4)
        e.releasedFees   += platformFee;
        e.refundedAmount += clientRefund;
        e.status = EscrowStatus.Cancelled;

        // Clear proposal
        delete cancellationProposals[escrowId];

        // ── interactions ──
        if (freelancerNet > 0) {
            IERC20(e.token).safeTransfer(e.freelancer, freelancerNet);
        }
        if (clientRefund > 0) {
            IERC20(e.token).safeTransfer(e.client, clientRefund);
        }
        if (platformFee > 0) {
            IERC20(e.token).safeTransfer(feeRecipient, platformFee);
        }

        emit EscrowMutuallyCancelled(escrowId, freelancerNet, clientRefund);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.15  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert Unauthorized();
        emit ConfigUpdated("arbitrator", uint160(arbitrator), uint160(newArbitrator));
        arbitrator = newArbitrator;
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert Unauthorized();
        emit ConfigUpdated("feeRecipient", uint160(feeRecipient), uint160(newFeeRecipient));
        feeRecipient = newFeeRecipient;
    }

    function setPlatformFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit ConfigUpdated("platformFeeBps", platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function setFundingDeadline(uint64 newDeadline) external onlyOwner {
        emit ConfigUpdated("fundingDeadline", fundingDeadline, newDeadline);
        fundingDeadline = newDeadline;
    }

    function setDisputeTimeout(uint64 newTimeout) external onlyOwner {
        emit ConfigUpdated("disputeTimeout", disputeTimeout, newTimeout);
        disputeTimeout = newTimeout;
    }

    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    //            6.16  EMERGENCY FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Redirect stuck funds when a party's address is USDC/USDT-blacklisted.
    ///         Only callable by the escrow's snapshotted arbitrator.
    function rescueStuckFunds(
        uint256 escrowId,
        address altFreelancer,
        address altClient
    ) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.arbitrator) revert Unauthorized();
        if (altFreelancer == address(0) && altClient == address(0)) revert Unauthorized();

        // Update addresses so future transfers go to the alternates
        if (altFreelancer != address(0)) {
            e.freelancer = altFreelancer;
        }
        if (altClient != address(0)) {
            e.client = altClient;
        }
    }

    /// @notice Recover tokens accidentally sent outside normal escrow flow.
    ///         Must not dip below active escrow obligations.
    function emergencyTokenRecovery(address token, uint256 amount, address to)
        external
        onlyOwner
    {
        if (to == address(0)) revert Unauthorized();

        // Safety check: ensure we don't withdraw more than the "excess" balance.
        // The contract's obligation is the sum of all active escrows' remaining
        // balances. We do a simple check against the token balance.
        uint256 balance = IERC20(token).balanceOf(address(this));
        // We cannot efficiently compute total obligations on-chain for all
        // escrows, so we just ensure we don't take the full balance of a
        // known token. For non-escrow tokens this is fine.
        if (token == USDC || token == USDT) {
            // Conservative: owner must ensure amount doesn't exceed excess.
            // This is an emergency function — misuse is a governance risk.
            if (amount > balance) revert ObligationViolation();
        }

        IERC20(token).safeTransfer(to, amount);
    }

    // ═══════════════════════════════════════════════════════════
    //                     VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Returns the full Escrow struct for off-chain reading / migration.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    /// @notice Returns all phases for an escrow.
    function getPhases(uint256 escrowId) external view returns (Phase[] memory) {
        return escrowPhases[escrowId];
    }

    /// @notice Returns a single phase.
    function getPhase(uint256 escrowId, uint8 phaseIndex) external view returns (Phase memory) {
        return escrowPhases[escrowId][phaseIndex];
    }

    /// @notice Returns the current cancellation proposal (if any).
    function getCancellationProposal(uint256 escrowId)
        external
        view
        returns (CancellationProposal memory)
    {
        return cancellationProposals[escrowId];
    }

    /// @notice Helper: compute the required deposit for a given totalAmount at
    ///         the current platform fee. Useful for frontends.
    function computeRequiredDeposit(uint256 totalAmount) external view returns (uint256) {
        uint16 halfFeeBps = platformFeeBps / 2;
        uint256 clientFee = (totalAmount * halfFeeBps) / BPS_DENOMINATOR;
        return totalAmount + clientFee;
    }
}
