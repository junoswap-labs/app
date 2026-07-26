import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard'
import { DisputeQueueTable } from '@/components/admin/dispute-queue-table'
import { RedemptionQueue } from '@/components/admin/redemption-queue'
import { ApplicationQueue } from '@/components/admin/application-queue'
import type { AuthorizeRwaPayload, PartnerApplicationPayload } from '@/types/applications'

export default function AdminPage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">Admin</h1>
            <Tabs defaultValue="analytics">
                <TabsList>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="disputes">Disputes</TabsTrigger>
                    <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
                    <TabsTrigger value="authorize">Authorize (RWA)</TabsTrigger>
                    <TabsTrigger value="partners-marketplace">Partners · Marketplace</TabsTrigger>
                    <TabsTrigger value="partners-redeem">Partners · Redeem</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="mt-6">
                    <AnalyticsDashboard />
                </TabsContent>

                <TabsContent value="disputes" className="mt-6">
                    <DisputeQueueTable />
                </TabsContent>

                <TabsContent value="redemptions" className="mt-6">
                    <RedemptionQueue />
                </TabsContent>

                <TabsContent value="authorize" className="mt-6">
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
                </TabsContent>

                <TabsContent value="partners-marketplace" className="mt-6">
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
                </TabsContent>

                <TabsContent value="partners-redeem" className="mt-6">
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
                </TabsContent>
            </Tabs>
        </div>
    )
}
