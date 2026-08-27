import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain, isPartnerRedeemOnChain } from '@/lib/onchain/roles'
import { serverPublicClient, redeemOperatorWalletClient } from '@/lib/onchain/public-client'
import { erc721Abi } from '@/lib/abis/erc721'
import { redeemNftSettlementAbi } from '@/lib/abis/redeem-nft-settlement'
import { rwaEscrowAbi } from '@/lib/abis/rwa-escrow'
import { supabaseAdmin } from '@/lib/supabase/server'
import { parseBaseUnitsAmount } from '@/lib/amount'
import type { RedeemItemVariant, RedeemKind, RedeemTier } from '@/types/redeem'
import { isAppHostedImageUrl } from '@/lib/image'
import { getContractAddresses } from '@/config/contract-addresses'
import { parseChainId, InvalidChainError } from '@/lib/onchain/request-chain'

// Public browsing (published items only) reads straight from Supabase via the browser client —
// same convention as rwa_listings/collections (public-read RLS policy, see
// supabase/migrations/0008_redeem_schema.sql). This route handles the lister's own item list
// (including drafts) and creating a new listing, both of which need either a live on-chain role
// check or a wallet-scoped query the public-read policy doesn't allow.

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    let chainId: number
    try {
        chainId = parseChainId(request)
    } catch (err) {
        if (err instanceof InvalidChainError) return NextResponse.json({ error: err.message }, { status: 400 })
        throw err
    }

    const { data, error } = await supabaseAdmin()
        .from('redeem_items')
        .select('*, redeem_item_variants(*)')
        .eq('lister_wallet', wallet)
        .eq('chain_id', chainId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

interface VariantInput {
    label: string
    sku?: string
    stock?: number | null
}

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)

    let chainId: number
    try {
        chainId = parseChainId(request, body?.chainId)
    } catch (err) {
        if (err instanceof InvalidChainError) return NextResponse.json({ error: err.message }, { status: 400 })
        throw err
    }

    const tier = body?.tier as RedeemTier
    const kind = body?.kind as RedeemKind
    if (tier !== 'official' && tier !== 'registered') {
        return NextResponse.json({ error: 'tier must be "official" or "registered"' }, { status: 400 })
    }
    if (kind !== 'nft' && kind !== 'merch') {
        return NextResponse.json({ error: 'kind must be "nft" or "merch"' }, { status: 400 })
    }

    // Step 1.1 gate: Official items require the Admin role; Registered items require the
    // partner-redeem application to have been approved on-chain (PermissionRegistry.PARTNER_REDEEM_ROLE).
    const addr = wallet as `0x${string}`
    const authorized = tier === 'official' ? await isAdminOnChain(addr) : await isPartnerRedeemOnChain(addr)
    if (!authorized) {
        return NextResponse.json(
            {
                error:
                    tier === 'official'
                        ? 'Official listings require the Admin role'
                        : 'Registered listings require an approved Partner (Redeem) application — see /app/partner/apply',
            },
            { status: 403 }
        )
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const imageUrls = Array.isArray(body?.image_urls)
        ? body.image_urls.filter((u: unknown): u is string => typeof u === 'string' && isAppHostedImageUrl(u))
        : []
    // price_points / payment_amount are base units (18-decimal, like any ERC20) — the request body
    // must already send them pre-scaled (parseUnits on the client), same convention as
    // nft_orders.price / rwa_orders.amount elsewhere in this codebase.
    const pricePoints = parseBaseUnitsAmount(body?.price_points ?? '0')
    const paymentToken = typeof body?.payment_token === 'string' && body.payment_token ? body.payment_token.toLowerCase() : null
    const paymentTokenSymbol = typeof body?.payment_token_symbol === 'string' ? body.payment_token_symbol : null
    const paymentAmount = body?.payment_amount != null ? parseBaseUnitsAmount(body.payment_amount) : null
    if (pricePoints === null) {
        return NextResponse.json({ error: 'price_points must be a non-negative base-units integer string' }, { status: 400 })
    }
    if (paymentToken && (!paymentTokenSymbol || paymentAmount === null)) {
        return NextResponse.json(
            { error: 'payment_token requires payment_token_symbol and a non-negative base-units payment_amount' },
            { status: 400 }
        )
    }

    // STEP 1.3 — publish/redeem-window dates. An item with no publish_at (or one already in the
    // past) goes live immediately; scheduling a future publish_at is stored but a cron/backend job
    // to flip draft -> published at that time doesn't exist yet — see docs/Marketplace_Redeem_Feature.md.
    const maxPerWallet = body?.max_per_wallet != null ? Number(body.max_per_wallet) : null
    if (maxPerWallet != null && (!Number.isInteger(maxPerWallet) || maxPerWallet < 1)) {
        return NextResponse.json({ error: 'max_per_wallet must be a positive integer or null (unlimited)' }, { status: 400 })
    }

    const publishAt = typeof body?.publish_at === 'string' && body.publish_at ? body.publish_at : null
    const redeemStartAt = typeof body?.redeem_start_at === 'string' && body.redeem_start_at ? body.redeem_start_at : null
    const redeemEndAt = typeof body?.redeem_end_at === 'string' && body.redeem_end_at ? body.redeem_end_at : null
    const status = !publishAt || new Date(publishAt).getTime() <= Date.now() ? 'published' : 'draft'

    // Registered-tier proceeds route to the lister's own wallet (minus the 10% platform fee) —
    // default to the connected wallet, but allow overriding to e.g. a company treasury address.
    const payoutWallet =
        tier === 'registered'
            ? typeof body?.payout_wallet === 'string' && body.payout_wallet
                ? body.payout_wallet.toLowerCase()
                : wallet
            : null

    let nftContract: string | null = null
    let nftTokenId: string | null = null
    let stock: number | null = null
    let variants: VariantInput[] = []

    if (kind === 'nft') {
        nftContract = typeof body?.nft_contract === 'string' ? body.nft_contract.toLowerCase() : ''
        nftTokenId = body?.nft_token_id != null ? String(body.nft_token_id) : ''
        if (!nftContract || !nftTokenId) {
            return NextResponse.json({ error: 'nft_contract and nft_token_id are required for kind: "nft"' }, { status: 400 })
        }

        // STEP 1.2.2 — Registered-tier NFTs must already be deposited ("vaulted") into
        // RedeemNftSettlement's treasury address (+ that address must have approved the contract)
        // before the listing can go live — verified live on-chain (ownerOf), not trusted from the
        // request. Official items are minted fresh at redemption time (IMintableERC721.mint), so
        // there's no vault to check. Skipped only if the contract isn't deployed yet, matching the
        // "safely no-ops pre-deployment" convention used by useOnChainRoles.ts.
        const settlementAddress = getContractAddresses(chainId).redeemNftSettlement
        if (tier === 'registered' && settlementAddress) {
            let owner: string
            let treasury: string
            try {
                const client = serverPublicClient(chainId)
                ;[owner, treasury] = await Promise.all([
                    client.readContract({
                        address: nftContract as `0x${string}`,
                        abi: erc721Abi,
                        functionName: 'ownerOf',
                        args: [BigInt(nftTokenId)],
                    }),
                    client.readContract({
                        address: settlementAddress as `0x${string}`,
                        abi: redeemNftSettlementAbi,
                        functionName: 'treasury',
                    }),
                ])
            } catch {
                return NextResponse.json({ error: 'could not verify NFT ownership — check nft_contract/nft_token_id' }, { status: 400 })
            }
            if (owner.toLowerCase() !== treasury.toLowerCase()) {
                return NextResponse.json(
                    { error: 'this NFT must be transferred to the Redeem vault (RedeemNftSettlement.treasury()) before listing' },
                    { status: 400 }
                )
            }
        }

        stock = 1 // an NFT-kind item is always a single, specific token
    } else {
        // Merch redemption reuses RwaEscrow.fund() directly (see 0008_redeem_schema.sql's header
        // comment), which reverts on a zero amount — so unlike NFT items, a merch item can't be
        // priced in Points alone, it always needs a non-zero ERC20/KAP20 leg to actually escrow.
        if (!paymentToken || paymentAmount === '0' || paymentAmount === null) {
            return NextResponse.json(
                { error: 'merch items require a non-zero payment_token/payment_amount (points-only merch is not supported)' },
                { status: 400 }
            )
        }
        stock = body?.stock != null ? Number(body.stock) : null
        if (stock != null && (!Number.isFinite(stock) || stock < 0)) {
            return NextResponse.json({ error: 'stock must be a non-negative number or null (unlimited)' }, { status: 400 })
        }

        // Merch redemption funds through the Redeem RwaEscrow deployment, which reverts unless
        // paymentToken is on its own allowedPaymentTokens allowlist (see RwaEscrow.sol's `fund`).
        // Listers can only pick from lib/tokens.ts's fixed, pre-verified token list — never an
        // arbitrary address — so there's no reason to make them (or an admin) separately allow-list
        // it on-chain too; the operator wallet holds TOKEN_MANAGER_ROLE on this deployment
        // specifically to close that gap here, best-effort, so a first-ever item in a given token
        // just works instead of every buyer hitting "payment token not allowed" until someone
        // notices and fixes it by hand via /app/admin.
        const redeemEscrowAddress = getContractAddresses(chainId).redeemRwaEscrow
        if (redeemEscrowAddress) {
            try {
                const client = serverPublicClient(chainId)
                const alreadyAllowed = await client.readContract({
                    address: redeemEscrowAddress as `0x${string}`,
                    abi: rwaEscrowAbi,
                    functionName: 'allowedPaymentTokens',
                    args: [paymentToken as `0x${string}`],
                })
                if (!alreadyAllowed) {
                    const wallet = redeemOperatorWalletClient(chainId)
                    const hash = await wallet.writeContract({
                        chain: wallet.chain,
                        account: wallet.account,
                        address: redeemEscrowAddress as `0x${string}`,
                        abi: rwaEscrowAbi,
                        functionName: 'setAllowedPaymentToken',
                        args: [paymentToken as `0x${string}`, true],
                    })
                    await client.waitForTransactionReceipt({ hash })
                }
            } catch (err) {
                // Non-fatal: the item still gets created (e.g. for an admin to allow manually via
                // /app/admin) rather than blocking listing creation on an RPC hiccup.
                console.error('redeem items: auto-allow payment token failed', err)
            }
        }
        if (Array.isArray(body?.variants)) {
            variants = body.variants
                .filter((v: unknown): v is VariantInput => typeof (v as VariantInput)?.label === 'string' && Boolean((v as VariantInput).label.trim()))
                .map((v: VariantInput) => ({
                    label: v.label.trim(),
                    sku: typeof v.sku === 'string' ? v.sku.trim() || undefined : undefined,
                    stock: v.stock != null ? Number(v.stock) : null,
                }))
        }
    }

    // Defensive: a session cookie only proves the signature was valid, not that the users row
    // still exists (e.g. the DB was reset/migrated after the cookie was issued) — redeem_items
    // .lister_wallet FK-references users(wallet_address), so guarantee it here before inserting.
    const { error: userError } = await supabaseAdmin()
        .from('users')
        .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })
    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })

    const { data: item, error: insertError } = await supabaseAdmin()
        .from('redeem_items')
        .insert({
            tier,
            kind,
            chain_id: chainId,
            lister_wallet: wallet,
            name,
            description,
            image_urls: imageUrls,
            price_points: pricePoints,
            payment_token: paymentToken,
            payment_token_symbol: paymentTokenSymbol,
            payment_amount: paymentAmount,
            payout_wallet: payoutWallet,
            nft_contract: nftContract,
            nft_token_id: nftTokenId,
            stock: variants.length > 0 ? null : stock,
            // Only meaningful for merch — an NFT settles on-chain and never ships anywhere.
            thailand_only: kind === 'merch' && body?.thailand_only === true,
            max_per_wallet: maxPerWallet,
            publish_at: publishAt,
            redeem_start_at: redeemStartAt,
            redeem_end_at: redeemEndAt,
            status,
        })
        .select()
        .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    let insertedVariants: RedeemItemVariant[] = []
    if (variants.length > 0) {
        const { data: variantRows, error: variantError } = await supabaseAdmin()
            .from('redeem_item_variants')
            .insert(variants.map((v) => ({ item_id: item.id, chain_id: chainId, label: v.label, sku: v.sku ?? null, stock: v.stock ?? null })))
            .select()
        if (variantError) return NextResponse.json({ error: variantError.message }, { status: 500 })
        insertedVariants = (variantRows ?? []) as RedeemItemVariant[]
    }

    return NextResponse.json({ ...item, variants: insertedVariants }, { status: 201 })
}
