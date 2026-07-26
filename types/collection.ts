import type { Database } from '@/types/supabase'

// Replaces lib/nft-collections.ts's hardcoded Record<string, NftCollectionConfig> — an NFT
// contract must have a row here (supabase/migrations/0006_collections.sql) before its tokens can
// be listed. snake_case, matching the DB row directly (see types/applications.ts for why).
export type Collection = Database['public']['Tables']['collections']['Row']
