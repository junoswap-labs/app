'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ImageUploadField } from '@/components/ui/image-upload'
import type { AirdropVisibility } from '@/types/airdrop'

export function StepDetails({
    title,
    setTitle,
    description,
    setDescription,
    coverImageUrl,
    setCoverImageUrl,
    visibility,
    setVisibility,
}: {
    title: string
    setTitle: (v: string) => void
    description: string
    setDescription: (v: string) => void
    coverImageUrl: string | null
    setCoverImageUrl: (v: string | null) => void
    visibility: AirdropVisibility
    setVisibility: (v: AirdropVisibility) => void
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <ImageUploadField value={coverImageUrl} onChange={setCoverImageUrl} label="Cover image" />
                <div className="space-y-1.5">
                    <Label>Who can find this?</Label>
                    <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as AirdropVisibility)} className="grid-cols-1 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="public" id="visibility-public" />
                            Public
                        </label>
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="unlisted" id="visibility-unlisted" />
                            QR code / link only
                        </label>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                        {visibility === 'public'
                            ? 'Shown on the Browse Airdrops page.'
                            : "Not listed anywhere — only reachable by whoever has the QR code or share link."}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
