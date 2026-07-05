// Seller registration + KYC — listing on the marketplace (NFT or RWA) requires a
// verified seller profile for safety. Verification decisions are made by admin,
// status is read from the server; the client never asserts its own KYC state.
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface KycApplication {
    wallet: `0x${string}`
    fullName: string
    idNumber: string
    phone: string
    email: string
    address: string
    /** Storage URL of the uploaded ID document (mock: filename only) */
    idDocumentName?: string
    status: KycStatus
    submittedAt: number
    reviewedAt?: number
    rejectReason?: string
}
