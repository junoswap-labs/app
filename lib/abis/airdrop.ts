// Event-only slice of AirdropEscrow.sol — all the sync poller reads (services/sync/poller.ts).
// Extracted from contracts/out/AirdropEscrow.sol/AirdropEscrow.json, not hand-typed.
export const airdropEscrowEventsAbi = [
    {
        type: 'event',
        name: 'CampaignCreated',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'token', type: 'address', indexed: true },
            { name: 'totalAmount', type: 'uint256', indexed: false },
            { name: 'amountMode', type: 'uint8', indexed: false },
            { name: 'fixedAmount', type: 'uint256', indexed: false },
            { name: 'minAmount', type: 'uint256', indexed: false },
            { name: 'maxAmount', type: 'uint256', indexed: false },
            { name: 'maxClaimants', type: 'uint32', indexed: false },
            { name: 'expiresAt', type: 'uint256', indexed: false },
            { name: 'gasMode', type: 'uint8', indexed: false },
            { name: 'gasDeposit', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'AirdropClaimed',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'recipient', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'submitter', type: 'address', indexed: false },
            { name: 'closesCampaign', type: 'bool', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'CampaignClosed',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'reason', type: 'uint8', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'CampaignReclaimed',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'GasReimbursed',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'relayer', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'GasReclaimed',
        inputs: [
            { name: 'campaignId', type: 'bytes32', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
] as const

// campaigns(id) isn't public on the contract — its auto-generated getter would explode the
// 15-field Campaign struct into that many individual return values, which hits Solidity's "stack
// too deep" limit. getCampaign() below returns the whole struct as one tuple instead.
const campaignTupleComponents = [
    { name: 'creator', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amountMode', type: 'uint8' },
    { name: 'fixedAmount', type: 'uint256' },
    { name: 'minAmount', type: 'uint256' },
    { name: 'maxAmount', type: 'uint256' },
    { name: 'totalAmount', type: 'uint256' },
    { name: 'remainingAmount', type: 'uint256' },
    { name: 'maxClaimants', type: 'uint32' },
    { name: 'claimedCount', type: 'uint32' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'status', type: 'uint8' },
    { name: 'gasMode', type: 'uint8' },
    { name: 'gasDeposit', type: 'uint256' },
    { name: 'gasSpent', type: 'uint256' },
] as const

// Function slice used by the real write hooks (hooks/useAirdropActions.ts) and read hooks
// (hooks/useAirdropCampaigns.ts).
export const airdropEscrowAbi = [
    ...airdropEscrowEventsAbi,
    {
        type: 'function',
        name: 'createCampaign',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: 'campaignId', type: 'bytes32' },
                    { name: 'token', type: 'address' },
                    { name: 'amountMode', type: 'uint8' },
                    { name: 'fixedAmount', type: 'uint256' },
                    { name: 'minAmount', type: 'uint256' },
                    { name: 'maxAmount', type: 'uint256' },
                    { name: 'totalAmount', type: 'uint256' },
                    { name: 'maxClaimants', type: 'uint32' },
                    { name: 'expiresAt', type: 'uint256' },
                    { name: 'gasMode', type: 'uint8' },
                    { name: 'gasDeposit', type: 'uint256' },
                ],
            },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'claim',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'campaignId', type: 'bytes32' },
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'claimAuthorizationDigest',
        stateMutability: 'view',
        inputs: [
            { name: 'campaignId', type: 'bytes32' },
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'claimFor',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'campaignId', type: 'bytes32' },
            { name: 'recipient', type: 'address' },
            { name: 'gasReimbursement', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'endCampaign',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'campaignId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'reclaim',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'campaignId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'reclaimGas',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'campaignId', type: 'bytes32' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'getCampaign',
        stateMutability: 'view',
        inputs: [{ name: 'campaignId', type: 'bytes32' }],
        outputs: [{ name: '', type: 'tuple', components: campaignTupleComponents }],
    },
    {
        type: 'function',
        name: 'claimed',
        stateMutability: 'view',
        inputs: [
            { name: '', type: 'bytes32' },
            { name: '', type: 'address' },
        ],
        outputs: [{ type: 'bool' }],
    },
    { type: 'function', name: 'creationFeeFlat', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'feeCollector', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'RELAYER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
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
] as const

// Admin-only slice — mirrors lib/abis/rwa-escrow.ts's rwaEscrowAdminAbi split.
export const airdropEscrowAdminAbi = [
    {
        type: 'function',
        name: 'DEFAULT_ADMIN_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    { type: 'function', name: 'RELAYER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
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
    { type: 'function', name: 'creationFeeFlat', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'feeCollector', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    {
        type: 'function',
        name: 'setCreationFeeFlat',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'fee', type: 'uint256' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'setFeeCollector',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'collector', type: 'address' }],
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
