// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// ============================================================
//  EscrowTypes — structs, enums, errors, events, and constants
// ============================================================

// ──────────────────── Enums ────────────────────

enum EscrowStatus {
    Created,    // Exists but not yet funded
    Funded,     // Client deposited full amount, no work started
    Active,     // At least one phase in progress
    Completed,  // All phases released
    Cancelled,  // Terminated (refunds processed)
    Disputed    // Active dispute, awaiting arbitrator
}

enum PhaseStatus {
    Pending,      // No work submitted for this phase yet
    Submitted,    // Freelancer claims completion, awaiting review
    Approved,     // Client approved OR arbitrator ruled for freelancer
    Disputed,     // Quality disagreement, arbitrator must resolve
    AutoReleased, // Client non-responsive, timeout triggered
    Cancelled     // Phase cancelled (early termination / deadline)
}

// ──────────────────── Structs ────────────────────

/// @dev Storage-packed for gas efficiency.
///  Slot 1: client(20) + phaseCount(1) + currentPhase(1) + status(1) = 23 bytes
///  Slot 2: freelancer(20) + feeBps(2) = 22 bytes
///  Slot 3: token(20) + autoReleaseTimeout(8) = 28 bytes
///  Slot 4: arbitrator(20) + createdAt(8) = 28 bytes
///  Slot 5: fundedAt(8) — starts new slot (prev full)
///  Slots 6-10: uint256 fields
struct Escrow {
    // --- slot 1 ---
    address client;
    uint8   phaseCount;
    uint8   currentPhase;
    EscrowStatus status;
    // --- slot 2 ---
    address freelancer;
    uint16  feeBps;
    // --- slot 3 ---
    address token;
    uint64  autoReleaseTimeout;
    // --- slot 4 ---
    address arbitrator;
    uint64  createdAt;
    // --- slot 5 ---
    uint64  fundedAt;
    // --- slot 6 ---
    uint256 totalAmount;
    // --- slot 7 ---
    uint256 totalDeposit;
    // --- slot 8 ---
    uint256 releasedAmount;
    // --- slot 9 ---
    uint256 releasedFees;
    // --- slot 10 ---
    uint256 refundedAmount;
}

/// @dev Phase struct — stored in a separate mapping(uint256 => Phase[]).
struct Phase {
    uint16      percentageBps;
    uint64      deadline;
    uint64      submittedAt;
    uint64      disputedAt;
    uint8       revisionCount;
    PhaseStatus status;
    uint256     amount;
    uint256     clientFee;
}

/// @dev Mutual-cancellation proposal stored per escrow.
struct CancellationProposal {
    address proposedBy;
    uint16  freelancerShareBps;
    uint64  proposedAt;
}

// ──────────────────── Constants ────────────────────

uint16  constant MAX_FEE_BPS        = 1000;       // 10 % hard cap
uint8   constant MAX_PHASES         = 20;
uint64  constant MIN_AUTO_RELEASE   = 7 days;
uint64  constant MAX_AUTO_RELEASE   = 30 days;
uint64  constant DISPUTE_BUFFER     = 1 hours;
uint8   constant MAX_REVISIONS      = 3;
uint16  constant BPS_DENOMINATOR    = 10_000;
uint64  constant CANCELLATION_EXPIRY = 7 days;

// ──────────────────── Custom Errors ────────────────────

error Unauthorized();
error InvalidStatus(EscrowStatus expected, EscrowStatus actual);
error InvalidPhaseStatus(PhaseStatus expected, PhaseStatus actual);
error InvalidPercentages();
error PhaseAmountZero(uint8 phaseIndex);
error AutoReleaseNotReady();
error DisputeBufferActive();
error MaxRevisionsReached();
error InvalidToken();
error FeeTooHigh();
error InvalidFreelancer();
error InvalidAmount();
error InvalidPhaseCount();
error DeadlinesNotIncreasing();
error DeadlineTooSoon();
error AutoReleaseOutOfRange();
error FundingExpiredError();
error FundingNotExpired();
error DeadlineNotPassed();
error ProposalExpired();
error NoActiveProposal();
error ProposerCannotAccept();
error InvalidShareBps();
error PhasesAlreadyStarted();
error DisputeNotExpired();
error ObligationViolation();

// ──────────────────── Events ────────────────────

event EscrowCreated(
    uint256 indexed escrowId,
    address indexed client,
    address indexed freelancer,
    address token,
    uint256 totalAmount,
    uint256 totalDeposit,
    uint8   phaseCount
);
event EscrowFunded(uint256 indexed escrowId, uint256 depositAmount);
event PhaseSubmitted(uint256 indexed escrowId, uint8 phaseIndex, uint64 submittedAt);
event PhaseApproved(uint256 indexed escrowId, uint8 phaseIndex, uint256 freelancerNet, uint256 platformFee);
event PhaseAutoReleased(uint256 indexed escrowId, uint8 phaseIndex, uint256 freelancerNet, uint256 platformFee);
event RevisionRequested(uint256 indexed escrowId, uint8 phaseIndex, uint8 revisionCount);
event DisputeRaised(uint256 indexed escrowId, uint8 phaseIndex, address indexed raisedBy);
event DisputeResolved(
    uint256 indexed escrowId,
    uint8   phaseIndex,
    uint16  freelancerShareBps,
    uint256 freelancerNet,
    uint256 clientRefund
);
event DisputeExpired(uint256 indexed escrowId, uint8 phaseIndex);
event EscrowCancelled(uint256 indexed escrowId, uint256 refundedToClient);
event MutualCancellationProposed(uint256 indexed escrowId, address indexed proposedBy, uint16 freelancerShareBps);
event EscrowMutuallyCancelled(uint256 indexed escrowId, uint256 freelancerNet, uint256 clientRefund);
event DeadlineExpired(uint256 indexed escrowId, uint8 phaseIndex, uint256 refundedToClient);
event FundingExpiredEvent(uint256 indexed escrowId);
event ConfigUpdated(string parameter, uint256 oldValue, uint256 newValue);
event ContractPaused(address indexed pausedBy);
event ContractUnpaused(address indexed unpausedBy);
