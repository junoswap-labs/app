import { redirect } from 'next/navigation'

export default async function LegacyNftOrderDetailPage({
    params,
}: {
    params: Promise<{ orderHash: string }>
}) {
    const { orderHash } = await params
    redirect(`/app/nft/${orderHash}`)
}
