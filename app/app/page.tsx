import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { NftGrid } from '@/components/nft/nft-grid'
import { RwaGrid } from '@/components/rwa/rwa-grid'

export default function AppHomePage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <Tabs defaultValue="nft">
                <TabsList>
                    <TabsTrigger value="nft">NFT</TabsTrigger>
                    <TabsTrigger value="rwa">RWA</TabsTrigger>
                </TabsList>

                <TabsContent value="nft" className="mt-6">
                    <NftGrid />
                </TabsContent>

                <TabsContent value="rwa" className="mt-6">
                    <RwaGrid />
                </TabsContent>
            </Tabs>
        </div>
    )
}
