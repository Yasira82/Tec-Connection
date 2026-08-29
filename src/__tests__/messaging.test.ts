// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// TEC Connection (C-107) — Messaging BFF.
//
// A private conversation is the one thing in this app where a routing mistake is
// not a cosmetic bug. So what is pinned here is the boundary, not the feature:
//
//   · no session → 401 BEFORE the gateway is called (P6 fail closed);
//   · the caller's identity is never taken from the request — the route sends no
//     "who am I" field at all, so a client cannot read someone else's thread by
//     editing a body;
//   · `after` reaches the service, because without it every poll refetches the
//     whole history;
//   · the id is URL-encoded on the way through.
const GW = 'https://api.example.com';
process.env.API_GATEWAY_URL = GW;
process.env.INTERNAL_SECRET = 'secret';

const session = { tec_access_token: 'tok', tec_user: JSON.stringify({ id: 'u1', piUsername: 'alice' }) };

const makeReq = (opts: { cookies?: Record<string, string>; body?: unknown; method?: string; url?: string }) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/connection/conversations', {
    method: opts.method ?? 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
};

const ok = (data: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.API_GATEWAY_URL = GW;
  process.env.INTERNAL_SECRET = 'secret';
});

describe('conversations BFF — the session is the only identity', () => {
  it('refuses without a session and never reaches the gateway', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/connection/conversations/route');
    const res = await GET(makeReq({}));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists threads for the session, sending no identity of its own', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ conversations: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/connection/conversations/route');
    const res = await GET(makeReq({ cookies: session }));
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${GW}/api/identity/connection/conversations`);
    // A GET with no body cannot smuggle a username; the service reads the token.
    expect((init as RequestInit)?.body).toBeUndefined();
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe('Bearer tok');
  });
});

describe('opening a direct thread', () => {
  it('forwards ONLY the target username — never the caller', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ conversation: { id: 'c1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/bff/connection/conversations/direct/route');
    await POST(makeReq({ cookies: session, method: 'POST', body: { username: 'bob' } }));

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ username: 'bob' });
    // If a `from`/`me`/`sender` ever appears here, the service could be asked to
    // act as someone else.
    expect(Object.keys(body)).toEqual(['username']);
  });

  it('rejects a missing username before calling the gateway', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/bff/connection/conversations/direct/route');
    const res = await POST(makeReq({ cookies: session, method: 'POST', body: {} }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('reading one thread', () => {
  it('passes `after` through, so a poll fetches only what is new', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ conversation: { id: 'c1', messages: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/connection/conversations/[id]/route');
    await GET(
      makeReq({ cookies: session, url: 'http://localhost/api/bff/connection/conversations/c1?after=2026-01-01T00%3A00%3A00.000Z' }),
      { params: Promise.resolve({ id: 'c1' }) },
    );
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/identity/connection/conversations/c1');
    expect(url).toContain('after=2026-01-01T00%3A00%3A00.000Z');
  });

  it('encodes the id rather than pasting it into the path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ conversation: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/connection/conversations/[id]/route');
    await GET(
      makeReq({ cookies: session, url: 'http://localhost/api/bff/connection/conversations/x' }),
      { params: Promise.resolve({ id: 'a/../b' }) },
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('conversations/a%2F..%2Fb');
  });
});

describe('sending', () => {
  it('rejects an empty body and an oversized one without a round trip', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/bff/connection/conversations/[id]/messages/route');
    const params = { params: Promise.resolve({ id: 'c1' }) };

    expect((await POST(makeReq({ cookies: session, method: 'POST', body: { body: '' } }), params)).status).toBe(400);
    expect((await POST(makeReq({ cookies: session, method: 'POST', body: { body: 'x'.repeat(2001) } }), params)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the text and nothing else', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ message: { id: 'm1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/bff/connection/conversations/[id]/messages/route');
    await POST(
      makeReq({ cookies: session, method: 'POST', body: { body: 'hello' } }),
      { params: Promise.resolve({ id: 'c1' }) },
    );
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ body: 'hello' });
  });
});

describe('blocks', () => {
  it('DELETE maps to the service’s POST /blocks/remove', async () => {
    // The service has no DELETE route; a mismatch here would silently 404 and
    // the person would think they had unblocked someone when they had not.
    const fetchMock = vi.fn().mockResolvedValue(ok({ unblocked: 'bob' }));
    vi.stubGlobal('fetch', fetchMock);
    const { DELETE } = await import('@/app/api/bff/connection/blocks/route');
    await DELETE(makeReq({ cookies: session, method: 'DELETE', body: { username: 'bob' } }));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${GW}/api/identity/connection/blocks/remove`);
    expect((init as RequestInit).method).toBe('POST');
  });

  it('requires a session to read the block list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/connection/blocks/route');
    expect((await GET(makeReq({}))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
