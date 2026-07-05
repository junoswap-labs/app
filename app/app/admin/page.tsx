import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard'
import { DisputeQueueTable } from '@/components/admin/dispute-queue-table'
import { RedemptionQueue } from '@/components/admin/redemption-queue'
import { KycQueue } from '@/components/admin/kyc-queue'

export default function AdminPage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">Admin</h1>
            <Tabs defaultValue="analytics">
                <TabsList>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="disputes">Disputes</TabsTrigger>
                    <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
                    <TabsTrigger value="kyc">KYC</TabsTrigger>
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

                <TabsContent value="kyc" className="mt-6">
                    <KycQueue />
                </TabsContent>
            </Tabs>
        </div>
    )
}
