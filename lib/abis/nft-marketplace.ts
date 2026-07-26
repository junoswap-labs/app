// Event-only slice of NftMarketplace.sol — all the sync poller reads (services/sync/poller.ts).
// Extracted from contracts/out/NftMarketplace.sol/NftMarketplace.json, not hand-typed.
export const nftMarketplaceEventsAbi = [
    {
        type: 'event',
        name: 'OrderFulfilled',
        inputs: [
            { name: 'orderHash', type: 'bytes32', indexed: true },
            { name: 'seller', type: 'address', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'nftContract', type: 'address', indexed: false },
            { name: 'tokenId', type: 'uint256', indexed: false },
            { name: 'paymentToken', type: 'address', indexed: false },
            { name: 'price', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OrderCancelled',
        inputs: [
            { name: 'orderHash', type: 'bytes32', indexed: true },
            { name: 'seller', type: 'address', indexed: true },
        ],
        anonymous: false,
    },
] as const

const orderTuple = {
    type: 'tuple',
    name: 'order',
    components: [
        { name: 'seller', type: 'address' },
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'paymentToken', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
} as const

// Function slice used by the real write hooks (hooks/useFulfillNftOrder.ts, useCancelNftOrder.ts).
export const nftMarketplaceAbi = [
    ...nftMarketplaceEventsAbi,
    {
        type: 'function',
        name: 'fulfillOrder',
        stateMutability: 'nonpayable',
        inputs: [orderTuple, { name: 'signature', type: 'bytes' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'cancelOrder',
        stateMutability: 'nonpayable',
        inputs: [orderTuple],
        outputs: [],
    },
    {
        type: 'function',
        name: 'cancelledOrFilled',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [{ type: 'bool' }],
    },
] as const

// Admin-only slice — used by the Admin Settings panel (components/admin/marketplace-settings.tsx).
// Ownable2Step's owner() is a DIFFERENT admin concept from PermissionRegistry's Admin role — the
// UI checks both, since a PermissionRegistry admin isn't necessarily this contract's owner.
export const nftMarketplaceAdminAbi = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
    { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'feeCollector', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'MAX_FEE_BPS', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    {
        type: 'function',
        name: 'allowedPaymentTokens',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'setFeeBps',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'bps', type: 'uint256' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'setFeeCollector',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'collector', type: 'address' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'setAllowedPaymentToken',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'allowed', type: 'bool' },
        ],
        outputs: [],
    },
    { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const
