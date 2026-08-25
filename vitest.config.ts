import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // contracts/ is a separate Foundry project (its own `forge test` runner) — contracts/lib/
        // vendors openzeppelin-contracts' full source, including its own Hardhat/Truffle test
        // suite (*.test.js using require('@openzeppelin/test-helpers')/artifacts.require), which
        // is not runnable under Vitest and was never meant to be part of this test suite.
        // server/ is likewise a separate deployable with its own runner — its tests import
        // `bun:test`, which Vitest can't resolve (run them with `bun test` inside server/).
        exclude: ['**/node_modules/**', 'contracts/**', 'server/**'],
    },
})
