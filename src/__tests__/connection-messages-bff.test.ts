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

// Railway, 2026-09-28: identity-service logged `FST_ERR_CTP_EMPTY_JSON_BODY —
// Body cannot be empty when content-type is set to 'application/json'` on every
// body-less call this BFF made. The helper sent `Content-Type: application/json`
// whether or not there was a body, and the service's Fastify refuses a JSON
// content type with nothing in it — so "Delete for everyone" (and every other
// action with no body) failed with a 400 the screen could only call "failed".
describe('callConnection — a request with no body carries no JSON content type', () => {
  it('DELETE message: no Content-Type, no body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ deleted: true, scope: 'everyone', mediaKey: null }));
    const { DELETE } = await import('@/app/api/bff/connection/conversations/[id]/messages/[messageId]/route');
    const res = await DELETE(
      makeReq('http://localhost/api/bff/connection/conversations/c1/messages/m1?scope=everyone', 'DELETE'),
      { params: Promise.resolve({ id: 'c1', messageId: 'm1' }) },
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GW}/api/identity/connection/conversations/c1/messages/m1?scope=everyone`);
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    expect(init.body).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('a request WITH a body still says it is JSON', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'm2' }));
    const { POST } = await import('@/app/api/bff/connection/conversations/[id]/messages/route');
    await POST(
      makeReq('http://localhost/api/bff/connection/conversations/c1/messages', 'POST', { body: 'hi' }),
      { params: Promise.resolve({ id: 'c1' }) },
    );
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
