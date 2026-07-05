import { redirect } from 'next/navigation'

export default async function LegacyRwaListingDetailPage({
    params,
}: {
    params: Promise<{ listingId: string }>
}) {
    const { listingId } = await params
    redirect(`/app/rwa/${listingId}`)
}
