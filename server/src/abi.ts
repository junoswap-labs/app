// Minimal slice of contracts/src/AirdropEscrow.sol — this service only ever calls claimFor() and
// reads getCampaign() to size/guard the gas reimbursement it requests in that same call.
export const claimForAbi = [
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
] as const

export const getCampaignAbi = [
    {
        type: 'function',
        name: 'getCampaign',
        stateMutability: 'view',
        inputs: [{ name: 'campaignId', type: 'bytes32' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
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
                ],
            },
        ],
    },
] as const
