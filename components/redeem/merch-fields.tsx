'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface VariantRow {
    label: string
    sku: string
    stock: string // empty = unlimited
}

export function MerchFields({
    stock,
    setStock,
    thailandOnly,
    setThailandOnly,
    variants,
    addVariant,
    updateVariant,
    removeVariant,
}: {
    stock: string
    setStock: (v: string) => void
    thailandOnly: boolean
    setThailandOnly: (v: boolean) => void
    variants: VariantRow[]
    addVariant: () => void
    updateVariant: (i: number, patch: Partial<VariantRow>) => void
    removeVariant: (i: number) => void
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                    <Label htmlFor="thailandOnly">Ship within Thailand only</Label>
                    <p className="text-xs text-muted-foreground">
                        Buyers outside Thailand can&apos;t order this item. Leave off if you can post it abroad.
                    </p>
                </div>
                <Switch id="thailandOnly" checked={thailandOnly} onCheckedChange={setThailandOnly} />
            </div>

            {variants.length === 0 && (
                <div className="space-y-1.5">
                    <Label htmlFor="stock">Stock (blank = unlimited)</Label>
                    <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Options (size / color, optional)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                        Add option
                    </Button>
                </div>
                {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input placeholder="Label, e.g. Size L / Black" value={v.label} onChange={(e) => updateVariant(i, { label: e.target.value })} />
                        <Input placeholder="SKU" className="w-28" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} />
                        <Input placeholder="Stock" type="number" min="0" className="w-24" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} />
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeVariant(i)}>
                            Remove
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
