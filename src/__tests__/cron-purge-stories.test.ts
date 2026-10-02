/**
 * The nightly story sweep must send a JSON body.
 *
 * identity-service logged, every night at 03:37 UTC, Fastify's
 * "Body cannot be empty when content-type is set to 'application/json'": the
 * cron POSTed with that content type and no body, the call was refused, and no
 * lapsed status (or its photo) was ever purged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.resetModules();
  process.env.API_GATEWAY_URL = 'https://gw.internal';
  process.env.INTERNAL_SECRET = 'internal-secret';
  process.env.CRON_SECRET     = 'cron-secret';
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('GET /api/cron/purge-stories', () => {
  it('POSTs to identity with a JSON body, never an empty one', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: true, data: { deleted: 0, mediaKeys: [] } }), { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('../app/api/cron/purge-stories/route');
    const res = await GET(new NextRequest('https://connection.tecosystem.app/api/cron/purge-stories', {
      headers: { authorization: 'Bearer cron-secret' },
    }));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/identity/connection/stories/purge-expired');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{}');
  });
});
