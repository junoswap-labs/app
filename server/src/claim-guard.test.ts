import { expect, test } from 'bun:test'
import { claim, settle } from './claim-guard'

const C = '0x' + '11'.repeat(32)
const CHAIN = 96

test('blocks a confirmed claim forever and a concurrent one while in flight', () => {
    const a = '0x1111111111111111111111111111111111111111'
    expect(claim(CHAIN, C, a)).toBeNull()
    expect(claim(CHAIN, C, a)).toBe('in-flight')
    settle(CHAIN, C, a, true)
    expect(claim(CHAIN, C, a)).toBe('already-relayed')
    // case-insensitive: a checksummed address must not slip past the same key
    expect(claim(CHAIN, C, a.toUpperCase().replace('0X', '0x'))).toBe('already-relayed')
    // ...but the same campaign/recipient on another chain is a distinct claim
    expect(claim(25925, C, a)).toBeNull()
})

test('a failed relay is retryable, and an abandoned in-flight entry expires', () => {
    const b = '0x2222222222222222222222222222222222222222'
    expect(claim(CHAIN, C, b)).toBeNull()
    settle(CHAIN, C, b, false)
    expect(claim(CHAIN, C, b)).toBeNull()

    const c = '0x3333333333333333333333333333333333333333'
    expect(claim(CHAIN, C, c, 0)).toBeNull()
    expect(claim(CHAIN, C, c, 59_000)).toBe('in-flight')
    expect(claim(CHAIN, C, c, 61_000)).toBeNull()
})
