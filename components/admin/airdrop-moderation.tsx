'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { supabaseBrowser } from '@/lib/supabase/client'
import { AirdropPause } from '@/components/admin/airdrop-pause'
import { useUpdateAirdropCampaign } from '@/hooks/useUpdateAirdropCampaign'
import { formatAddress } from '@/lib/utils'
import { toastError, toastSuccess } from '@/lib/toast'
import type { AirdropCampaign } from '@/types/airdrop'

function useAllAirdropCampaigns() {
    return useQuery({
        queryKey: ['airdrop-campaigns', 'all'],
        staleTime: 15_000,
        queryFn: async (): Promise<AirdropCampaign[]> => {
            const { data, error } = await supabaseBrowser()
                .from('airdrop_campaigns')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200)
            if (error) throw error
            return data
        },
    })
}

/**
 * Moderation only touches off-chain fields — the tokens, amounts, and claim mechanics stay exactly
 * as the creator committed them on-chain. Taking a campaign down therefore means "stop showing this
 * text and image, and stop listing it publicly", not "seize the pool", which no admin can do.
 */
function TakedownRow({ campaign }: { campaign: AirdropCampaign }) {
    const update = useUpdateAirdropCampaign(campaign.id)
    const [confirming, setConfirming] = useState(false)

    const takedown = async () => {
        try {
            await update.mutateAsync({
                title: 'Removed by moderation',
                description: '',
                cover_image_url: null,
                visibility: 'unlisted',
                location_restricted: campaign.location_restricted,
                location_lat: campaign.location_lat,
                location_lng: campaign.location_lng,
                location_radius_m: campaign.location_radius_m,
                ip_dedupe_enabled: campaign.ip_dedupe_enabled,
            })
            toastSuccess('Campaign content removed and delisted')
            setConfirming(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Takedown failed')
        }
    }

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    {campaign.cover_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={campaign.cover_image_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                        />
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{campaign.title ?? 'Untitled campaign'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                            {formatAddress(campaign.creator_wallet)} · {campaign.status}
                        </p>
                        {campaign.description && (
                            <p className="truncate text-xs text-muted-foreground/80">{campaign.description}</p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={campaign.visibility === 'public' ? 'secondary' : 'outline'}>
                        {campaign.visibility}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/app/airdrop/${campaign.id}/edit`}>Edit</Link>
                    </Button>
                    {confirming ? (
                        <>
                            <Button
                                variant="destructive"
                                size="sm"
                                isLoading={update.isPending}
                                loadingText="Removing…"
                                onClick={takedown}
                            >
                                Confirm
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                            Take down
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function AirdropModeration() {
    const { data: campaigns, isLoading } = useAllAirdropCampaigns()

    return (
        <div className="space-y-3">
            <AirdropPause />
            <p className="text-sm text-muted-foreground">
                Replace or remove a campaign&apos;s title, description, and cover image. Every change is written to
                the audit log with the previous values, so a takedown can be reviewed or reversed.
            </p>
            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !campaigns || campaigns.length === 0 ? (
                <EmptyState title="No airdrops" description="Campaigns created by any wallet will appear here." />
            ) : (
                campaigns.map((campaign) => <TakedownRow key={campaign.id} campaign={campaign} />)
            )}
        </div>
    )
}
