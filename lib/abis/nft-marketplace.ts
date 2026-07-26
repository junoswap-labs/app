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
