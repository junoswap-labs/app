// Slice of PermissionRegistry.sol actually used by the frontend/server — role checks via the
// convenience getters (isAdmin/isPartnerMarketplace/isPartnerRedeem/isAuthorized) rather than
// computing role hashes client-side; grantRole/revokeRole + the role-constant getters for the
// admin approve/revoke UI, which does need the raw role hash to pass as an argument.
export const permissionRegistryAbi = [
    {
        type: 'function',
        name: 'isAdmin',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'isPartnerMarketplace',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'isPartnerRedeem',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'isAuthorized',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'DEFAULT_ADMIN_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'PARTNER_MARKETPLACE_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'PARTNER_REDEEM_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
    {
        type: 'function',
        name: 'AUTHORIZE_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
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
