// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title AirdropEscrow — custodial escrow vault for shareable-link token giveaways
/// @notice A creator deposits an ERC20 total and configures how it's split: a Fixed amount per
///         claim, or a Random amount per claim that always sums exactly to the deposited total.
///         Claimants either submit their own claim() and pay their own gas (GasMode.Self), or a
///         backend relayer (RELAYER_ROLE) submits claimFor() on their behalf (GasMode.Relayer) —
///         the relayer never needs an on-chain signature from the claimant because the backend
///         (SIWE session + optional GPS/IP checks) is the trust boundary for who it calls
///         claimFor() with, not this contract. Relayer-mode campaigns prepay a native-KUB
///         `gasDeposit` at creation (sized off-chain as estimatedGas * 1.3 * maxClaimants); each
///         claimFor() reimburses the relayer's actual cost out of that deposit, capped at what's
///         left, and the creator reclaims any unspent balance with a manual reclaimGas() call
///         once the campaign is no longer active — nothing sweeps it automatically.
/// @dev Random amounts are drawn on-chain (block.blockhash/timestamp entropy) rather than
///      off-chain, specifically so the running "remaining pool" is read and updated atomically
///      within a single claim tx — no off-chain coordination or locking is needed to guarantee
///      the sum of all claims exactly equals the deposited total. This entropy source is
///      manipulable by whoever controls transaction ordering (a validator, or the relayer bot
///      itself); acceptable for a casual giveaway feature, not suitable for high-value drops.
/// @dev claim() (self-pay) requires an EIP-712 authorization signed by BACKEND_SIGNER_ROLE,
///      binding (campaignId, recipient, amount, deadline) — this is what stops a self-pay claim
///      submitted straight against the contract from skipping the backend's GPS/IP checks
///      (app/api/airdrop/claim/route.ts), and lets the backend draw Random-mode amounts with real
///      off-chain entropy instead of the predictable blockhash used by claimFor() below. The
///      contract still validates the signed amount against the campaign's own bounds — it never
///      trusts the backend's numbers blindly, only its authority to authorize a claim at all.
contract AirdropEscrow is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum AmountMode {
        Fixed,
        Random
    }

    enum CampaignStatus {
        Active,
        Closed,
        Reclaimed
    }

    enum GasMode {
        Self,
        Relayer
    }

    struct Campaign {
        address creator;
        address token;
        AmountMode amountMode;
        uint256 fixedAmount; // amountMode == Fixed
        uint256 minAmount; // amountMode == Random
        uint256 maxAmount; // amountMode == Random
        uint256 totalAmount;
        uint256 remainingAmount;
        uint32 maxClaimants; // 0 = unlimited, claim until the pool is exhausted
        uint32 claimedCount;
        uint256 expiresAt; // 0 = no expiry
        CampaignStatus status;
        GasMode gasMode;
        uint256 gasDeposit; // native KUB wei, gasMode == Relayer — funds claimFor() reimbursements
        uint256 gasSpent; // native KUB wei paid out to the relayer so far, <= gasDeposit
    }

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant BACKEND_SIGNER_ROLE = keccak256("BACKEND_SIGNER_ROLE");

    bytes32 public constant CLAIM_AUTH_TYPEHASH =
        keccak256("ClaimAuthorization(bytes32 campaignId,address recipient,uint256 amount,uint256 deadline)");

    // Not `public` — an auto-generated getter exploding all 15 Campaign fields into individual
    // return values hits "stack too deep" during codegen. getCampaign() below returns the whole
    // struct as one value instead.
    mapping(bytes32 => Campaign) internal campaigns_; // key = campaignId minted by the backend
    mapping(bytes32 => mapping(address => bool)) public claimed; // campaignId => recipient => claimed

    function getCampaign(bytes32 campaignId) external view returns (Campaign memory) {
        return campaigns_[campaignId];
    }

    uint256 public creationFeeFlat; // native KUB, wei — charged per createCampaign(), default 0
    address public feeCollector;

    event CampaignCreated(
        bytes32 indexed campaignId,
        address indexed creator,
        address indexed token,
        uint256 totalAmount,
        AmountMode amountMode,
        uint256 fixedAmount,
        uint256 minAmount,
        uint256 maxAmount,
        uint32 maxClaimants,
        uint256 expiresAt,
        GasMode gasMode,
        uint256 gasDeposit
    );
    event AirdropClaimed(
        bytes32 indexed campaignId, address indexed recipient, uint256 amount, address submitter, bool closesCampaign
    );
    event CampaignClosed(bytes32 indexed campaignId, uint8 reason); // 0 = exhausted, 1 = maxClaimantsReached, 2 = endedByCreator
    event CampaignReclaimed(bytes32 indexed campaignId, address indexed to, uint256 amount);
    event GasReimbursed(bytes32 indexed campaignId, address indexed relayer, uint256 amount);
    event GasReclaimed(bytes32 indexed campaignId, address indexed to, uint256 amount);
    event CreationFeeUpdated(uint256 feeAmount);
    event FeeCollectorUpdated(address indexed feeCollector);

    constructor(uint256 _creationFeeFlat, address _feeCollector, address admin, address relayer, address backendSigner)
        EIP712("JunoAirdropEscrow", "1")
    {
        require(_feeCollector != address(0), "zero feeCollector");
        require(admin != address(0), "zero admin");
        require(relayer != address(0), "zero relayer");
        require(backendSigner != address(0), "zero backendSigner");
        creationFeeFlat = _creationFeeFlat;
        feeCollector = _feeCollector;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
        _grantRole(BACKEND_SIGNER_ROLE, backendSigner);
    }

    /// @notice Digest a claimant's app/api/airdrop/claim response is signed against — exposed so
    ///         tests (and the backend, for parity checks) can compute it without duplicating the
    ///         EIP-712 encoding logic. Must match lib/eip712.ts's airdropClaimDomain/AIRDROP_CLAIM_TYPES.
    function claimAuthorizationDigest(bytes32 campaignId, address recipient, uint256 amount, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(CLAIM_AUTH_TYPEHASH, campaignId, recipient, amount, deadline)));
    }

    /// @dev Grouped into a calldata struct (rather than 11 loose params) to dodge a "stack too
    ///      deep" compile error — that many locals plus the branching below overflows the EVM's
    ///      16-slot stack window under the legacy codegen (no viaIR elsewhere in this repo, so
    ///      that's a repo-wide compiler-pipeline change avoided in favor of this local fix).
    struct CreateCampaignParams {
        bytes32 campaignId;
        address token;
        AmountMode amountMode;
        uint256 fixedAmount;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 totalAmount;
        uint32 maxClaimants;
        uint256 expiresAt;
        GasMode gasMode;
        uint256 gasDeposit;
    }

    /// @notice Deposit `totalAmount` of `p.token` and open a new campaign under `p.campaignId`
    ///         (minted off-chain by the backend, same pattern as RwaEscrow's listingId).
    ///         `p.gasDeposit` is only meaningful (and required) when `p.gasMode == Relayer` —
    ///         it's native KUB sent alongside `creationFeeFlat` in the same `msg.value`, sized
    ///         off-chain as estimatedGas * 1.3 * maxClaimants (see hooks/useAirdropActions.ts).
    function createCampaign(CreateCampaignParams calldata p) external payable nonReentrant whenNotPaused {
        Campaign storage c = campaigns_[p.campaignId];
        require(c.creator == address(0), "campaign id already used");
        require(p.token != address(0), "zero token");
        require(p.totalAmount > 0, "zero totalAmount");
        require(p.expiresAt == 0 || p.expiresAt > block.timestamp, "expiresAt in past");

        if (p.gasMode == GasMode.Relayer) {
            require(p.gasDeposit > 0, "zero gasDeposit");
            require(p.maxClaimants > 0, "relayer mode requires a maxClaimants cap");
        } else {
            require(p.gasDeposit == 0, "gasDeposit only applies to relayer mode");
        }
        require(msg.value == creationFeeFlat + p.gasDeposit, "incorrect creation fee");

        if (p.amountMode == AmountMode.Fixed) {
            require(p.fixedAmount > 0, "zero fixedAmount");
            require(p.fixedAmount <= p.totalAmount, "fixedAmount exceeds totalAmount");
        } else {
            require(p.minAmount > 0, "zero minAmount");
            require(p.maxAmount >= p.minAmount, "maxAmount below minAmount");
            require(p.maxAmount <= p.totalAmount, "maxAmount exceeds totalAmount");
            require(
                p.maxClaimants == 0 || p.totalAmount >= uint256(p.maxClaimants) * p.minAmount,
                "totalAmount cannot cover maxClaimants at minAmount"
            );
        }

        c.creator = msg.sender;
        c.token = p.token;
        c.amountMode = p.amountMode;
        c.fixedAmount = p.fixedAmount;
        c.minAmount = p.minAmount;
        c.maxAmount = p.maxAmount;
        c.totalAmount = p.totalAmount;
        c.remainingAmount = p.totalAmount;
        c.maxClaimants = p.maxClaimants;
        c.expiresAt = p.expiresAt;
        c.status = CampaignStatus.Active;
        c.gasMode = p.gasMode;
        c.gasDeposit = p.gasDeposit;

        IERC20(p.token).safeTransferFrom(msg.sender, address(this), p.totalAmount);

        if (creationFeeFlat > 0) {
            (bool sent,) = feeCollector.call{value: creationFeeFlat}("");
            require(sent, "fee transfer failed");
        }

        emit CampaignCreated(
            p.campaignId,
            msg.sender,
            p.token,
            p.totalAmount,
            p.amountMode,
            p.fixedAmount,
            p.minAmount,
            p.maxAmount,
            p.maxClaimants,
            p.expiresAt,
            p.gasMode,
            p.gasDeposit
        );
    }

    /// @notice Self-pay mode: the claimant submits this directly and pays their own gas.
    ///         `amount`/`deadline`/`signature` come straight from app/api/airdrop/claim's response
    ///         — the backend only signs after its own GPS/IP/dedupe checks pass, so this is what
    ///         stops a claim() sent straight to the contract from skipping them. The contract still
    ///         re-validates `amount` against the campaign's own rules (see _validateRandomAmount)
    ///         rather than trusting the backend's number blindly.
    function claim(bytes32 campaignId, address recipient, uint256 amount, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        require(block.timestamp <= deadline, "authorization expired");
        bytes32 digest = claimAuthorizationDigest(campaignId, recipient, amount, deadline);
        require(hasRole(BACKEND_SIGNER_ROLE, ECDSA.recover(digest, signature)), "bad claim authorization");

        _processClaimWithAmount(campaignId, recipient, amount);
    }

    /// @notice Relayer mode: the backend's bot wallet submits this on the claimant's behalf so
    ///         the campaign's on-chain gasDeposit covers it instead of the claimant. `recipient`
    ///         is not verified by signature here — the caller must already hold RELAYER_ROLE, and
    ///         the backend is expected to have authenticated `recipient` (SIWE session, optional
    ///         GPS/IP checks) before calling. `gasReimbursement` is the relayer's own estimate of
    ///         this tx's cost (see server/src/chain.ts) — capped at whatever remains of the
    ///         campaign's gasDeposit, so a relayer can never be paid out more than the creator
    ///         escrowed regardless of what it requests.
    function claimFor(bytes32 campaignId, address recipient, uint256 gasReimbursement)
        external
        onlyRole(RELAYER_ROLE)
        nonReentrant
        whenNotPaused
    {
        Campaign storage c = campaigns_[campaignId];
        require(c.gasMode == GasMode.Relayer, "campaign is not relayer-funded");

        _processClaim(campaignId, recipient);

        uint256 available = c.gasDeposit - c.gasSpent;
        uint256 payout = gasReimbursement < available ? gasReimbursement : available;
        if (payout > 0) {
            c.gasSpent += payout;
            (bool sent,) = msg.sender.call{value: payout}("");
            require(sent, "gas reimbursement failed");
            emit GasReimbursed(campaignId, msg.sender, payout);
        }
    }

    /// @dev claimFor()'s path — computes `amount` itself (blockhash entropy for Random mode; see
    ///      the contract header comment on why claim() below doesn't).
    function _processClaim(bytes32 campaignId, address recipient) private {
        Campaign storage c = campaigns_[campaignId];
        _requireClaimable(c, campaignId, recipient);

        uint256 amount;
        if (c.amountMode == AmountMode.Fixed) {
            require(c.remainingAmount >= c.fixedAmount, "insufficient remaining for fixed amount");
            amount = c.fixedAmount;
        } else {
            amount = _computeRandomAmount(c, recipient);
        }

        _applyClaim(campaignId, recipient, c, amount);
    }

    /// @dev claim()'s path — `amount` is already backend-signed and authenticated by the time this
    ///      runs; still re-validated against the campaign's own rules here rather than trusted
    ///      blindly (see the contract header comment).
    function _processClaimWithAmount(bytes32 campaignId, address recipient, uint256 amount) private {
        Campaign storage c = campaigns_[campaignId];
        _requireClaimable(c, campaignId, recipient);

        if (c.amountMode == AmountMode.Fixed) {
            require(amount == c.fixedAmount, "amount does not match fixedAmount");
            require(c.remainingAmount >= amount, "insufficient remaining for fixed amount");
        } else {
            _validateRandomAmount(c, amount);
        }

        _applyClaim(campaignId, recipient, c, amount);
    }

    function _requireClaimable(Campaign storage c, bytes32 campaignId, address recipient) private view {
        require(c.creator != address(0), "campaign not found");
        require(c.status == CampaignStatus.Active, "campaign not active");
        require(c.expiresAt == 0 || block.timestamp <= c.expiresAt, "campaign expired");
        require(recipient != address(0), "zero recipient");
        require(!claimed[campaignId][recipient], "already claimed");
        require(c.remainingAmount > 0, "pool exhausted");
    }

    function _applyClaim(bytes32 campaignId, address recipient, Campaign storage c, uint256 amount) private {
        claimed[campaignId][recipient] = true;
        c.remainingAmount -= amount;
        c.claimedCount += 1;

        bool exhausted = c.remainingAmount == 0;
        bool capReached = c.maxClaimants > 0 && c.claimedCount == c.maxClaimants;
        bool campaignClosed = exhausted || capReached;
        if (campaignClosed) {
            c.status = CampaignStatus.Closed;
        }

        IERC20(c.token).safeTransfer(recipient, amount);

        emit AirdropClaimed(campaignId, recipient, amount, msg.sender, campaignClosed);
        if (campaignClosed) {
            emit CampaignClosed(campaignId, exhausted ? 0 : 1);
        }
    }

    /// @dev Guarantees the sum across every claim in a campaign exactly equals totalAmount:
    ///      the very next claim once remainingAmount < 2*minAmount (or once this is the last of
    ///      maxClaimants slots) takes 100% of what's left instead of a bounded random draw.
    function _computeRandomAmount(Campaign storage c, address recipient) private view returns (uint256 amount) {
        bool forcedLastSlot = c.maxClaimants > 0 && c.claimedCount + 1 == c.maxClaimants;
        bool turnover = c.remainingAmount < 2 * c.minAmount;
        if (forcedLastSlot || turnover) {
            return c.remainingAmount;
        }
        uint256 upperBound = c.maxAmount < (c.remainingAmount - c.minAmount) ? c.maxAmount : (c.remainingAmount - c.minAmount);
        uint256 span = upperBound - c.minAmount + 1;
        uint256 rand = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, c.claimedCount, recipient))
        ) % span;
        return c.minAmount + rand;
    }

    /// @dev claim()'s counterpart to _computeRandomAmount above — same bounds/turnover policy,
    ///      but validates a backend-chosen amount instead of drawing one, since claim() gets its
    ///      amount from the signed authorization, not on-chain entropy.
    function _validateRandomAmount(Campaign storage c, uint256 amount) private view {
        bool forcedLastSlot = c.maxClaimants > 0 && c.claimedCount + 1 == c.maxClaimants;
        bool turnover = c.remainingAmount < 2 * c.minAmount;
        if (forcedLastSlot || turnover) {
            require(amount == c.remainingAmount, "must claim exact remainder");
            return;
        }
        uint256 upperBound = c.maxAmount < (c.remainingAmount - c.minAmount) ? c.maxAmount : (c.remainingAmount - c.minAmount);
        require(amount >= c.minAmount && amount <= upperBound, "amount out of bounds");
    }

    /// @notice Creator (or admin) sweeps whatever's left back to the creator once the campaign
    ///         has an expiry and it has passed. Works regardless of whether the campaign closed
    ///         from exhaustion/cap first — a Fixed-mode campaign whose totalAmount didn't divide
    ///         evenly by fixedAmount can still have unclaimed dust after closing.
    function reclaim(bytes32 campaignId) external nonReentrant {
        Campaign storage c = campaigns_[campaignId];
        require(c.creator != address(0), "campaign not found");
        require(msg.sender == c.creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not creator or admin");
        require(c.status != CampaignStatus.Reclaimed, "already reclaimed");
        // Closed counts as reclaimable on its own: a campaign that ended by cap/exhaustion, or one
        // the creator ended via endCampaign(), takes no further claims, so waiting on expiresAt
        // would only strand the remainder — and a campaign created without an expiry (expiresAt ==
        // 0) had no path back at all before this.
        require(
            c.status == CampaignStatus.Closed || (c.expiresAt != 0 && block.timestamp > c.expiresAt),
            "campaign still active"
        );
        require(c.remainingAmount > 0, "nothing to reclaim");

        uint256 amount = c.remainingAmount;
        c.remainingAmount = 0;
        c.status = CampaignStatus.Reclaimed;

        IERC20(c.token).safeTransfer(c.creator, amount);

        emit CampaignReclaimed(campaignId, c.creator, amount);
    }

    /// @notice Creator (or admin) ends a live campaign early — no further claims are accepted from
    ///         this point, and the unclaimed pool becomes reclaimable immediately via reclaim()
    ///         (plus reclaimGas() for a relayer-mode deposit). This is the only way to stop a
    ///         campaign that was created without an expiry.
    /// @dev    Deliberately cannot un-close: reopening would let a creator revoke and restore a
    ///         claim window at will, which claimants can't plan around.
    function endCampaign(bytes32 campaignId) external {
        Campaign storage c = campaigns_[campaignId];
        require(c.creator != address(0), "campaign not found");
        require(msg.sender == c.creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not creator or admin");
        require(c.status == CampaignStatus.Active, "campaign not active");

        c.status = CampaignStatus.Closed;
        emit CampaignClosed(campaignId, 2);
    }

    /// @notice Creator (or admin) manually sweeps back whatever's left of a relayer-mode
    ///         campaign's gasDeposit once the campaign is no longer taking new claims — closed
    ///         (relayer mode requires maxClaimants > 0, so every relayer campaign eventually
    ///         closes by exhaustion or cap) or past its expiry, so a creator can end one early.
    ///         Nothing sweeps this automatically — the creator has to call it themselves.
    function reclaimGas(bytes32 campaignId) external nonReentrant {
        Campaign storage c = campaigns_[campaignId];
        require(c.creator != address(0), "campaign not found");
        require(msg.sender == c.creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not creator or admin");
        require(c.gasMode == GasMode.Relayer, "campaign has no gas deposit");
        require(
            c.status != CampaignStatus.Active || (c.expiresAt != 0 && block.timestamp > c.expiresAt),
            "campaign still active"
        );

        uint256 amount = c.gasDeposit - c.gasSpent;
        require(amount > 0, "nothing to reclaim");
        c.gasSpent = c.gasDeposit;

        (bool sent,) = c.creator.call{value: amount}("");
        require(sent, "gas reclaim transfer failed");

        emit GasReclaimed(campaignId, c.creator, amount);
    }

    function setCreationFeeFlat(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        creationFeeFlat = fee;
        emit CreationFeeUpdated(fee);
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
