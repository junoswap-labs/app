/**
 * Read-only export of an ERC721 collection's current ownership snapshot from KUB mainnet, for
 * seeding a realistic testnet clone (contract + tokenIds + tokenURIs + owners, capped per owner).
 *
 * This script ONLY fetches mainnet data and writes it to CSV — it does NOT deploy, mint, or write
 * anything to testnet or anywhere on-chain. Actually cloning the collection onto testnet (deploying
 * a contract, minting each token, setting tokenURIs) is a separate, manual step you run yourself
 * using this CSV as input.
 *
 * Usage:
 *   bun run scripts/clone-nft-collection.ts [--contract=0x...] [--from-block=N] [--max-per-owner=3] [--out=path.csv]
 *
 * `--from-block` defaults to 0 (scans the entire chain history for this contract), which can be
 * slow and RPC-heavy on a long-lived chain. For a much faster run, look up the collection's actual
 * deployment/creation block on https://www.kubscan.com/address/<contract> and pass it explicitly.
 *
 * Ownership is derived by replaying every Transfer event in order (no ERC721Enumerable assumed) —
 * works for any standard ERC721, mirrors the same getLogs-chunking approach as
 * services/sync/poller.ts. getLogs works fine on KUB's non-archive RPC even though historical
 * eth_call does not (see CLAUDE.md's Notes section).
 */
import { createPublicClient, http, parseAbiItem, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { bitkub } from '@/lib/wagmi'
import { erc721Abi } from '@/lib/abis/erc721'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_COLLECTION = '0x2F022D4Ef37847304eCd167303aeaA9699F73663' as Address // CM Hexa Cat Meaw
const DEFAULT_OUT = 'scripts/output/nft-collection-clone.csv'
const BLOCK_CHUNK = 5_000n
const TOKEN_URI_BATCH_SIZE = 100
const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000
// wagmi/chains' `bitkub` entry has no `contracts.multicall3` set, so viem can't infer this on
// its own — pass the standard deterministic-deployer address explicitly (confirmed deployed on
// KUB mainnet via eth_getCode).
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

// rpc.bitkubchain.io's public endpoint intermittently drops requests under sustained load
// (returns an empty/unparseable body rather than a JSON-RPC error). Exponential backoff with
// jitter smooths over that without hammering it right back into the same failure.
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn()
        } catch (err) {
            if (attempt >= MAX_RETRIES) throw err
            const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250
            const message = err instanceof Error ? err.message : String(err)
            console.warn(`  ...${label} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${Math.round(delay)}ms: ${message}`)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
}

// Same backoff as withRetry, but never gives up. Used only for getLogs: skipping a chunk there
// would silently produce a wrong current-owner snapshot for any token whose last transfer fell in
// that range, and every failure observed from this endpoint has self-resolved on a later attempt
// (confirmed by re-querying failed ranges directly — they succeed immediately from a fresh
// connection), so it's always correct to keep waiting rather than give up.
async function withUnboundedRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn()
        } catch (err) {
            const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS) + Math.random() * 250
            const message = err instanceof Error ? err.message : String(err)
            console.warn(`  ...${label} failed (attempt ${attempt}), retrying in ${Math.round(delay)}ms: ${message}`)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
}

interface Args {
    contract: Address
    fromBlock: bigint
    maxPerOwner: number
    out: string
}

function parseArgs(): Args {
    const flags = new Map<string, string>()
    for (const arg of process.argv.slice(2)) {
        const match = arg.match(/^--([a-z-]+)=(.*)$/)
        if (match) flags.set(match[1]!, match[2]!)
    }
    return {
        contract: (flags.get('contract') ?? DEFAULT_COLLECTION) as Address,
        fromBlock: BigInt(flags.get('from-block') ?? '0'),
        maxPerOwner: Number(flags.get('max-per-owner') ?? '3'),
        out: flags.get('out') ?? DEFAULT_OUT,
    }
}

function toCsvField(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
}

