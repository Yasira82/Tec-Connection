// Server-only access to the Connection Discover directory (C-107) via the API
// Gateway with the inter-service key. The directory read + public profile are
// PUBLIC (no session) so they work as a Pi-community surface outside a login;
// the caller's own profile + featured sync are authenticated. NEW-A: the gateway
// URL is server-only (API_GATEWAY_URL) — never shipped to the client.
const GW = process.env.API_GATEWAY_URL ?? '';

const gwHeaders = (token?: string | null) => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  ...(token && { Authorization: `Bearer ${token}` }),
});

export const CATEGORIES = ['builder', 'merchant', 'creator', 'investor', 'mentor', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// A directory card (public). `verified` is presented from Zone/kyc; `featured` is
// Connection Pro (reach only) — never trust.
export interface DirectoryProfile {
  username:  string;
  headline:  string;
  category:  string;
  verified:  boolean;
  featured:  boolean;
  followers: number;
  /** Whether a profile photo exists. The KEY is never exposed to a client. */
  hasAvatar: boolean;
}

// The caller's OWN editable profile.
export interface MyProfile {
  username:  string;
  headline:  string;
  category:  string;
  published: boolean;
  verified:  boolean;
  featured:  boolean;
  hasAvatar: boolean;
}

// A public shareable profile (published only).
export interface PublicProfile extends DirectoryProfile {
  since?: string;
}

const toCard = (o: Record<string, unknown>): DirectoryProfile => ({
  username:  String(o.username ?? ''),
  headline:  String(o.headline ?? ''),
  category:  String(o.category ?? 'builder'),
  verified:  Boolean(o.verified ?? false),
  featured:  Boolean(o.featured ?? false),
  followers: Number(o.followers ?? 0),
  hasAvatar: Boolean(o.has_avatar ?? false),
});

/** The public Discover directory. Unreachable backend → [] (honest, never fabricated). */
export async function resolveDirectory(args: { query?: string; category?: string } = {}): Promise<DirectoryProfile[]> {
  if (!GW) return [];
  const qs = new URLSearchParams();
  if (args.query?.trim())    qs.set('q', args.query.trim());
  if (args.category?.trim()) qs.set('category', args.category.trim());
  try {
    const res = await fetch(`${GW}/api/identity/connection/discover?${qs.toString()}`, { headers: gwHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => ({})))?.data?.profiles;
    return Array.isArray(rows) ? rows.map((r) => toCard(r as Record<string, unknown>)) : [];
  } catch { return []; }
}

/** One PUBLISHED profile by username. null if unknown/unpublished/unreachable. */
export async function resolvePublicProfile(username: string): Promise<PublicProfile | null> {
  if (!GW || !username) return null;
  try {
    const res = await fetch(`${GW}/api/identity/connection/profile/${encodeURIComponent(username)}`, { headers: gwHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const p = (await res.json().catch(() => ({})))?.data?.profile;
    if (!p) return null;
    return { ...toCard(p as Record<string, unknown>), since: p.since ? String(p.since) : undefined };
  } catch { return null; }
}

/** The caller's OWN profile (authenticated). null if unreachable / no session. */
export async function resolveMyProfile(token: string | null): Promise<MyProfile | null> {
  if (!GW || !token) return null;
  try {
    const res = await fetch(`${GW}/api/identity/connection/profile/me`, { headers: gwHeaders(token), cache: 'no-store' });
    if (!res.ok) return null;
    const p = (await res.json().catch(() => ({})))?.data?.profile;
    if (!p) return null;
    return {
      username:  String(p.username ?? ''),
      headline:  String(p.headline ?? ''),
      category:  String(p.category ?? 'builder'),
      published: Boolean(p.published ?? false),
      verified:  Boolean(p.verified ?? false),
      featured:  Boolean(p.featured ?? false),
      hasAvatar: Boolean(p.has_avatar ?? false),
    };
  } catch { return null; }
}

/** Save the caller's OWN profile (authenticated). Returns the saved profile or null. */
export async function saveMyProfile(
  token: string | null,
  input: { headline?: string; category?: string; published?: boolean; avatar_key?: string | null },
): Promise<MyProfile | null> {
  if (!GW || !token) return null;
  try {
    const res = await fetch(`${GW}/api/identity/connection/profile/me`, {
      method: 'PUT', headers: gwHeaders(token), body: JSON.stringify(input), cache: 'no-store',
    });
    if (!res.ok) return null;
    const p = (await res.json().catch(() => ({})))?.data?.profile;
    return p ? {
      username: String(p.username ?? ''), headline: String(p.headline ?? ''), category: String(p.category ?? 'builder'),
      published: Boolean(p.published ?? false), verified: Boolean(p.verified ?? false), featured: Boolean(p.featured ?? false),
      hasAvatar: Boolean(p.has_avatar ?? false),
    } : null;
  } catch { return null; }
}

// The caller's LIVE Connection-Pro entitlement — read from commerce (Subscription
// owner, C-47) with the session JWT. Connection never STORES billing (P5); it
// reflects it to gate FEATURED. Pro only while the period is live. Any failure → false.
export async function resolveProStatus(token: string | null): Promise<boolean> {
  if (!GW || !token) return false;
  try {
    const res = await fetch(`${GW}/api/commerce/subscriptions/status`, { headers: gwHeaders(token), cache: 'no-store' });
    if (!res.ok) return false;
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const root = (d.data ?? d) as Record<string, unknown>;
    // commerce returns { data: { subscription: {...} } } — unwrap the subscription
    // (a flat shape is also tolerated). Missing this returned FREE for real Pro users.
    const s = ((root.subscription ?? root) ?? {}) as Record<string, unknown>;
    const plan = String(s.plan ?? s.tier ?? '').toUpperCase();
    const active  = s.isActive === true || s.active === true || (plan !== '' && plan !== 'FREE');
    const expired = s.isExpired === true;
    const end     = s.current_period_end ?? s.currentPeriodEnd ?? s.expires_at;
    const notExpired = !expired && (!end || new Date(String(end)).getTime() > Date.now());
    return active && notExpired && plan !== '' && plan !== 'FREE';
  } catch { return false; }
}

export interface Follower { username: string; since?: string; mutual: boolean; }

/** The caller's followers + mutual flag (authenticated, own-scope). count + list. */
export async function resolveFollowers(token: string | null): Promise<{ count: number; followers: Follower[] }> {
  if (!GW || !token) return { count: 0, followers: [] };
  try {
    const res = await fetch(`${GW}/api/identity/connection/followers`, { headers: gwHeaders(token), cache: 'no-store' });
    if (!res.ok) return { count: 0, followers: [] };
    const d = (await res.json().catch(() => ({})))?.data ?? {};
    const followers = Array.isArray(d.followers)
      ? d.followers.map((f: Record<string, unknown>) => ({ username: String(f.username ?? ''), since: f.since ? String(f.since) : undefined, mutual: Boolean(f.mutual) }))
      : [];
    return { count: Number(d.count ?? followers.length), followers };
  } catch { return { count: 0, followers: [] }; }
}

/** Connection Pro — sync FEATURED on the caller's own profile to live Pro (visibility only). */
export async function setDirectoryFeatured(token: string | null, on: boolean): Promise<boolean> {
  if (!GW || !token) return false;
  try {
    const res = await fetch(`${GW}/api/identity/connection/directory/featured`, {
      method: 'PATCH', headers: gwHeaders(token), body: JSON.stringify({ featured: on }), cache: 'no-store',
    });
    return res.ok;
  } catch { return false; }
}
