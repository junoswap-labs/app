'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ShippingInfo } from '@/types/redeem'

// Short list on purpose: these are the destinations this product actually ships to today. A
// full ISO country list would imply we can deliver anywhere, which the listers can't.
export const SHIPPING_COUNTRIES = ['Thailand', 'Singapore', 'Malaysia', 'Vietnam', 'Indonesia', 'Philippines'] as const

export const DEFAULT_SHIPPING: ShippingInfo = {
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    district: '',
    province: '',
    postalCode: '',
    country: 'Thailand',
    note: '',
}

/** The fields a courier actually needs. Anything missing here is a parcel that comes back. */
export function isShippingComplete(shipping: ShippingInfo): boolean {
    return Boolean(
        shipping.fullName.trim() &&
            shipping.phone.trim() &&
            shipping.line1?.trim() &&
            shipping.province?.trim() &&
            shipping.postalCode?.trim() &&
            shipping.country?.trim()
    )
}

interface Props {
    value: ShippingInfo
    onChange: (shipping: ShippingInfo) => void
    /** Item ships inside Thailand only — the country is fixed and the picker is hidden. */
    thailandOnly?: boolean
}

export function ShippingAddressForm({ value, onChange, thailandOnly = false }: Props) {
    const set = (patch: Partial<ShippingInfo>) => onChange({ ...value, ...patch })

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium">Shipping address</p>
                <p className="text-xs text-muted-foreground">
                    Goes to the seller as-is. Use the name and number the courier can reach on delivery day.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="ship-name">Recipient name</Label>
                    <Input
                        id="ship-name"
                        autoComplete="name"
                        placeholder="Name on the parcel"
                        value={value.fullName}
                        onChange={(e) => set({ fullName: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="ship-phone">Phone</Label>
                    <Input
                        id="ship-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="08X XXX XXXX"
                        value={value.phone}
                        onChange={(e) => set({ phone: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">Couriers call before delivery — a wrong number means a failed drop.</p>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="ship-line1">Address</Label>
                <Input
                    id="ship-line1"
                    autoComplete="address-line1"
                    placeholder="House / building number, street, moo"
                    value={value.line1 ?? ''}
                    onChange={(e) => set({ line1: e.target.value })}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="ship-line2">
                    Apartment, floor, sub-district <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                    id="ship-line2"
                    autoComplete="address-line2"
                    placeholder="Condo name, unit number, tambon"
                    value={value.line2 ?? ''}
                    onChange={(e) => set({ line2: e.target.value })}
                />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <Label htmlFor="ship-district">District</Label>
                    <Input
                        id="ship-district"
                        placeholder="Amphoe / khet"
                        value={value.district ?? ''}
                        onChange={(e) => set({ district: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="ship-province">Province</Label>
                    <Input
                        id="ship-province"
                        autoComplete="address-level1"
                        placeholder="Bangkok"
                        value={value.province ?? ''}
                        onChange={(e) => set({ province: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="ship-postal">Postal code</Label>
                    <Input
                        id="ship-postal"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="10110"
                        value={value.postalCode ?? ''}
                        onChange={(e) => set({ postalCode: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="ship-country">Country</Label>
                {thailandOnly ? (
                    <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        Thailand <span className="text-xs text-muted-foreground">— this item ships within Thailand only</span>
                    </p>
                ) : (
                    <select
                        id="ship-country"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={value.country ?? 'Thailand'}
                        onChange={(e) => set({ country: e.target.value })}
                    >
                        {SHIPPING_COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                                {country}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="ship-note">
                    Delivery note <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                    id="ship-note"
                    rows={2}
                    placeholder="Landmark, gate code, or a time you're usually home"
                    value={value.note ?? ''}
                    onChange={(e) => set({ note: e.target.value })}
                />
            </div>
        </div>
    )
}
