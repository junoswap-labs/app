// Event-only slice of RwaEscrow.sol — all the sync poller reads (services/sync/poller.ts).
// Extracted from contracts/out/RwaEscrow.sol/RwaEscrow.json, not hand-typed.
export const rwaEscrowEventsAbi = [
    {
        type: 'event',
        name: 'RwaFunded',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'seller', type: 'address', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'paymentToken', type: 'address', indexed: false },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'fundedAt', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaShipped',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'shippedAt', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaCompleted',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'amountToSeller', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaAutoReleased',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'amountToSeller', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaRefunded',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaDisputeOpened',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'openedBy', type: 'address', indexed: true },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RwaDisputeResolved',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'releasedToSeller', type: 'bool', indexed: false },
        ],
        anonymous: false,
    },
] as const

// The per-deployment deadlines (constructor params, not hardcoded — see RwaEscrow.sol) — read once
// and cache (lib/server-cache.ts) rather than re-reading on every ship-deadline cron run.
export const rwaEscrowDeadlinesAbi = [
    { type: 'function', name: 'SHIP_DEADLINE', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    {
        type: 'function',
        name: 'AUTO_RELEASE_DEADLINE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'EXTENSION_PERIOD',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

// Function slice used by the real write hooks (hooks/useFundRwaOrder.ts, useMarkShipped.ts, etc).
export const rwaEscrowAbi = [
    ...rwaEscrowEventsAbi,
    ...rwaEscrowDeadlinesAbi,
    {
        type: 'function',
        name: 'fund',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'listingId', type: 'bytes32' },
            { name: 'seller', type: 'address' },
            { name: 'paymentToken', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'markShipped',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'confirmReceived',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'claimRefund',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'openDispute',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'resolveDispute',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'listingId', type: 'bytes32' },
            { name: 'releaseToSeller', type: 'bool' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'claimShipmentTimeout',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'extendAutoRelease',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'listingId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'autoReleaseExtension',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        // Not in rwaEscrowEventsAbi (the poller's getLogs filter) — the extension is read live via
        // autoReleaseExtension() above rather than mirrored into a DB column, so it doesn't need a
        // sync handler. Kept here only so a frontend hook could watch it if ever useful.
        type: 'event',
        name: 'AutoReleaseExtended',
        inputs: [
            { name: 'listingId', type: 'bytes32', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'extendedBy', type: 'uint256', indexed: false },
            { name: 'newDeadline', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'function',
        name: 'orders',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [
            { name: 'seller', type: 'address' },
            { name: 'buyer', type: 'address' },
            { name: 'paymentToken', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'status', type: 'uint8' },
            { name: 'fundedAt', type: 'uint256' },
            { name: 'shippedAt', type: 'uint256' },
        ],
    },
    {
        type: 'function',
        name: 'allowedPaymentTokens',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    { type: 'function', name: 'ARBITRATOR_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    { type: 'function', name: 'TOKEN_MANAGER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    {
        type: 'function',
        name: 'hasRole',
        stateMutability: 'view',
        inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' },
        ],
        outputs: [{ type: 'bool' }],
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
] as const

// Admin-only slice — used by the Admin Settings panel. AccessControl's DEFAULT_ADMIN_ROLE (read
// via hasRole above) is a DIFFERENT admin concept from PermissionRegistry's Admin role — the UI
// checks both, since a PermissionRegistry admin isn't necessarily this contract's admin.
export const rwaEscrowAdminAbi = [
    {
        type: 'function',
        name: 'DEFAULT_ADMIN_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    { type: 'function', name: 'ARBITRATOR_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    { type: 'function', name: 'TOKEN_MANAGER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    {
        type: 'function',
        name: 'hasRole',
        stateMutability: 'view',
        inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' },
        ],
        outputs: [{ type: 'bool' }],
    },
    { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
    { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'feeCollector', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'MAX_FEE_BPS', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
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
    {
        type: 'function',
        name: 'grantRole',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'revokeRole',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' },
        ],
        outputs: [],
    },
] as const
