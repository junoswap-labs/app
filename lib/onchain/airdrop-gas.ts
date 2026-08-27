// Measured via `forge test --gas-report` in contracts/ against testFixedClaimViaRelayer's
// claimFor() call (~144k gas) — rounded up for headroom. Duplicated in server/src/chain.ts since
// the relayer is a separate deployable with its own env, not a shared package; keep both in sync
// if AirdropEscrow.claimFor()'s logic changes enough to move the real cost.
export const CLAIM_FOR_GAS_UNITS = 145_000n

/**
 * Sizes a relayer-mode campaign's on-chain gas deposit: estimatedGas * 1.3 * maxClaimants. Simple
 * multiplication rather than a pre-flight `estimateContractGas` simulation, since there's no
 * campaign to simulate a claim against until after this same tx creates one.
 */
export function estimateAirdropGasDeposit(gasPriceWei: bigint, maxClaimants: number): bigint {
    return (CLAIM_FOR_GAS_UNITS * gasPriceWei * 13n * BigInt(maxClaimants)) / 10n
}
