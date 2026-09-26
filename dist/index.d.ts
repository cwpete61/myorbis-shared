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
export interface ProviderMeta {
    provider: string;
    label: string | null;
    status: string;
    fieldNames: string[];
    lastValidatedAt: string | null;
    rotatedAt: string | null;
}
export interface HubClientOptions {
    hubUrl: string;
    serviceToken?: string;
    ttlMs?: number;
    fetchImpl?: typeof fetch;
    /**
     * Names the calling app in the Hub's audit log. Without it every fetch is
     * recorded as the generic service actor, so a credential read cannot be
     * traced back to which product made it.
     */
    consumer?: string;
}
export declare function createHubClient(opts: HubClientOptions): {
    getEntitlements: (tenantId: string) => Promise<HubEntitlement[]>;
    hasActiveEntitlement: (tenantId: string, productCode: string) => Promise<boolean>;
    getEffectiveDna: (tenantId: string, product: string) => Promise<EffectiveDna | null>;
    isPartner: (email: string) => Promise<boolean>;
    getPartnerLedger: (email: string) => Promise<PartnerLedger | null>;
    reportCommission: (c: CommissionReport) => Promise<boolean>;
    getMe: <T = unknown>(accessToken: string) => Promise<T | null>;
    getProviderSecret: (provider: string) => Promise<Record<string, string>>;
    listProviders: () => Promise<ProviderMeta[]>;
    setProviderCredential: (provider: string, fields: Record<string, string>, label?: string) => Promise<boolean>;
    validateProvider: (provider: string) => Promise<boolean>;
    disableProvider: (provider: string) => Promise<boolean>;
};
export type HubClient = ReturnType<typeof createHubClient>;
