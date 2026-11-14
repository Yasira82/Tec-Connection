/**
 * The referral loop (C-133): `?ref=CODE` on any page → kept until the visitor
 * signs in → applied once to THEIR account through this app's BFF → commerce
 * attributes it. It ran in sixteen apps with no test in any of them; it came into
 * the template on 14 Nov 2026 (TEC-AUDIT-0044) with this one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { captureRef, getPendingRef, clearPendingRef, applyReferral, REF_KEY } from '@/lib-client/referral';

const clearCookies = () => {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
};

beforeEach(() => { sessionStorage.clear(); clearCookies(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('capturing a code from an invite link', () => {
  it('keeps a valid code, upper-cased, in the tab and in a cookie that survives the SSO redirect', () => {
    expect(captureRef('?ref=ab12cd34')).toBe('AB12CD34');
    expect(sessionStorage.getItem(REF_KEY)).toBe('AB12CD34');
    expect(document.cookie).toContain(`${REF_KEY}=AB12CD34`);
    expect(getPendingRef()).toBe('AB12CD34');
  });

  it('refuses anything that is not a short alphanumeric code — it becomes a cookie value', () => {
    for (const bad of ['?ref=AB;path=/', '?ref=<script>', '?ref=' + 'A'.repeat(17), '?ref=', '?other=1']) {
      expect(captureRef(bad)).toBe('');
    }
    expect(getPendingRef()).toBe('');
  });

  it('a cookie alone is enough (a fresh tab after the redirect)', () => {
    document.cookie = `${REF_KEY}=XY7; path=/`;
    expect(getPendingRef()).toBe('XY7');
  });

  it('clearing removes it from both places', () => {
    captureRef('?ref=AB12');
    clearPendingRef();
    expect(getPendingRef()).toBe('');
  });
});

describe('applying it once signed in', () => {
  const answer = (status: number) => vi.fn(async (_u: string | URL, _i?: RequestInit) => new Response('{}', { status }));

  it('posts the code — and only the code — to this app\'s BFF with the CSRF header', async () => {
    document.cookie = 'tec_csrf=csrf-1; path=/';
    const f = answer(200);
    vi.stubGlobal('fetch', f);
    expect(await applyReferral('ab12')).toBe('applied');
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('/api/referral');
    expect(JSON.parse(String(init!.body))).toEqual({ code: 'AB12' });
    expect((init!.headers as Record<string, string>)['x-csrf-token']).toBe('csrf-1');
  });

  it('a refusal (own code, already referred, past the window) is final; a server error is retried later', async () => {
    vi.stubGlobal('fetch', answer(409));
    expect(await applyReferral('AB12')).toBe('consumed');
    vi.stubGlobal('fetch', answer(400));
    expect(await applyReferral('AB12')).toBe('consumed');
    vi.stubGlobal('fetch', answer(502));
    expect(await applyReferral('AB12')).toBe('retry');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect(await applyReferral('AB12')).toBe('retry');
  });

  it('a junk code is never sent', async () => {
    const f = answer(200);
    vi.stubGlobal('fetch', f);
    expect(await applyReferral('AB;CD')).toBe('consumed');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('the BFF route', () => {
  // isE2eMode() is true whenever CI=true; this exercises the real forward.
  const realNetwork = () => {
    vi.stubEnv('E2E_MODE', '');
    vi.stubEnv('NEXT_PUBLIC_E2E_MODE', '');
    vi.stubEnv('E2E_ALLOW_NETWORK', 'true');
    vi.stubEnv('API_GATEWAY_URL', 'https://gw.internal');
  };
  const post = (body: unknown, token: string | null = 'tok') => {
    const r = new NextRequest('https://app.test/api/referral', { method: 'POST', body: JSON.stringify(body) } as never);
    if (token) r.cookies.set('tec_access_token', token);
    return r;
  };

  it('no session → 401, and nothing is forwarded (P6)', async () => {
    realNetwork();
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.resetModules();
    const { POST } = await import('@/app/api/referral/route');
    expect((await POST(post({ code: 'AB12' }, null))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it('the account is the session\'s: the token goes to commerce, a body userId does not', async () => {
    realNetwork();
    const f = vi.fn(async (_u: string | URL, _i?: RequestInit) => new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    vi.resetModules();
    const { POST } = await import('@/app/api/referral/route');
    expect((await POST(post({ code: 'AB12', userId: 'someone-else' }))).status).toBe(200);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://gw.internal/api/commerce/referral/attribute');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init!.body))).toEqual({ code: 'AB12' });
    expect(init!.signal).toBeDefined(); // it has a deadline (TEC-AUDIT-0033)
  });

  it('no code → 400; commerce unreachable → 503', async () => {
    realNetwork();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    vi.resetModules();
    const { POST } = await import('@/app/api/referral/route');
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ code: 'AB12' }))).status).toBe(503);
  });
});
