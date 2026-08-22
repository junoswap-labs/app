import { redirect } from 'next/navigation'

/** Manage (Redemptions/My Listings) moved onto /app/redeem itself as a tab — see
 *  app/app/redeem/page.tsx. This route stays only as a redirect for old links/bookmarks. */
export default function LegacyRedeemManagePage() {
    redirect('/app/redeem')
}
