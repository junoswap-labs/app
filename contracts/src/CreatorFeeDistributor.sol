// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title CreatorFeeDistributor — Launchpad "Fee Creator" reward payouts
/// @notice Pays meme-token creators their epoch share (90% of the pumpFee their tokens
///         generated on the bonding curve) in a single payout token (KKUB). Each epoch is
///         published as its own Merkle root plus the funds backing it; creators pull-claim
///         with a proof. Unclaimed funds are reclaimable by the treasury once the claim
///         window closes, so a creator who never claims forfeits that epoch.
/// @dev The reward math and Merkle tree are built off-chain (settlement job) from the
///      junoswap indexer's per-creator fee data — this contract only escrows the payout
///      token and verifies proofs. Leaves use the OpenZeppelin StandardMerkleTree encoding
///      (double-hashed abi.encode(account, amount)); build the tree with OpenZeppelin's
///      `merkle-tree` npm package (org-scoped as openzeppelin/merkle-tree) so proofs verify
///      against `MerkleProof.verify` here.
contract CreatorFeeDistributor is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Held by the settlement bot that funds + publishes each epoch. Kept separate from
    ///      DEFAULT_ADMIN_ROLE (which can reclaim forfeited funds) so the bot key can be
    ///      rotated without touching treasury withdrawal rights.
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    struct Epoch {
        bytes32 merkleRoot;
        uint256 totalFunded; // payout token pulled in when the epoch was published
        uint256 totalClaimed; // sum of claims settled so far
        uint256 publishedAt; // claim window is [publishedAt, publishedAt + claimWindow]
        bool reclaimed; // treasury swept the unclaimed remainder
    }

    /// @notice The single asset every reward is paid in (KKUB). Sell-side fees the curve
    ///         collects as meme tokens are swapped to this by the treasury before funding.
    IERC20 public immutable payoutToken;

    /// @notice How long after publication a creator may still claim an epoch. Set to
    ///         3 * epochDuration at deploy so "forfeit after 3 epochs" holds regardless of
    ///         the campaign's epoch length (which lives off-chain).
    uint256 public immutable claimWindow;

    mapping(uint256 => Epoch) public epochs; // epochId => epoch
    mapping(uint256 => mapping(address => bool)) public hasClaimed; // epochId => creator => claimed
    uint256 public latestEpoch; // highest epochId published so far

    event EpochPublished(
        uint256 indexed epochId, bytes32 merkleRoot, uint256 funded, uint256 claimDeadline
    );
    event Claimed(uint256 indexed epochId, address indexed creator, uint256 amount);
    event EpochReclaimed(uint256 indexed epochId, address indexed to, uint256 amount);

    struct ClaimInput {
        uint256 epochId;
        uint256 amount;
        bytes32[] proof;
    }

    constructor(address _payoutToken, uint256 _claimWindow, address admin) {
        require(_payoutToken != address(0), "zero payoutToken");
        require(_claimWindow > 0, "zero claimWindow");
        require(admin != address(0), "zero admin");
        payoutToken = IERC20(_payoutToken);
        claimWindow = _claimWindow;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PUBLISHER_ROLE, admin);
    }

    /// @notice Fund and open an epoch for claims. Pulls `fundAmount` payout token from the
    ///         caller, so the publisher must approve this contract first. `fundAmount` must
    ///         cover the sum of every reward in the tree; any excess is reclaimable later.
    /// @dev epochId must strictly increase so the forfeiture window advances monotonically;
    ///      it does not have to be contiguous (the settlement job may skip empty epochs).
    function publishEpoch(uint256 epochId, bytes32 merkleRoot, uint256 fundAmount)
        external
        onlyRole(PUBLISHER_ROLE)
        whenNotPaused
    {
        require(epochId > latestEpoch, "epoch not increasing");
        require(merkleRoot != bytes32(0), "empty root");
        require(fundAmount > 0, "zero fund");

        latestEpoch = epochId;
        epochs[epochId] = Epoch({
            merkleRoot: merkleRoot,
            totalFunded: fundAmount,
            totalClaimed: 0,
            publishedAt: block.timestamp,
            reclaimed: false
        });

        payoutToken.safeTransferFrom(msg.sender, address(this), fundAmount);

        emit EpochPublished(epochId, merkleRoot, fundAmount, block.timestamp + claimWindow);
    }

    /// @notice Claim a single epoch's reward. `amount` is the exact cumulative reward for
    ///         `msg.sender` encoded in that epoch's leaf.
    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof)
        public
        nonReentrant
        whenNotPaused
    {
        Epoch storage e = epochs[epochId];
        require(e.merkleRoot != bytes32(0), "epoch not published");
        require(block.timestamp <= e.publishedAt + claimWindow, "claim window closed");
        require(!hasClaimed[epochId][msg.sender], "already claimed");

        // OZ StandardMerkleTree leaf: double keccak of abi.encode(account, amount). The inner
        // hash is what the off-chain tree builder feeds; the outer guards against a proof node
        // being reinterpreted as a leaf (second-preimage).
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, e.merkleRoot, leaf), "invalid proof");

        hasClaimed[epochId][msg.sender] = true;
        e.totalClaimed += amount;
        payoutToken.safeTransfer(msg.sender, amount);

        emit Claimed(epochId, msg.sender, amount);
    }

    /// @notice Claim several epochs in one transaction. Each entry is verified independently,
    ///         so one closed/already-claimed epoch reverts the whole batch — split it out and
    ///         retry the still-open epochs.
    function claimMany(ClaimInput[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; i++) {
            claim(claims[i].epochId, claims[i].amount, claims[i].proof);
        }
    }

    /// @notice After the claim window closes, sweep an epoch's unclaimed remainder back to the
    ///         treasury. This is the "forfeit after 3 epochs" path — nothing here can touch
    ///         funds a creator was entitled to while their window was still open.
    function reclaim(uint256 epochId, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        Epoch storage e = epochs[epochId];
        require(e.merkleRoot != bytes32(0), "epoch not published");
        require(block.timestamp > e.publishedAt + claimWindow, "window still open");
        require(!e.reclaimed, "already reclaimed");
        require(to != address(0), "zero to");

        e.reclaimed = true;
        uint256 remainder = e.totalFunded - e.totalClaimed;
        if (remainder > 0) {
            payoutToken.safeTransfer(to, remainder);
        }

        emit EpochReclaimed(epochId, to, remainder);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
