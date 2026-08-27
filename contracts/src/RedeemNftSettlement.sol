// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PermissionRegistry} from "./PermissionRegistry.sol";
import {JunoPts} from "./JunoPts.sol";

/// @notice Official-tier NFT collections must implement this and grant this settlement contract
///         mint rights externally — out of scope here (see docs/Marketplace_Redeem_Feature.md
///         Phase 3d: which specific collection contract backs "official" redemptions is a
///         deployment-time decision, not something this settlement contract prescribes).
interface IMintableERC721 {
    function mint(address to, uint256 tokenId) external;
}

/// @title RedeemNftSettlement — NFT-leg settlement for the Redeem catalog (merch reuses RwaEscrow
///        directly instead — see plan doc, no separate contract needed for that leg)
/// @notice Mirrors NftMarketplace.sol's EIP-712 signed-order pattern: the catalog curator (Admin
///         or a Partner holding PARTNER_REDEEM_ROLE) signs a RedeemOffer off-chain; the buyer (or
///         anyone, on the buyer's behalf) submits it here to settle atomically. Up to 3 price legs
///         let one redemption combine JunoPts with other ERC20/KAP20 tokens (e.g. 900 PTS +
///         500000 CMM + 0.5 KUB in a single redeem).
/// @dev The JunoPts leg is BURNED (consumed loyalty points, not revenue). For Official-tier items
///      every other leg goes entirely to `treasury` (it's the platform's own inventory). For
///      Registered-tier items with a non-zero `payoutWallet` (the lister's own wallet), every other
///      leg splits PLATFORM_FEE_BPS to `treasury` and the remainder to `payoutWallet` — a Registered
///      partner's items must have a payout destination, not just a flat platform cut. A Registered
///      offer with a zero payoutWallet falls back to the Official behavior (100% to treasury).
///      The operator's curator status is checked live against PermissionRegistry at redemption
///      time, not just validity at signing time — if a partner's redeem rights are revoked between
///      signing and redemption, the offer stops working.
contract RedeemNftSettlement is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Tier {
        Official,
        Registered
    }

    struct PriceLeg {
        address token; // address(0) = unused slot
        uint256 amount;
    }

    struct RedeemOffer {
        uint256 itemId; // off-chain catalog item id — indexing/audit only, not enforced here
        address operator; // curator who signed this offer; must hold Admin or PARTNER_REDEEM_ROLE
        address buyer;
        address nftContract;
        uint256 tokenId;
        Tier tier;
        address payoutWallet; // Registered tier only — must be address(0) for Official offers
        PriceLeg[3] legs; // up to 3 combined price legs; unused slots have token == address(0)
        uint256 nonce;
        uint256 expiry;
    }

    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10% — Registered-tier cut of every non-PTS leg
    uint256 private constant BPS_DENOMINATOR = 10000;

    bytes32 private constant PRICE_LEG_TYPEHASH = keccak256("PriceLeg(address token,uint256 amount)");
    bytes32 private constant REDEEM_OFFER_TYPEHASH = keccak256(
        "RedeemOffer(uint256 itemId,address operator,address buyer,address nftContract,uint256 tokenId,uint8 tier,address payoutWallet,PriceLeg[3] legs,uint256 nonce,uint256 expiry)PriceLeg(address token,uint256 amount)"
    );

    PermissionRegistry public immutable registry;
    JunoPts public immutable junoPts;
    address public treasury;

    mapping(bytes32 => bool) public redeemed; // offerHash => consumed

    event NftRedeemed(
        bytes32 indexed offerHash,
        uint256 indexed itemId,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        Tier tier
    );
    event RegisteredLegSettled(
        bytes32 indexed offerHash, address indexed token, address indexed payoutWallet, uint256 toPayout, uint256 toTreasury
    );
    event TreasuryUpdated(address indexed treasury);

    constructor(address _registry, address _junoPts, address _treasury, address _owner)
        EIP712("JunoRedeemNftSettlement", "1")
        Ownable2Step()
    {
        require(
            _registry != address(0) && _junoPts != address(0) && _treasury != address(0) && _owner != address(0),
            "zero address"
        );
        registry = PermissionRegistry(_registry);
        junoPts = JunoPts(_junoPts);
        treasury = _treasury;
        _transferOwnership(_owner);
    }

    /// @notice Canonical offer id — matches the backend's redemption row primary key and the
    ///         `redeemed` mapping key. Distinct from `offerDigest`, same reasoning as
    ///         NftMarketplace.sol's hashOrder vs orderDigest split.
    function hashOffer(RedeemOffer calldata offer) public pure returns (bytes32) {
        return keccak256(abi.encode(offer));
    }

    function offerDigest(RedeemOffer calldata offer) public view returns (bytes32) {
        return _hashTypedDataV4(_structHash(offer));
    }

    function _structHash(RedeemOffer calldata offer) private pure returns (bytes32) {
        bytes32 legsHash = keccak256(
            abi.encodePacked(_legHash(offer.legs[0]), _legHash(offer.legs[1]), _legHash(offer.legs[2]))
        );
        return keccak256(
            abi.encode(
                REDEEM_OFFER_TYPEHASH,
                offer.itemId,
                offer.operator,
                offer.buyer,
                offer.nftContract,
                offer.tokenId,
                uint8(offer.tier),
                offer.payoutWallet,
                legsHash,
                offer.nonce,
                offer.expiry
            )
        );
    }

    function _legHash(PriceLeg calldata leg) private pure returns (bytes32) {
        return keccak256(abi.encode(PRICE_LEG_TYPEHASH, leg.token, leg.amount));
    }

    function redeem(RedeemOffer calldata offer, bytes calldata signature) external nonReentrant whenNotPaused {
        bytes32 offerHash = hashOffer(offer);

        require(block.timestamp <= offer.expiry, "offer expired");
        require(!redeemed[offerHash], "offer already redeemed");
        require(offer.tier == Tier.Registered || offer.payoutWallet == address(0), "payoutWallet only for Registered");

        address signer = ECDSA.recover(offerDigest(offer), signature);
        require(signer == offer.operator, "bad signature");

        // Live check, not signing-time: a curator's rights can be revoked after signing.
        require(
            registry.isAdmin(offer.operator) || registry.isPartnerRedeem(offer.operator),
            "operator lost redeem-curator rights"
        );

        redeemed[offerHash] = true;

        // A Registered item with no payoutWallet set falls back to the Official 100%-to-treasury
        // split — e.g. a Registered-tier consignment item the platform itself is settling for.
        bool splitToPayout = offer.tier == Tier.Registered && offer.payoutWallet != address(0);

        for (uint256 i = 0; i < 3; i++) {
            PriceLeg calldata leg = offer.legs[i];
            if (leg.token == address(0) || leg.amount == 0) continue;
            if (leg.token == address(junoPts)) {
                junoPts.burnFrom(offer.buyer, leg.amount);
                continue;
            }
            IERC20 token = IERC20(leg.token);
            if (splitToPayout) {
                uint256 fee = (leg.amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
                uint256 toPayout = leg.amount - fee;
                token.safeTransferFrom(offer.buyer, offer.payoutWallet, toPayout);
                if (fee > 0) token.safeTransferFrom(offer.buyer, treasury, fee);
                emit RegisteredLegSettled(offerHash, leg.token, offer.payoutWallet, toPayout, fee);
            } else {
                token.safeTransferFrom(offer.buyer, treasury, leg.amount);
            }
        }

        if (offer.tier == Tier.Official) {
            IMintableERC721(offer.nftContract).mint(offer.buyer, offer.tokenId);
        } else {
            IERC721(offer.nftContract).transferFrom(treasury, offer.buyer, offer.tokenId);
        }

        emit NftRedeemed(offerHash, offer.itemId, offer.buyer, offer.nftContract, offer.tokenId, offer.tier);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
