// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Messages BFF — what reaches the service, exactly.
//
// Reported from a phone on 2026-09-28, in the TEC group the campaign sends
// people to: "Reply" posted the text with no quote. The client sent
// `{ body, reply_to }`; the route validated with a schema that only named
// `body`, and zod drops every key it does not name — so the reply target was
// thrown away one hop before the service, which supports it.
const GW = 'https://api.example.com';
process.env.API_GATEWAY_URL = GW;
process.env.INTERNAL_SECRET = 'secret';

const SESSION = {
  tec_access_token: 'tok',
  tec_user: JSON.stringify({ id: 'u1', piUsername: 'alice' }),
};

const makeReq = (url: string, method: string, body?: unknown) => {
  const cookie = Object.entries(SESSION).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  return new NextRequest(url, {
    method,
    headers: { Cookie: cookie, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};
const ok = (data: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => ({ success: true, data }) } as Response);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.env.API_GATEWAY_URL = GW;
  process.env.INTERNAL_SECRET = 'secret';
});

describe('POST /api/bff/connection/conversations/[id]/messages', () => {
  const send = async (payload: unknown) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'm2' }));
    const { POST } = await import('@/app/api/bff/connection/conversations/[id]/messages/route');
    const res = await POST(
      makeReq('http://localhost/api/bff/connection/conversations/c1/messages', 'POST', payload),
      { params: Promise.resolve({ id: 'c1' }) },
    );
    return { res, fetchSpy };
  };

  it('forwards reply_to — a reply must reach the service as a reply', async () => {
    const { res, fetchSpy } = await send({ body: 'thanks', reply_to: 'm1' });
    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GW}/api/identity/connection/conversations/c1/messages`);
    expect(JSON.parse(String(init.body))).toEqual({ body: 'thanks', reply_to: 'm1' });
  });

  it('a plain message still goes out without a reply_to', async () => {
    const { fetchSpy } = await send({ body: 'hello' });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ body: 'hello' });
  });

  it('a reply_to that is not a string is refused, not forwarded', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { POST } = await import('@/app/api/bff/connection/conversations/[id]/messages/route');
    const res = await POST(
      makeReq('http://localhost/api/bff/connection/conversations/c1/messages', 'POST', { body: 'x', reply_to: { $ne: null } }),
      { params: Promise.resolve({ id: 'c1' }) },
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
