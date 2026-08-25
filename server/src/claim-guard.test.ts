import { expect, test } from 'bun:test'
import { claim, settle } from './claim-guard'

const C = '0x' + '11'.repeat(32)

test('blocks a confirmed claim forever and a concurrent one while in flight', () => {
    const a = '0x1111111111111111111111111111111111111111'
    expect(claim(C, a)).toBeNull()
    expect(claim(C, a)).toBe('in-flight')
    settle(C, a, true)
    expect(claim(C, a)).toBe('already-relayed')
    // case-insensitive: a checksummed address must not slip past the same key
    expect(claim(C, a.toUpperCase().replace('0X', '0x'))).toBe('already-relayed')
})

test('a failed relay is retryable, and an abandoned in-flight entry expires', () => {
    const b = '0x2222222222222222222222222222222222222222'
    expect(claim(C, b)).toBeNull()
    settle(C, b, false)
    expect(claim(C, b)).toBeNull()

    const c = '0x3333333333333333333333333333333333333333'
    expect(claim(C, c, 0)).toBeNull()
    expect(claim(C, c, 59_000)).toBe('in-flight')
    expect(claim(C, c, 61_000)).toBeNull()
})
