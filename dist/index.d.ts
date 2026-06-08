export interface HubEntitlement {
    productCode: string;
    plan: string;
    status: string;
}
export interface EffectiveDna {
    version: number;
    effective: Record<string, unknown>;
    core: Record<string, unknown>;
    overlay: Record<string, unknown>;
}
export interface PartnerLedger {
    totals: {
        pendingMinor: number;
        approvedMinor: number;
        paidMinor: number;
        lifetimeMinor: number;
    };
    byProduct: Record<string, {
        count: number;
        pendingMinor: number;
        approvedMinor: number;
        paidMinor: number;
    }>;
    commissions?: unknown[];
}
export interface CommissionReport {
    partnerEmail: string;
    productCode: string;
    sourceId: string;
    tenantId?: string | null;
    amountMinor: number;
    currency?: string;
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED';
    occurredAt: string;
    paidAt?: string;
}
export interface HubClientOptions {
    hubUrl: string;
    serviceToken?: string;
    ttlMs?: number;
    fetchImpl?: typeof fetch;
}
export declare function createHubClient(opts: HubClientOptions): {
    getEntitlements: (tenantId: string) => Promise<HubEntitlement[]>;
    hasActiveEntitlement: (tenantId: string, productCode: string) => Promise<boolean>;
    getEffectiveDna: (tenantId: string, product: string) => Promise<EffectiveDna | null>;
    isPartner: (email: string) => Promise<boolean>;
    getPartnerLedger: (email: string) => Promise<PartnerLedger | null>;
    reportCommission: (c: CommissionReport) => Promise<boolean>;
    getMe: <T = unknown>(accessToken: string) => Promise<T | null>;
};
export type HubClient = ReturnType<typeof createHubClient>;
