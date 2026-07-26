import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Service-role client — bypasses RLS. Import only from Route Handlers / the sync poller,
// never from client components. Reads SUPABASE_SERVICE_ROLE_KEY (server-only, see .env.example).
let client: ReturnType<typeof createClient<Database>> | null = null

export function supabaseAdmin() {
    if (client) return client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase server env vars are not set')
    client = createClient<Database>(url, key, { auth: { persistSession: false } })
    return client
}
