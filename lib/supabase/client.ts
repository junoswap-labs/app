'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

// Anon-key browser client — only for tables with an explicit public-read RLS policy
// (nft_orders, rwa_listings, rwa_orders, collections, nft_metadata_cache). Never used for writes;
// every mutation goes through a Route Handler using the service-role client instead.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function supabaseBrowser() {
    if (client) return client
    client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    return client
}
