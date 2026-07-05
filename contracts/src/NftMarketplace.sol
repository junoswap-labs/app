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

/// @title NftMarketplace — gasless-listing NFT marketplace (Seaport/Wyvern-style)
/// @notice The contract never custodies NFTs. Sellers sign an Order off-chain (no gas);
///         settlement happens atomically when a buyer fulfils. The signed order is the
///         source of truth — listings live in the backend DB only for discovery.
contract NftMarketplace is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Order {
        address seller;
        address nftContract;
        uint256 tokenId;
        address paymentToken;
        uint256 price;
        uint256 nonce; // seller-chosen random salt, NOT sequential — only disambiguates otherwise-identical listings
        uint256 expiry;
    }

    // EIP-712 struct typehash. Field order/types must match `Order` exactly or signatures won't verify.
    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nftContract,uint256 tokenId,address paymentToken,uint256 price,uint256 nonce,uint256 expiry)"
    );

    uint256 public constant MAX_FEE_BPS = 1000; // 10% hard cap — owner can never set fee above this
    uint256 private constant BPS_DENOMINATOR = 10000;

    mapping(bytes32 => bool) public cancelledOrFilled; // orderHash => consumed
    mapping(address => bool) public allowedPaymentTokens;
    uint256 public feeBps;
    address public feeCollector;

    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price,
        uint256 fee
    );
    event OrderCancelled(bytes32 indexed orderHash, address indexed seller);
    event PaymentTokenAllowed(address indexed token, bool allowed);
    event FeeBpsUpdated(uint256 feeBps);
    event FeeCollectorUpdated(address indexed feeCollector);

    constructor(uint256 _feeBps, address _feeCollector) EIP712("JunoswapMarketplace", "1") {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        require(_feeCollector != address(0), "zero feeCollector");
        feeBps = _feeBps;
        feeCollector = _feeCollector;
    }

    /// @notice Canonical order id used as the `cancelledOrFilled` key and emitted in events.
    /// @dev Matches the backend `nft_orders.order_hash` primary key and the frontend route param:
    ///      keccak256(abi.encode(order)) over the 7 struct fields (NOT the EIP-712 digest).
    ///      Frontend/backend must replicate this exact encoding.
    function hashOrder(Order calldata order) public pure returns (bytes32) {
        return keccak256(abi.encode(order));
    }

    /// @notice EIP-712 digest the seller actually signs. Distinct from `hashOrder`:
    ///         this binds chainId + verifyingContract via the domain separator (replay protection).
    function orderDigest(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(_structHash(order));
    }

    function _structHash(Order calldata order) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.seller,
                order.nftContract,
                order.tokenId,
                order.paymentToken,
                order.price,
                order.nonce,
                order.expiry
            )
        );
    }

    function fulfillOrder(Order calldata order, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        bytes32 orderHash = hashOrder(order);

        require(block.timestamp <= order.expiry, "order expired");
        require(!cancelledOrFilled[orderHash], "order inactive");
        require(allowedPaymentTokens[order.paymentToken], "payment token not allowed");

        // Verify the seller actually signed this exact order.
        address signer = ECDSA.recover(orderDigest(order), signature);
        require(signer == order.seller, "bad signature");

        // Reject a stale signature whose NFT the seller no longer holds.
        require(
            IERC721(order.nftContract).ownerOf(order.tokenId) == order.seller,
            "seller not owner"
        );

        // Effects before interactions: consume the order so a reentrant/racing call can't double-fill.
        cancelledOrFilled[orderHash] = true;

        uint256 fee = (order.price * feeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = order.price - fee;

        IERC20 pay = IERC20(order.paymentToken);
        if (fee > 0) {
            pay.safeTransferFrom(msg.sender, feeCollector, fee);
        }
        pay.safeTransferFrom(msg.sender, order.seller, sellerProceeds);

        // Relies on the seller's setApprovalForAll(marketplace, true) set at list time.
        IERC721(order.nftContract).transferFrom(order.seller, msg.sender, order.tokenId);

        emit OrderFulfilled(
            orderHash,
            order.seller,
            msg.sender,
            order.nftContract,
            order.tokenId,
            order.paymentToken,
            order.price,
            fee
        );
    }

    /// @notice On-chain cancel is mandatory: delisting only in the DB leaves the signature
    ///         redeemable forever, so cancellation must invalidate it on-chain.
    function cancelOrder(Order calldata order) external {
        require(msg.sender == order.seller, "not seller");
        bytes32 orderHash = hashOrder(order);
        require(!cancelledOrFilled[orderHash], "order inactive");
        cancelledOrFilled[orderHash] = true;
        emit OrderCancelled(orderHash, order.seller);
    }

    function setAllowedPaymentToken(address token, bool allowed) external onlyOwner {
        allowedPaymentTokens[token] = allowed;
        emit PaymentTokenAllowed(token, allowed);
    }

    function setFeeBps(uint256 bps) external onlyOwner {
        require(bps <= MAX_FEE_BPS, "fee too high");
        feeBps = bps;
        emit FeeBpsUpdated(bps);
    }

    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "zero feeCollector");
        feeCollector = collector;
        emit FeeCollectorUpdated(collector);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
