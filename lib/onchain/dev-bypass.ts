/**
 * Local-dev-only convenience: when active, every connected wallet is treated as holding every
 * PermissionRegistry role (Admin, PartnerMarketplace, PartnerRedeem, Authorized) — so you don't
 * need to run `grantRole` for every test wallet while building/testing UI locally.
 *
 * Double-gated so it can never activate outside a real local dev run, even if
 * NEXT_PUBLIC_DEV_ADMIN_BYPASS is accidentally left set in a copied .env file: NODE_ENV must ALSO
 * be 'development', which Next.js sets automatically for `next dev` and never for `next build` /
 * `next start` / any production deploy.
 */
export function isDevRoleBypassActive(): boolean {
    return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS === 'true'
}
