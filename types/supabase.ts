// Hand-written until a real Supabase project is linked and `generate_typescript_types` can
// produce this file — keep in sync with supabase/migrations/*.sql by hand until then.
// Shape follows the standard supabase-gen-types output (public.Tables.<table>.{Row,Insert,Update}).

export interface Database {
    public: {
        Tables: {
            users: {
                Row: { wallet_address: string; created_at: string }
                Insert: { wallet_address: string; created_at?: string }
                Update: { wallet_address?: string; created_at?: string }
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
                    listed_at: string
                    filled_at: string | null
                    cancelled_at: string | null
                }
                Insert: Omit<
                    Database['public']['Tables']['nft_orders']['Row'],
                    'status' | 'listed_at' | 'buyer' | 'fee' | 'filled_at' | 'cancelled_at'
                > & {
                    status?: string
                    listed_at?: string
                    buyer?: string | null
                    fee?: string | null
                    filled_at?: string | null
                    cancelled_at?: string | null
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
                    created_at: string
                }
                Insert: Omit<
                    Database['public']['Tables']['rwa_listings']['Row'],
                    'status' | 'created_at'
                > & { status?: string; created_at?: string }
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
                    funded_at: string
                    shipped_at: string | null
                    completed_at: string | null
                    resolved_at: string | null
                }
                Insert: Omit<
                    Database['public']['Tables']['rwa_orders']['Row'],
                    'fee' | 'shipped_at' | 'completed_at' | 'resolved_at'
                > & {
                    fee?: string | null
                    shipped_at?: string | null
                    completed_at?: string | null
                    resolved_at?: string | null
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
            sync_state: {
                Row: { contract: string; last_block: string; updated_at: string }
                Insert: { contract: string; last_block: string; updated_at?: string }
                Update: Partial<Database['public']['Tables']['sync_state']['Row']>
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
                }
                Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
                    id?: string
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['audit_logs']['Row']>
                Relationships: []
            }
        }
        Views: Record<string, never>
        Functions: Record<string, never>
    }
}
