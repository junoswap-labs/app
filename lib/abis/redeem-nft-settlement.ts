// Event-only slice of RedeemNftSettlement.sol — all the sync poller reads (services/sync/poller.ts).
export const redeemNftSettlementEventsAbi = [
    {
        type: 'event',
        name: 'NftRedeemed',
        inputs: [
            { name: 'offerHash', type: 'bytes32', indexed: true },
            { name: 'itemId', type: 'uint256', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'nftContract', type: 'address', indexed: false },
            { name: 'tokenId', type: 'uint256', indexed: false },
            { name: 'tier', type: 'uint8', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RegisteredLegSettled',
        inputs: [
            { name: 'offerHash', type: 'bytes32', indexed: true },
            { name: 'token', type: 'address', indexed: true },
            { name: 'payoutWallet', type: 'address', indexed: true },
            { name: 'toPayout', type: 'uint256', indexed: false },
            { name: 'toTreasury', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
] as const

const priceLegTuple = {
    type: 'tuple[3]',
    name: 'legs',
    components: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
} as const

const redeemOfferTuple = {
    type: 'tuple',
    name: 'offer',
    components: [
        { name: 'itemId', type: 'uint256' },
        { name: 'operator', type: 'address' },
        { name: 'buyer', type: 'address' },
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'tier', type: 'uint8' },
        { name: 'payoutWallet', type: 'address' },
        priceLegTuple,
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
} as const

// Function slice used by the real write hook (hooks/useRedeemNft.ts) and the operator-side signing
// helper that builds/signs offers off-chain (services/marketplace/redeem-offer.ts).
export const redeemNftSettlementAbi = [
    ...redeemNftSettlementEventsAbi,
    {
        type: 'function',
        name: 'redeem',
        stateMutability: 'nonpayable',
        inputs: [redeemOfferTuple, { name: 'signature', type: 'bytes' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'hashOffer',
        stateMutability: 'pure',
        inputs: [redeemOfferTuple],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'offerDigest',
        stateMutability: 'view',
        inputs: [redeemOfferTuple],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'redeemed',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [{ type: 'bool' }],
    },
    { type: 'function', name: 'treasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    {
        type: 'function',
        name: 'PLATFORM_FEE_BPS',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

// Admin-only slice — pause/setTreasury, Ownable2Step owner (a DIFFERENT admin concept from
// PermissionRegistry's Admin role, same reasoning as nft-marketplace.ts's admin ABI).
export const redeemNftSettlementAdminAbi = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
    {
        type: 'function',
        name: 'setTreasury',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_treasury', type: 'address' }],
        outputs: [],
    },
    { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const
