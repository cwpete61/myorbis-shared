// @myorbis/hub-client — one typed client for the Account Hub, shared across the
// portfolio. Cache + degrade-to-stale built in (serve last-known on a Hub blip).
const ACTIVE = new Set(['ACTIVE', 'TRIALING']);
export function createHubClient(opts) {
    const ttl = opts.ttlMs ?? 30_000;
    const f = opts.fetchImpl ?? fetch;
    const svc = {
        ...(opts.serviceToken ? { authorization: `Bearer ${opts.serviceToken}` } : {}),
        ...(opts.consumer ? { 'x-consumer': opts.consumer } : {}),
    };
    const base = opts.hubUrl.replace(/\/$/, '');
    const enc = encodeURIComponent;
    const entCache = new Map();
    const dnaCache = new Map();
    const secretCache = new Map();
    const fresh = (c) => (c && Date.now() - c.at < ttl ? c : undefined);
    async function getEntitlements(tenantId) {
        const c = entCache.get(tenantId);
        if (fresh(c))
            return c.v;
        try {
            const r = await f(`${base}/v1/tenants/${enc(tenantId)}/entitlements`, { headers: svc });
            if (r.status === 404) {
                const v = [];
                entCache.set(tenantId, { at: Date.now(), v });
                return v;
            }
            if (!r.ok)
                throw new Error(`hub ${r.status}`);
            const d = (await r.json());
            const v = (d.entitlements ?? []).map((e) => ({ productCode: e.productCode, plan: e.plan, status: e.status }));
            entCache.set(tenantId, { at: Date.now(), v });
            return v;
        }
        catch (err) {
            if (c)
                return c.v;
            throw err;
        }
    }
    async function hasActiveEntitlement(tenantId, productCode) {
        return (await getEntitlements(tenantId)).some((e) => e.productCode === productCode && ACTIVE.has(e.status));
    }
    async function getEffectiveDna(tenantId, product) {
        const c = dnaCache.get(tenantId);
        if (fresh(c))
            return c.v;
        try {
            const r = await f(`${base}/v1/tenants/${enc(tenantId)}/dna/effective?product=${enc(product)}`, { headers: svc });
            if (r.status === 404) {
                dnaCache.set(tenantId, { at: Date.now(), v: null });
                return null;
            }
            if (!r.ok)
                throw new Error(`hub ${r.status}`);
            const v = (await r.json());
            dnaCache.set(tenantId, { at: Date.now(), v });
            return v;
        }
        catch (err) {
            if (c)
                return c.v;
            throw err;
        }
    }
    async function isPartner(email) {
        try {
            return (await f(`${base}/v1/partners/${enc(email)}`, { headers: svc })).ok;
        }
        catch {
            return false;
        }
    }
    async function getPartnerLedger(email) {
        try {
            const r = await f(`${base}/v1/partners/${enc(email)}/commissions`, { headers: svc });
            return r.ok ? (await r.json()) : null;
        }
        catch {
            return null;
        }
    }
    // Report a commission up (best-effort; returns false on any failure, never throws).
    async function reportCommission(c) {
        try {
            const r = await f(`${base}/v1/partners/commissions`, {
                method: 'PUT', headers: { ...svc, 'content-type': 'application/json' },
                body: JSON.stringify({ currency: 'usd', ...c }),
            });
            return r.ok;
        }
        catch {
            return false;
        }
    }
    /** Fetch the caller's identity from /v1/me using a USER access token (not the service token). */
    async function getMe(accessToken) {
        try {
            const r = await f(`${base}/v1/me`, { headers: { authorization: `Bearer ${accessToken}` } });
            return r.ok ? (await r.json()) : null;
        }
        catch {
            return null;
        }
    }
    // ── Shared provider credentials (master API dashboard) ─────────────────────
    /** Consumer: fetch a shared provider's key(s). Cache + degrade-to-stale. */
    async function getProviderSecret(provider) {
        const c = secretCache.get(provider);
        if (fresh(c))
            return c.v;
        try {
            const r = await f(`${base}/v1/providers/${enc(provider)}/secret`, { headers: svc });
            if (!r.ok)
                throw new Error(`hub ${r.status}`);
            const d = (await r.json());
            const v = d.fields ?? {};
            secretCache.set(provider, { at: Date.now(), v });
            return v;
        }
        catch (err) {
            if (c)
                return c.v;
            throw err;
        }
    }
    /** Admin: list providers (metadata only, never values). */
    async function listProviders() {
        try {
            const r = await f(`${base}/v1/providers`, { headers: svc });
            return r.ok ? (await r.json()) : [];
        }
        catch {
            return [];
        }
    }
    /** Admin: set/rotate a provider's key(s). */
    async function setProviderCredential(provider, fields, label) {
        try {
            const r = await f(`${base}/v1/providers/${enc(provider)}`, {
                method: 'PUT', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ fields, label }),
            });
            secretCache.delete(provider);
            return r.ok;
        }
        catch {
            return false;
        }
    }
    /** Admin: mark a provider validated (server runs the test). */
    async function validateProvider(provider) {
        try {
            return (await f(`${base}/v1/providers/${enc(provider)}/validate`, { method: 'POST', headers: svc })).ok;
        }
        catch {
            return false;
        }
    }
    /** Admin: disable a provider. */
    async function disableProvider(provider) {
        try {
            secretCache.delete(provider);
            return (await f(`${base}/v1/providers/${enc(provider)}`, { method: 'DELETE', headers: svc })).ok;
        }
        catch {
            return false;
        }
    }
    return { getEntitlements, hasActiveEntitlement, getEffectiveDna, isPartner, getPartnerLedger, reportCommission, getMe,
        getProviderSecret, listProviders, setProviderCredential, validateProvider, disableProvider };
}
