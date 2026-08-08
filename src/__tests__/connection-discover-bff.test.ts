// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// TEC Connection (C-107) — Discover directory BFF. The public directory + public
// profile need NO session (a Pi-community surface); the caller's own profile is
// authenticated and reconciles FEATURED with the live subscription (Pro = reach
// only, P5). Identity is the session (the backend resolves it from the token),
// never a client field (P6).
const GW = 'https://api.example.com';

// Set at MODULE LOAD (before the dynamic import) so `const GW = process.env.
// API_GATEWAY_URL` in the discovery helper reads it.
process.env.API_GATEWAY_URL = GW;
process.env.INTERNAL_SECRET = 'secret';

const makeReq = (opts: { cookies?: Record<string, string>; body?: unknown; method?: string; url?: string }) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/connection/profile/me', {
    method: opts.method ?? 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
};
const ok = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.API_GATEWAY_URL = GW;
  process.env.INTERNAL_SECRET = 'secret';
});

describe('GET /api/bff/connection/discover (public directory)', () => {
  it('returns live profiles with no session required', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ profiles: [{ username: 'alice', headline: 'h', category: 'builder', verified: true, featured: false, followers: 3 }] }));
    const { GET } = await import('@/app/api/bff/connection/discover/route');
    const res  = await GET(makeReq({ method: 'GET', url: 'http://localhost/api/bff/connection/discover?q=alice&category=builder' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe('live');
    expect(json.profiles[0].username).toBe('alice');
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain(`${GW}/api/identity/connection/discover`);
    fetchSpy.mockRestore();
  });
});

describe('GET /api/bff/connection/profile/[username] (public profile)', () => {
  it('404s an unpublished / unknown profile', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);
    const { GET } = await import('@/app/api/bff/connection/profile/[username]/route');
    const res = await GET(makeReq({ method: 'GET', url: 'http://localhost/api/bff/connection/profile/ghost' }), { params: Promise.resolve({ username: 'ghost' }) });
    expect(res.status).toBe(404);
    fetchSpy.mockRestore();
  });
});

describe('GET /api/bff/connection/profile/me (own profile + featured reconcile)', () => {
  it('401 without a session', async () => {
    const { GET } = await import('@/app/api/bff/connection/profile/me/route');
    const res = await GET(makeReq({ method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('lights up featured when the caller is live Pro + published', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ profile: { username: 'maya', headline: 'h', category: 'builder', published: true, verified: false, featured: false } })) // my profile
      .mockResolvedValueOnce(ok({ plan: 'PRO', isActive: true, isExpired: false }))                                                                      // sub = Pro
      .mockResolvedValueOnce(ok({ updated: true }));                                                                                                     // featured PATCH
    const { GET } = await import('@/app/api/bff/connection/profile/me/route');
    const res  = await GET(makeReq({ method: 'GET', cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.isPro).toBe(true);
    expect(json.profile.featured).toBe(true);
    const patch = fetchSpy.mock.calls.find(([u]) => String(u).endsWith('/api/identity/connection/directory/featured'));
    expect(patch).toBeDefined();
    expect((patch![1] as RequestInit).method).toBe('PATCH');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/bff/connection/followers (Pro Network Insights, gated)', () => {
  it('401 without a session', async () => {
    const { GET } = await import('@/app/api/bff/connection/followers/route');
    const res = await GET(makeReq({ method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('non-Pro sees the COUNT but NOT the follower list (list gated, P5)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ count: 3, followers: [{ username: 'a', mutual: false }] })) // backend followers
      .mockResolvedValueOnce(ok({ plan: 'FREE', isActive: true }));                            // sub = not Pro
    const { GET } = await import('@/app/api/bff/connection/followers/route');
    const res  = await GET(makeReq({ method: 'GET', cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(json.pro).toBe(false);
    expect(json.count).toBe(3);          // count teaser is shown
    expect(json.followers).toEqual([]);  // list withheld
    fetchSpy.mockRestore();
  });

  it('Pro sees the full follower list with mutual flags', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ count: 2, followers: [{ username: 'a', mutual: true }, { username: 'b', mutual: false }] })) // backend
      .mockResolvedValueOnce(ok({ plan: 'PRO', isActive: true, isExpired: false }));                                          // sub = Pro
    const { GET } = await import('@/app/api/bff/connection/followers/route');
    const res  = await GET(makeReq({ method: 'GET', cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(json.pro).toBe(true);
    expect(json.followers).toHaveLength(2);
    expect(json.followers[1]).toEqual({ username: 'b', mutual: false });
    fetchSpy.mockRestore();
  });
});

describe('PUT /api/bff/connection/profile/me (save — identity from session, P6)', () => {
  it('forwards editable fields and NEVER an owner/verified/featured field from the body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ profile: { username: 'maya', headline: 'hi', category: 'builder', published: false, verified: false, featured: false } })); // save (not published → no sub call)
    const { PUT } = await import('@/app/api/bff/connection/profile/me/route');
    const res = await PUT(makeReq({
      method: 'PUT', cookies: { tec_access_token: 'tok' },
      body: { headline: 'hi', category: 'builder', published: false, username: 'HACKER', verified: true, featured: true },
    }));
    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GW}/api/identity/connection/profile/me`);
    const sent = JSON.parse(init.body as string);
    expect(sent).toEqual({ headline: 'hi', category: 'builder', published: false }); // no username/verified/featured
    fetchSpy.mockRestore();
  });
});
