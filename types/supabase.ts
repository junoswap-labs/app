// Hand-written until a real Supabase project is linked and `generate_typescript_types` can
// produce this file — keep in sync with supabase/migrations/*.sql by hand until then.
// Shape follows the standard supabase-gen-types output (public.Tables.<table>.{Row,Insert,Update}).

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    wallet_address: string
                    created_at: string
                    google_email: string | null
                    google_linked_at: string | null
                    telegram_chat_id: string | null
                    telegram_username: string | null
                    telegram_linked_at: string | null
                    telegram_link_code: string | null
                    telegram_link_code_expires_at: string | null
                    notify_new_offer: boolean
                    notify_deadline: boolean
                    lister_display_name: string | null
                    lister_logo_url: string | null
                }
                Insert: Partial<Database['public']['Tables']['users']['Row']> & { wallet_address: string }
                Update: Partial<Database['public']['Tables']['users']['Row']>
                Relationships: []
            }
            nft_orders: {
                Row: {
                    order_hash: string
                    seller: string
                    buyer: string | null
                    nft_contract: string
                    token_id: string
                    payment_token: string
                    price: string
                    nonce: string
                    expiry: number
                    signature: string
                    status: 'active' | 'filled' | 'cancelled'
                    fee: string | null
                    name: string | null
                    image_url: string | null
                    chain_id: number
                    listed_at: string
                    filled_at: string | null
                    cancelled_at: string | null
                }
                Insert: Omit<
                    Database['public']['Tables']['nft_orders']['Row'],
                    'status' | 'listed_at' | 'buyer' | 'fee' | 'filled_at' | 'cancelled_at' | 'chain_id'
                > & {
                    status?: string
                    listed_at?: string
                    buyer?: string | null
                    fee?: string | null
                    filled_at?: string | null
                    cancelled_at?: string | null
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['nft_orders']['Row']>
                Relationships: []
            }
            rwa_listings: {
                Row: {
                    id: string
                    seller_wallet: string
                    title: string
                    description: string
                    image_urls: string[]
                    price: string
                    payment_token: string
                    status: 'active' | 'cancelled' | 'funded'
                    chain_id: number
                    created_at: string
                }
                Insert: Omit<
                    Database['public']['Tables']['rwa_listings']['Row'],
                    'status' | 'created_at' | 'chain_id'
                > & { status?: string; created_at?: string; chain_id?: number }
                Update: Partial<Database['public']['Tables']['rwa_listings']['Row']>
                Relationships: []
            }
            rwa_orders: {
                Row: {
                    id: string
                    seller_wallet: string
                    buyer_wallet: string
                    payment_token: string
                    amount: string
                    status: string
                    fee: string | null
                    chain_id: number
                    funded_at: string
                    shipped_at: string | null
                    completed_at: string | null
                    resolved_at: string | null
                }
                Insert: Omit<
                    Database['public']['Tables']['rwa_orders']['Row'],
                    'fee' | 'shipped_at' | 'completed_at' | 'resolved_at' | 'chain_id'
                > & {
                    fee?: string | null
                    shipped_at?: string | null
                    completed_at?: string | null
                    resolved_at?: string | null
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['rwa_orders']['Row']>
                Relationships: []
            }
            applications: {
                Row: {
                    id: string
                    wallet_address: string
                    kind: 'authorize_rwa' | 'partner_marketplace' | 'partner_redeem'
                    status: 'pending' | 'approved' | 'rejected'
                    payload: Record<string, unknown>
                    submitted_at: string
                    reviewed_at: string | null
                    reviewed_by: string | null
                    reject_reason: string | null
                }
                Insert: Omit<
                    Database['public']['Tables']['applications']['Row'],
                    'id' | 'status' | 'submitted_at' | 'reviewed_at' | 'reviewed_by' | 'reject_reason'
                > & {
                    id?: string
                    status?: string
                    submitted_at?: string
                    reviewed_at?: string
                    reviewed_by?: string
                    reject_reason?: string
                }
                Update: Partial<Database['public']['Tables']['applications']['Row']>
                Relationships: []
            }
            collections: {
                Row: {
                    contract: string
                    chain_id: number
                    name: string
                    display_name: string | null
                    verified: boolean
                    active: boolean
                    gateway: string | null
                    registered_by: string | null
                    registered_at: string
                    metadata: Record<string, unknown> | null
                }
                Insert: Omit<
                    Database['public']['Tables']['collections']['Row'],
                    'verified' | 'active' | 'registered_at'
                > & { verified?: boolean; active?: boolean; registered_at?: string }
                Update: Partial<Database['public']['Tables']['collections']['Row']>
                Relationships: []
            }
            redeem_items: {
                Row: {
                    id: number
                    tier: 'official' | 'registered'
                    kind: 'nft' | 'merch'
                    lister_wallet: string
                    name: string
                    description: string
                    image_urls: string[]
                    price_points: string
                    payment_token: string | null
                    payment_token_symbol: string | null
                    payment_amount: string | null
                    payout_wallet: string | null
                    nft_contract: string | null
                    nft_token_id: string | null
                    stock: number | null
                    thailand_only: boolean
                    max_per_wallet: number | null
                    publish_at: string | null
                    redeem_start_at: string | null
                    redeem_end_at: string | null
                    status: 'draft' | 'published' | 'archived'
                    chain_id: number
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['redeem_items']['Row'], 'id' | 'status' | 'created_at' | 'thailand_only' | 'max_per_wallet' | 'chain_id'> & {
                    id?: number
                    status?: string
                    created_at?: string
                    thailand_only?: boolean
                    max_per_wallet?: number | null
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['redeem_items']['Row']>
                Relationships: []
            }
            redeem_item_variants: {
                Row: { id: number; item_id: number; label: string; sku: string | null; stock: number | null; chain_id: number; created_at: string }
                Insert: Omit<Database['public']['Tables']['redeem_item_variants']['Row'], 'id' | 'created_at' | 'chain_id'> & {
                    id?: number
                    created_at?: string
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['redeem_item_variants']['Row']>
                Relationships: [
                    {
                        foreignKeyName: 'redeem_item_variants_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'redeem_items'
                        referencedColumns: ['id']
                    },
                ]
            }
            redemption_orders: {
                Row: {
                    id: string
                    item_id: number
                    variant_id: number | null
                    buyer_wallet: string
                    tier: 'official' | 'registered'
                    kind: 'nft' | 'merch'
                    price_points: string
                    payment_token: string | null
                    payment_token_symbol: string | null
                    payment_amount: string | null
                    offer_hash: string | null
                    escrow_listing_id: string | null
                    status: string
                    shipping: Record<string, unknown> | null
                    tracking_number: string | null
                    created_at: string
                    updated_at: string
                    shipped_at: string | null
                    completed_at: string | null
                    resolved_at: string | null
                    dispute_reason: string | null
                    dispute_detail: string | null
                    dispute_evidence_urls: string[] | null
                    dispute_reported_by: string | null
                    dispute_reported_at: string | null
                    chain_id: number
                }
                Insert: Omit<
                    Database['public']['Tables']['redemption_orders']['Row'],
                    | 'id'
                    | 'status'
                    | 'created_at'
                    | 'updated_at'
                    | 'shipped_at'
                    | 'completed_at'
                    | 'resolved_at'
                    | 'offer_hash'
                    | 'escrow_listing_id'
                    | 'shipping'
                    | 'tracking_number'
                    | 'dispute_reason'
                    | 'dispute_detail'
                    | 'dispute_evidence_urls'
                    | 'dispute_reported_by'
                    | 'dispute_reported_at'
                    | 'chain_id'
                > & {
                    id?: string
                    chain_id?: number
                    status?: string
                    created_at?: string
                    updated_at?: string
                    shipped_at?: string | null
                    completed_at?: string | null
                    resolved_at?: string | null
                    offer_hash?: string | null
                    escrow_listing_id?: string | null
                    shipping?: Record<string, unknown> | null
                    tracking_number?: string | null
                    dispute_reason?: string | null
                    dispute_detail?: string | null
                    dispute_evidence_urls?: string[] | null
                    dispute_reported_by?: string | null
                    dispute_reported_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['redemption_orders']['Row']>
                Relationships: [
                    {
                        foreignKeyName: 'redemption_orders_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'redeem_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'redemption_orders_variant_id_fkey'
                        columns: ['variant_id']
                        isOneToOne: false
                        referencedRelation: 'redeem_item_variants'
                        referencedColumns: ['id']
                    },
                ]
            }
            sync_state: {
                Row: { chain_id: number; contract: string; last_block: string; updated_at: string }
                Insert: { chain_id: number; contract: string; last_block: string; updated_at?: string }
                Update: Partial<Database['public']['Tables']['sync_state']['Row']>
                Relationships: []
            }
            content_reports: {
                Row: {
                    id: string
                    created_at: string
                    reporter_wallet: string
                    subject_type: string
                    subject_id: string
                    reason: string
                    detail: string | null
                    status: string
                    resolved_by: string | null
                    resolved_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['content_reports']['Row'], 'id' | 'created_at' | 'status' | 'resolved_by' | 'resolved_at'> & {
                    id?: string
                    created_at?: string
                    status?: string
                    resolved_by?: string | null
                    resolved_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['content_reports']['Row']>
                Relationships: []
            }
            audit_logs: {
                Row: {
                    id: string
                    created_at: string
                    category: string
                    action: string
                    actor_wallet: string | null
                    actor_type: string
                    subject_type: string | null
                    subject_id: string | null
                    old_status: string | null
                    new_status: string | null
                    tx_hash: string | null
                    block_number: string | null
                    log_index: number | null
                    request_ip: string | null
                    user_agent: string | null
                    tg_update_id: string | null
                    metadata: Record<string, unknown> | null
                    chain_id: number | null
                }
                Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at' | 'chain_id'> & {
                    id?: string
                    created_at?: string
                    chain_id?: number | null
                }
                Update: Partial<Database['public']['Tables']['audit_logs']['Row']>
                Relationships: []
            }
            airdrop_campaigns: {
                Row: {
                    id: string
                    creator_wallet: string
                    token: string
                    token_symbol: string | null
                    token_decimals: number | null
                    amount_mode: 'fixed' | 'random'
                    fixed_amount: string | null
                    min_amount: string | null
                    max_amount: string | null
                    total_amount: string
                    remaining_amount: string
                    max_claimants: number | null
                    claimed_count: number
                    expires_at: string | null
                    gas_mode: 'self' | 'relayer'
                    gas_deposit: string
                    gas_spent: string
                    share_hash: string | null
                    visibility: 'public' | 'unlisted'
                    location_restricted: boolean
                    location_lat: number | null
                    location_lng: number | null
                    location_radius_m: number | null
                    ip_dedupe_enabled: boolean
                    title: string | null
                    description: string | null
                    cover_image_url: string | null
                    status: 'active' | 'closed' | 'reclaimed'
                    tx_hash: string | null
                    chain_id: number
                    created_at: string
                }
                Insert: Omit<
                    Database['public']['Tables']['airdrop_campaigns']['Row'],
                    | 'chain_id'
                    | 'token_symbol'
                    | 'token_decimals'
                    | 'fixed_amount'
                    | 'min_amount'
                    | 'max_amount'
                    | 'max_claimants'
                    | 'claimed_count'
                    | 'expires_at'
                    | 'gas_mode'
                    | 'gas_deposit'
                    | 'gas_spent'
                    | 'share_hash'
                    | 'visibility'
                    | 'location_restricted'
                    | 'location_lat'
                    | 'location_lng'
                    | 'location_radius_m'
                    | 'ip_dedupe_enabled'
                    | 'title'
                    | 'description'
                    | 'cover_image_url'
                    | 'status'
                    | 'tx_hash'
                    | 'created_at'
                > & {
                    chain_id?: number
                    token_symbol?: string | null
                    token_decimals?: number | null
                    fixed_amount?: string | null
                    min_amount?: string | null
                    max_amount?: string | null
                    max_claimants?: number | null
                    claimed_count?: number
                    expires_at?: string | null
                    gas_mode?: string
                    gas_deposit?: string
                    gas_spent?: string
                    share_hash?: string | null
                    visibility?: string
                    location_restricted?: boolean
                    location_lat?: number | null
                    location_lng?: number | null
                    location_radius_m?: number | null
                    ip_dedupe_enabled?: boolean
                    title?: string | null
                    description?: string | null
                    cover_image_url?: string | null
                    status?: string
                    tx_hash?: string | null
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['airdrop_campaigns']['Row']>
                Relationships: []
            }
            airdrop_claims: {
                Row: {
                    id: string
                    campaign_id: string
                    recipient_wallet: string
                    amount: string
                    tx_hash: string
                    log_index: number
                    submitter: 'self' | 'relayer'
                    chain_id: number
                    claimed_at: string
                }
                Insert: Omit<Database['public']['Tables']['airdrop_claims']['Row'], 'id' | 'claimed_at' | 'chain_id'> & {
                    id?: string
                    claimed_at?: string
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['airdrop_claims']['Row']>
                Relationships: [
                    {
                        foreignKeyName: 'airdrop_claims_campaign_id_fkey'
                        columns: ['campaign_id']
                        isOneToOne: false
                        referencedRelation: 'airdrop_campaigns'
                        referencedColumns: ['id']
                    },
                ]
            }
            airdrop_claim_attempts: {
                Row: {
                    id: string
                    campaign_id: string
                    session_wallet: string
                    recipient_wallet: string | null
                    client_ip: string | null
                    outcome: string
                    chain_id: number
                    attempted_at: string
                }
                Insert: Omit<Database['public']['Tables']['airdrop_claim_attempts']['Row'], 'id' | 'attempted_at' | 'chain_id'> & {
                    id?: string
                    attempted_at?: string
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['airdrop_claim_attempts']['Row']>
                Relationships: [
                    {
                        foreignKeyName: 'airdrop_claim_attempts_campaign_id_fkey'
                        columns: ['campaign_id']
                        isOneToOne: false
                        referencedRelation: 'airdrop_campaigns'
                        referencedColumns: ['id']
                    },
                ]
            }
            airdrop_gas_reimbursements: {
                Row: {
                    id: string
                    campaign_id: string
                    tx_hash: string
                    log_index: number
                    amount: string
                    chain_id: number
                    reimbursed_at: string
                }
                Insert: Omit<Database['public']['Tables']['airdrop_gas_reimbursements']['Row'], 'id' | 'reimbursed_at' | 'chain_id'> & {
                    id?: string
                    reimbursed_at?: string
                    chain_id?: number
                }
                Update: Partial<Database['public']['Tables']['airdrop_gas_reimbursements']['Row']>
                Relationships: [
                    {
                        foreignKeyName: 'airdrop_gas_reimbursements_campaign_id_fkey'
                        columns: ['campaign_id']
                        isOneToOne: false
                        referencedRelation: 'airdrop_campaigns'
                        referencedColumns: ['id']
                    },
                ]
            }
        }
        Views: {
            redeem_lister_profiles: {
                Row: { wallet_address: string; lister_display_name: string | null; lister_logo_url: string | null }
                Relationships: []
            }
        }
        Functions: Record<string, never>
    }
}
