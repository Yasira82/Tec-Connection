/**
 * The session bridge (C-123 §11).
 *
 * Seen in Vercel's logs on a phone: `/app` served (its navigation carried the
 * session — the guard admits nothing else) and `/me` from that same page
 * arrived with NO session cookie. The bridge is a navigation, so it has the
 * session, and it writes it into the store the page's own requests use.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as bridge } from '../app/api/auth/bridge/route';
import { bridgeSession, bridgedRecently } from '../lib/auth/session-bridge';

const call = (url: string, cookies: Record<string, string> = {}) => {
  const req = new NextRequest(url);
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
  return bridge(req);
};

const SESSION = { tec_access_token: 'tok.en', tec_user: '{"piUsername":"pioneer"}', tec_csrf: 'c1' };

describe('GET /api/auth/bridge', () => {
  it('answers a 200 page (LAW 2) that writes the session from script and goes back', async () => {
    const res = await call('https://app.tecosystem.app/api/auth/bridge?redirect=%2Fapp%3Fq%3D1', SESSION);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const html = await res.text();
    expect(html).toContain('"tec_access_token"');
    expect(html).toContain('"tec_user"');
    expect(html).toContain('"tec_csrf"');
    expect(html).toContain('location.replace(redirect)');
    expect(html).toContain('"/app?q=1"');
    // Written like the landing's fallback — NOT partitioned (see sso-callback).
    expect(html).toContain('secure; samesite=none');
    expect(html).not.toMatch(/partitioned/i);
    // …and it never sets a cookie itself: the copy is the script's job.
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('cannot break out of the page: </script> in a value is escaped', async () => {
    const res = await call('https://app.tecosystem.app/api/auth/bridge', {
      ...SESSION, tec_user: '</script><script>alert(1)</script>',
    });
    expect(await res.text()).not.toContain('</script><script>alert(1)');
  });

  it('refuses an off-site redirect', async () => {
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      const res = await call(`https://app.tecosystem.app/api/auth/bridge?redirect=${encodeURIComponent(bad)}`, SESSION);
      expect(await res.text()).toContain('"/app"');
    }
  });

  it('with no session in the navigation either, goes straight back — nothing to copy', async () => {
    const res = await call('https://app.tecosystem.app/api/auth/bridge?redirect=%2Fapp', { tec_csrf: 'c' });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.tecosystem.app/app');
  });
});

describe('bridgeSession()', () => {
  const replace = vi.fn();
  const at = (pathname: string) => Object.defineProperty(window, 'location', {
    configurable: true, value: { pathname, search: '?x=1', replace },
  });

  beforeEach(() => { sessionStorage.clear(); replace.mockReset(); at('/app'); });

  it('starts on a guarded page whose own request had no session', () => {
    expect(bridgeSession('no_token', 1_000)).toBe('navigating');
    expect(replace).toHaveBeenCalledWith('/api/auth/bridge?redirect=%2Fapp%3Fx%3D1');
    expect(bridgedRecently(2_000)).toBe(true);
  });

  it('never for any other reason', () => {
    for (const r of [null, 'bad_user', 'http_503', 'network']) expect(bridgeSession(r)).toBe('not-needed');
    expect(replace).not.toHaveBeenCalled();
  });

  it('never on a page the guard does not protect — its navigation proves nothing', () => {
    at('/');
    expect(bridgeSession('no_token')).toBe('not-guarded');
    expect(replace).not.toHaveBeenCalled();
  });

  it('CANNOT LOOP: once per tab per window', () => {
    expect(bridgeSession('no_token', 1_000)).toBe('navigating');
    expect(bridgeSession('no_token', 2_000)).toBe('already-tried');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(bridgeSession('no_token', 1_000 + 10 * 60 * 1000 + 1)).toBe('navigating');
  });
});
