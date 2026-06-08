// @myorbis/hub-client — one typed client for the Account Hub, shared across the
// portfolio. Cache + degrade-to-stale built in (serve last-known on a Hub blip).

export interface HubEntitlement { productCode: string; plan: string; status: string }
export interface EffectiveDna { version: number; effective: Record<string, unknown>; core: Record<string, unknown>; overlay: Record<string, unknown> }
export interface PartnerLedger {
  totals: { pendingMinor: number; approvedMinor: number; paidMinor: number; lifetimeMinor: number }
  byProduct: Record<string, { count: number; pendingMinor: number; approvedMinor: number; paidMinor: number }>
  commissions?: unknown[]
}
export interface CommissionReport {
  partnerEmail: string; productCode: string; sourceId: string; tenantId?: string | null
  amountMinor: number; currency?: string; status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED'
  occurredAt: string; paidAt?: string
}
export interface HubClientOptions {
  hubUrl: string
  serviceToken?: string
  ttlMs?: number
  fetchImpl?: typeof fetch
}

const ACTIVE = new Set(['ACTIVE', 'TRIALING'])

export function createHubClient(opts: HubClientOptions) {
  const ttl = opts.ttlMs ?? 30_000
  const f = opts.fetchImpl ?? fetch
  const svc = opts.serviceToken ? { authorization: `Bearer ${opts.serviceToken}` } : {}
  const base = opts.hubUrl.replace(/\/$/, '')
  const enc = encodeURIComponent

  const entCache = new Map<string, { at: number; v: HubEntitlement[] }>()
  const dnaCache = new Map<string, { at: number; v: EffectiveDna | null }>()
  const fresh = <T>(c: { at: number; v: T } | undefined) => (c && Date.now() - c.at < ttl ? c : undefined)

  async function getEntitlements(tenantId: string): Promise<HubEntitlement[]> {
    const c = entCache.get(tenantId); if (fresh(c)) return c!.v
    try {
      const r = await f(`${base}/v1/tenants/${enc(tenantId)}/entitlements`, { headers: svc })
      if (r.status === 404) { const v: HubEntitlement[] = []; entCache.set(tenantId, { at: Date.now(), v }); return v }
      if (!r.ok) throw new Error(`hub ${r.status}`)
      const d = (await r.json()) as { entitlements?: HubEntitlement[] }
      const v = (d.entitlements ?? []).map((e) => ({ productCode: e.productCode, plan: e.plan, status: e.status }))
      entCache.set(tenantId, { at: Date.now(), v }); return v
    } catch (err) { if (c) return c.v; throw err }
  }

  async function hasActiveEntitlement(tenantId: string, productCode: string): Promise<boolean> {
    return (await getEntitlements(tenantId)).some((e) => e.productCode === productCode && ACTIVE.has(e.status))
  }

  async function getEffectiveDna(tenantId: string, product: string): Promise<EffectiveDna | null> {
    const c = dnaCache.get(tenantId); if (fresh(c)) return c!.v
    try {
      const r = await f(`${base}/v1/tenants/${enc(tenantId)}/dna/effective?product=${enc(product)}`, { headers: svc })
      if (r.status === 404) { dnaCache.set(tenantId, { at: Date.now(), v: null }); return null }
      if (!r.ok) throw new Error(`hub ${r.status}`)
      const v = (await r.json()) as EffectiveDna
      dnaCache.set(tenantId, { at: Date.now(), v }); return v
    } catch (err) { if (c) return c.v; throw err }
  }

  async function isPartner(email: string): Promise<boolean> {
    try { return (await f(`${base}/v1/partners/${enc(email)}`, { headers: svc })).ok } catch { return false }
  }

  async function getPartnerLedger(email: string): Promise<PartnerLedger | null> {
    try {
      const r = await f(`${base}/v1/partners/${enc(email)}/commissions`, { headers: svc })
      return r.ok ? ((await r.json()) as PartnerLedger) : null
    } catch { return null }
  }

  // Report a commission up (best-effort; returns false on any failure, never throws).
  async function reportCommission(c: CommissionReport): Promise<boolean> {
    try {
      const r = await f(`${base}/v1/partners/commissions`, {
        method: 'PUT', headers: { ...svc, 'content-type': 'application/json' },
        body: JSON.stringify({ currency: 'usd', ...c }),
      })
      return r.ok
    } catch { return false }
  }

  /** Fetch the caller's identity from /v1/me using a USER access token (not the service token). */
  async function getMe<T = unknown>(accessToken: string): Promise<T | null> {
    try {
      const r = await f(`${base}/v1/me`, { headers: { authorization: `Bearer ${accessToken}` } })
      return r.ok ? ((await r.json()) as T) : null
    } catch { return null }
  }

  return { getEntitlements, hasActiveEntitlement, getEffectiveDna, isPartner, getPartnerLedger, reportCommission, getMe }
}

export type HubClient = ReturnType<typeof createHubClient>
