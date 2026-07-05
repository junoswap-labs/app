// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RwaEscrow — custodial escrow vault for Real-World-Asset trades
/// @notice ERC20 payment is held by this contract from purchase until the order resolves
///         through the state machine: Funded -> Shipped -> Completed, with branches for
///         buyer refund (seller misses ship deadline) and arbitrated dispute.
/// @dev Admin functions are gated by DEFAULT_ADMIN_ROLE (the "owner" in the planning docs).
///      ARBITRATOR_ROLE — which can move other people's escrowed funds — should be held by a
///      multisig (e.g. Gnosis Safe), never a single EOA.
contract RwaEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Funded,
        Shipped,
        Completed,
        Refunded,
        Disputed,
        ResolvedSeller,
        ResolvedBuyer
    }

    struct RwaOrder {
        address seller;
        address buyer;
        address paymentToken;
        uint256 amount;
        Status status;
        uint256 fundedAt;
        uint256 shippedAt;
    }

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    uint256 public constant SHIP_DEADLINE = 7 days; // buyer can self-refund if seller hasn't shipped by now
    uint256 public constant DISPUTE_GRACE = 14 days; // either party can open a dispute this long after shipping
    uint256 public constant MAX_FEE_BPS = 1000; // 10% cap
    uint256 private constant BPS_DENOMINATOR = 10000;

    mapping(bytes32 => RwaOrder) public orders; // key = listingId minted by the backend
    mapping(address => bool) public allowedPaymentTokens;
    uint256 public feeBps;
    address public feeCollector;

    event RwaFunded(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed buyer,
        address paymentToken,
        uint256 amount,
        uint256 fundedAt
    );
    event RwaShipped(bytes32 indexed listingId, uint256 shippedAt);
    event RwaCompleted(bytes32 indexed listingId, uint256 amountToSeller, uint256 fee);
    event RwaRefunded(bytes32 indexed listingId, uint256 amount);
    event RwaDisputeOpened(bytes32 indexed listingId, address indexed openedBy);
    event RwaDisputeResolved(bytes32 indexed listingId, bool releasedToSeller);
    event PaymentTokenAllowed(address indexed token, bool allowed);
    event FeeBpsUpdated(uint256 feeBps);
    event FeeCollectorUpdated(address indexed feeCollector);

    constructor(uint256 _feeBps, address _feeCollector) {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        require(_feeCollector != address(0), "zero feeCollector");
        feeBps = _feeBps;
        feeCollector = _feeCollector;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function fund(bytes32 listingId, address seller, address paymentToken, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        RwaOrder storage o = orders[listingId];
        require(o.status == Status.None, "already funded");
        require(allowedPaymentTokens[paymentToken], "payment token not allowed");
        require(seller != address(0), "zero seller");
        require(seller != msg.sender, "self trade");
        require(amount > 0, "zero amount");

        o.seller = seller;
        o.buyer = msg.sender;
        o.paymentToken = paymentToken;
        o.amount = amount;
        o.status = Status.Funded;
        o.fundedAt = block.timestamp;

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);

        emit RwaFunded(listingId, seller, msg.sender, paymentToken, amount, block.timestamp);
    }

    function markShipped(bytes32 listingId) external whenNotPaused {
        RwaOrder storage o = orders[listingId];
        require(msg.sender == o.seller, "not seller");
        require(o.status == Status.Funded, "not funded");
        o.status = Status.Shipped;
        o.shippedAt = block.timestamp;
        emit RwaShipped(listingId, block.timestamp);
    }

    function confirmReceived(bytes32 listingId) external nonReentrant whenNotPaused {
        RwaOrder storage o = orders[listingId];
        require(msg.sender == o.buyer, "not buyer");
        require(o.status == Status.Shipped, "not shipped");
        o.status = Status.Completed;
        (uint256 toSeller, uint256 fee) = _payout(o, o.seller);
        emit RwaCompleted(listingId, toSeller, fee);
    }

    /// @notice Buyer escape hatch when the seller never ships. Full refund, no fee taken.
    function claimRefund(bytes32 listingId) external nonReentrant whenNotPaused {
        RwaOrder storage o = orders[listingId];
        require(msg.sender == o.buyer, "not buyer");
        require(o.status == Status.Funded, "not funded");
        require(block.timestamp > o.fundedAt + SHIP_DEADLINE, "ship deadline not passed");
        o.status = Status.Refunded;
        IERC20(o.paymentToken).safeTransfer(o.buyer, o.amount);
        emit RwaRefunded(listingId, o.amount);
    }

    function openDispute(bytes32 listingId) external whenNotPaused {
        RwaOrder storage o = orders[listingId];
        require(msg.sender == o.seller || msg.sender == o.buyer, "not party");
        require(o.status == Status.Shipped, "not shipped");
        require(block.timestamp > o.shippedAt + DISPUTE_GRACE, "dispute grace not passed");
        o.status = Status.Disputed;
        emit RwaDisputeOpened(listingId, msg.sender);
    }

    /// @notice Arbitrator-only. Not pausable, so disputes can always be settled even during an
    ///         emergency pause that halts ordinary flow.
    function resolveDispute(bytes32 listingId, bool releaseToSeller)
        external
        nonReentrant
        onlyRole(ARBITRATOR_ROLE)
    {
        RwaOrder storage o = orders[listingId];
        require(o.status == Status.Disputed, "not disputed");
        if (releaseToSeller) {
            o.status = Status.ResolvedSeller;
            _payout(o, o.seller);
        } else {
            o.status = Status.ResolvedBuyer;
            IERC20(o.paymentToken).safeTransfer(o.buyer, o.amount);
        }
        emit RwaDisputeResolved(listingId, releaseToSeller);
    }

    /// @dev Splits the escrowed amount into fee + recipient proceeds. Caller must set status first.
    function _payout(RwaOrder storage o, address recipient)
        private
        returns (uint256 toRecipient, uint256 fee)
    {
        fee = (o.amount * feeBps) / BPS_DENOMINATOR;
        toRecipient = o.amount - fee;
        IERC20 token = IERC20(o.paymentToken);
        if (fee > 0) {
            token.safeTransfer(feeCollector, fee);
        }
        token.safeTransfer(recipient, toRecipient);
    }

    function setAllowedPaymentToken(address token, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        allowedPaymentTokens[token] = allowed;
        emit PaymentTokenAllowed(token, allowed);
    }

    function setFeeBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= MAX_FEE_BPS, "fee too high");
        feeBps = bps;
        emit FeeBpsUpdated(bps);
    }

    function setFeeCollector(address collector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(collector != address(0), "zero feeCollector");
        feeCollector = collector;
        emit FeeCollectorUpdated(collector);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
