// Generalizes the KYC-application pattern (types/kyc.ts) to cover all three approval flows —
// see supabase/migrations/0005_applications.sql. Approving a row here is an audit trail only;
// the real grant is PermissionRegistry.grantRole on-chain (lib/onchain/roles.ts).
export type ApplicationKind = 'authorize_rwa' | 'partner_marketplace' | 'partner_redeem'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

/** Same fields the current KYC form (app/app/register/page.tsx) already collects. */
export interface AuthorizeRwaPayload {
    fullName: string
    idNumber: string
    phone: string
    email: string
    address: string
    idDocumentName?: string
}

export interface PartnerApplicationPayload {
    companyName: string
    contactEmail: string
    pitch: string
}

export type ApplicationPayload<K extends ApplicationKind> = K extends 'authorize_rwa'
    ? AuthorizeRwaPayload
    : PartnerApplicationPayload

// snake_case, matching the DB row shape directly (types/supabase.ts) — the API routes return
// Supabase rows as-is, no camelCase mapping layer, same convention as types/analytics.ts.
export interface Application<K extends ApplicationKind = ApplicationKind> {
    id: string
    wallet_address: string
    kind: K
    status: ApplicationStatus
    payload: ApplicationPayload<K>
    submitted_at: string
    reviewed_at: string | null
    reviewed_by: string | null
    reject_reason: string | null
}
