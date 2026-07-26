import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // contracts/ is a separate Foundry project (its own `forge test` runner) — contracts/lib/
        // vendors openzeppelin-contracts' full source, including its own Hardhat/Truffle test
        // suite (*.test.js using require('@openzeppelin/test-helpers')/artifacts.require), which
        // is not runnable under Vitest and was never meant to be part of this test suite.
        exclude: ['**/node_modules/**', 'contracts/**'],
    },
})
