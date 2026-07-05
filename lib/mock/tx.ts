// MOCK transaction stand-in. Real flow per CLAUDE.md clean workflow:
// writeContract → wait for receipt → POST /api/sync/refresh → invalidate queries →
// re-fetch status from Supabase (poll 2-3x on lag). Callers await this, then apply
// the mock store mutation that the poller would have written.
export function mockTx(ms = 1500): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
