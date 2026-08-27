'use client'

import { useEffect, useState } from 'react'
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard'
import { DisputeQueueTable } from '@/components/admin/dispute-queue-table'
import { AirdropModeration } from '@/components/admin/airdrop-moderation'
import { AdminRoles } from '@/components/admin/admin-roles'
import { JunoPtsMint } from '@/components/admin/junopts-mint'
import { ReportQueue } from '@/components/admin/report-queue'
import { SystemPanel } from '@/components/admin/system-panel'
import { RedemptionQueue } from '@/components/admin/redemption-queue'
import { ApplicationQueue } from '@/components/admin/application-queue'
import { MarketplaceSettings } from '@/components/admin/marketplace-settings'
import { ContractDirectory } from '@/components/admin/contract-directory'
import { AdminSidebar, type AdminGroup } from '@/components/admin/admin-sidebar'
import type { AuthorizeRwaPayload, PartnerApplicationPayload } from '@/types/applications'

const GROUPS: AdminGroup[] = [
    { key: 'overview', label: 'Overview', sections: [{ key: 'analytics', label: 'Analytics' }, { key: 'system', label: 'System' }] },
    {
        key: 'operations',
        label: 'Operations',
        sections: [
            { key: 'redemptions', label: 'Redemptions' },
            { key: 'disputes', label: 'Disputes' },
        ],
    },
    {
        key: 'moderation',
        label: 'Moderation',
        sections: [
            { key: 'reports', label: 'Reports' },
            { key: 'airdrops', label: 'Airdrops' },
        ],
    },
    {
        key: 'applications',
        label: 'Applications',
        sections: [
            { key: 'authorize', label: 'Authorize (RWA)' },
            { key: 'partners-marketplace', label: 'Partners · Marketplace' },
            { key: 'partners-redeem', label: 'Partners · Redeem' },
        ],
    },
    {
        key: 'configuration',
        label: 'Configuration',
        sections: [
            { key: 'roles', label: 'Roles & permissions' },
            { key: 'junopts', label: 'JunoPts mint' },
            { key: 'addresses', label: 'Contract addresses' },
            { key: 'settings', label: 'Contract settings' },
        ],
    },
]

// Which section and which collapsed groups the operator left the page on. Per-device UI state, so
// localStorage rather than a column on the user row.
const STORAGE_KEY = 'admin-nav-state'

interface NavState {
    section: string
    collapsed: string[]
}

function AdminSection({ section }: { section: string }) {
    switch (section) {
        case 'analytics':
            return <AnalyticsDashboard />
        case 'system':
            return <SystemPanel />
        case 'redemptions':
            return <RedemptionQueue />
        case 'disputes':
            return <DisputeQueueTable />
        case 'reports':
            return <ReportQueue />
        case 'airdrops':
            return <AirdropModeration />
        case 'authorize':
            return (
                <ApplicationQueue
                    kind="authorize_rwa"
                    title="Authorize"
                    emptyDescription="Seller verification applications awaiting review will appear here."
                    renderPayload={(application) => {
                        const p = application.payload as AuthorizeRwaPayload
                        return (
                            <>
                                <p className="text-sm font-medium">{p.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                    ID {p.idNumber} · {p.phone} · {p.email}
                                    {p.idDocumentName && ` · Doc: ${p.idDocumentName}`}
                                </p>
                                <p className="text-xs text-muted-foreground">{p.address}</p>
                            </>
                        )
                    }}
                />
            )
        case 'partners-marketplace':
            return (
                <ApplicationQueue
                    kind="partner_marketplace"
                    title="Marketplace partners"
                    emptyDescription="Marketplace partner applications awaiting review will appear here."
                    renderPayload={(application) => {
                        const p = application.payload as PartnerApplicationPayload
                        return (
                            <>
                                <p className="text-sm font-medium">{p.companyName}</p>
                                <p className="text-xs text-muted-foreground">{p.contactEmail}</p>
                                <p className="text-xs text-muted-foreground">{p.pitch}</p>
                            </>
                        )
                    }}
                />
            )
        case 'partners-redeem':
            return (
                <ApplicationQueue
                    kind="partner_redeem"
                    title="Redeem partners"
                    emptyDescription="Redeem partner applications awaiting review will appear here."
                    renderPayload={(application) => {
                        const p = application.payload as PartnerApplicationPayload
                        return (
                            <>
                                <p className="text-sm font-medium">{p.companyName}</p>
                                <p className="text-xs text-muted-foreground">{p.contactEmail}</p>
                                <p className="text-xs text-muted-foreground">{p.pitch}</p>
                            </>
                        )
                    }}
                />
            )
        case 'roles':
            return <AdminRoles />
        case 'junopts':
            return <JunoPtsMint />
        case 'addresses':
            return <ContractDirectory />
        case 'settings':
            return <MarketplaceSettings />
        default:
            return null
    }
}

export default function AdminPage() {
    const [section, setSection] = useState('analytics')
    const [collapsed, setCollapsed] = useState<string[]>([])

    // Restored after mount only — reading localStorage during render would make the server and
    // client disagree on which section is highlighted.
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY)
            if (!saved) return
            const state = JSON.parse(saved) as NavState
            if (GROUPS.some((g) => g.sections.some((s) => s.key === state.section))) setSection(state.section)
            if (Array.isArray(state.collapsed)) setCollapsed(state.collapsed)
        } catch {
            /* corrupt value — fall back to defaults */
        }
    }, [])

    const persist = (next: Partial<NavState>) => {
        const state: NavState = { section, collapsed, ...next }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }

    const selectSection = (key: string) => {
        setSection(key)
        persist({ section: key })
    }

    const toggleGroup = (key: string) => {
        const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]
        setCollapsed(next)
        persist({ collapsed: next })
    }

    const activeLabel = GROUPS.flatMap((g) => g.sections).find((s) => s.key === section)?.label ?? 'Admin'

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">Admin</h1>

            <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
                <div className="lg:sticky lg:top-20">
                    <AdminSidebar
                        groups={GROUPS}
                        active={section}
                        onSelect={selectSection}
                        collapsed={collapsed}
                        onToggleGroup={toggleGroup}
                    />
                </div>

                <div className="min-w-0 space-y-4">
                    <h2 className="hidden text-lg font-medium lg:block">{activeLabel}</h2>
                    <AdminSection section={section} />
                </div>
            </div>
        </div>
    )
}