async function main() {
    const args = parseArgs()
    const rpcUrl = process.env.MAINNET_KUB_RPC_URL || bitkub.rpcUrls.default.http[0]
    const client = createPublicClient({ chain: bitkub, transport: http(rpcUrl, { batch: true }) })

    console.log(`Collection: ${args.contract}`)
    console.log(`RPC: ${rpcUrl}`)
    console.log(`Scanning Transfer events from block ${args.fromBlock}...`)

    const collectionName = await withRetry('name()', () =>
        client.readContract({ address: args.contract, abi: erc721Abi, functionName: 'name' })
    ).catch(() => '(name() reverted or not implemented)')
    console.log(`Contract name(): ${collectionName}`)

    const latestBlock = await withRetry('getBlockNumber', () => client.getBlockNumber())
    const transferEvent = parseAbiItem(
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
    )

    // tokenId (as string, since bigint isn't a valid Map key across JSON round-trips) -> current owner.
    // Replayed strictly in block/logIndex order; a transfer to the zero address means the token was
    // burned and is removed from the live set entirely.
    const ownerOf = new Map<string, Address>()

    let fromBlock = args.fromBlock
    let chunksScanned = 0
    while (fromBlock <= latestBlock) {
        const toBlock = fromBlock + BLOCK_CHUNK < latestBlock ? fromBlock + BLOCK_CHUNK : latestBlock
        const logs = await withUnboundedRetry(`getLogs(${fromBlock}-${toBlock})`, () =>
            client.getLogs({
                address: args.contract,
                event: transferEvent,
                fromBlock,
                toBlock,
            })
        )
        for (const log of logs) {
            const { to, tokenId } = log.args
            if (to === undefined || tokenId === undefined) continue
            const key = tokenId.toString()
            if (to.toLowerCase() === zeroAddress) ownerOf.delete(key)
            else ownerOf.set(key, to)
        }
        chunksScanned += 1
        if (chunksScanned % 20 === 0 || toBlock === latestBlock) {
            console.log(`  ...scanned up to block ${toBlock} (${ownerOf.size} live tokens so far)`)
        }
        fromBlock = toBlock + 1n
    }

    console.log(`Found ${ownerOf.size} currently-owned tokens. Fetching tokenURI() for each...`)

    const tokenIds = Array.from(ownerOf.keys()).map((k) => BigInt(k))
    const tokenUriOf = new Map<string, string>()
    for (let i = 0; i < tokenIds.length; i += TOKEN_URI_BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + TOKEN_URI_BATCH_SIZE)
        const results = await withRetry(`multicall tokenURI batch ${i}`, () =>
            client.multicall({
                multicallAddress: MULTICALL3_ADDRESS,
                contracts: batch.map((tokenId) => ({
                    address: args.contract,
                    abi: erc721Abi,
                    functionName: 'tokenURI' as const,
                    args: [tokenId] as const,
                })),
            })
        )
        batch.forEach((tokenId, idx) => {
            const result = results[idx]
            tokenUriOf.set(tokenId.toString(), result?.status === 'success' ? (result.result as string) : '')
        })
        console.log(`  ...resolved tokenURI for ${Math.min(i + TOKEN_URI_BATCH_SIZE, tokenIds.length)}/${tokenIds.length} tokens`)
    }

    // Group by owner, sort each owner's tokens ascending by tokenId for determinism, then flag
    // anything past maxPerOwner as turnover (excess supply to hand back to the dev team rather
    // than clone 1:1 onto testnet).
    const byOwner = new Map<Address, bigint[]>()
    for (const tokenId of tokenIds) {
        const owner = ownerOf.get(tokenId.toString())!
        const list = byOwner.get(owner) ?? []
        list.push(tokenId)
        byOwner.set(owner, list)
    }

    const rows: { tokenId: bigint; owner: Address; tokenUri: string; turnover: boolean }[] = []
    for (const [owner, owned] of byOwner) {
        owned.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        owned.forEach((tokenId, idx) => {
            rows.push({
                tokenId,
                owner,
                tokenUri: tokenUriOf.get(tokenId.toString()) ?? '',
                turnover: idx >= args.maxPerOwner,
            })
        })
    }
    rows.sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0))

    const turnoverCount = rows.filter((r) => r.turnover).length
    const header = 'tokenId,owner,tokenURI,turnover\n'
    const body = rows
        .map((r) => [r.tokenId.toString(), r.owner, toCsvField(r.tokenUri), r.turnover ? 'yes' : 'no'].join(','))
        .join('\n')

    mkdirSync(dirname(args.out), { recursive: true })
    writeFileSync(args.out, header + body + '\n', 'utf8')

    console.log('')
    console.log(`Wrote ${rows.length} rows to ${args.out}`)
    console.log(`  ${byOwner.size} unique owners`)
    console.log(`  ${turnoverCount} tokens flagged turnover=yes (owner holds more than ${args.maxPerOwner})`)
    console.log('')
    console.log('This CSV is fetch-only output. Deploying the testnet contract and minting/assigning')
    console.log('these tokens is a separate step you run yourself.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
