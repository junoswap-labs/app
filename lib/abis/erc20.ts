// Minimal ERC20 slice — allowance/approve for the RWA (and Redeem merch) fund flow, balanceOf
// for live balance checks on the redeem detail page, and decimals/symbol for looking up an
// arbitrary token address (Airdrop lets a creator give away any ERC20, not just the allow-listed
// marketplace payment tokens in lib/tokens.ts).
export const erc20Abi = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
    { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
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
] as const

// Bitkub Chain's official KAP20 token template (e.g. KUSDT) doesn't implement the standard
// `allowance(owner,spender)` name at all — only this plural getter. transfer/transferFrom/approve
// are standard-named there, so this is the only fallback needed; see lib/onchain/erc20.ts.
export const kap20AllowancesAbi = [
    {
        type: 'function',
        name: 'allowances',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
    },
] as const
