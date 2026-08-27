// Minimal JunoPts slice used by the frontend — see contracts/src/JunoPts.sol. Ordinary
// transfer/transferFrom require both parties to hold PermissionRegistry's AUTHORIZE_ROLE, so this
// is effectively "untransferable except to Registered parties" by default (the project's answer to
// wanting a loyalty-points token that isn't freely tradable). `approve` + `burn`/`burnFrom` are the
// only writes the Redeem flows need: the merch (RwaEscrow) leg has the buyer self-burn their own
// Points balance directly; the NFT (RedeemNftSettlement) leg needs an allowance so that contract
// can burnFrom on the buyer's behalf inside redeem().
export const junoPtsAbi = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'burn',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    // Admin panel only (components/admin/junopts-mint.tsx): mint() is onlyRole(MINTER_ROLE), and
    // MINTER_ROLE is granted by the DEFAULT_ADMIN_ROLE holder — the deployer/ADMIN does NOT hold it
    // by default (JunoPts.sol's constructor only self-grants admin + committee).
    {
        type: 'function',
        name: 'MINTER_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
    },
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
        name: 'mint',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        type: 'event',
        name: 'Transfer',
        inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
        ],
        anonymous: false,
    },
] as const
