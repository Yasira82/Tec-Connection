import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inviteUrl, joinByInvite } from '@/lib-client/connection/useInvite';

// The invite link, and the two things about it that are easy to get wrong.
//
// 1. It is built from the browser's OWN origin. This app answers on two
//    hostnames — the domain and the Vercel one — and a link that hard-coded
//    either would send half the people who tap it to the host where their
//    session cookie is not. The link would look broken, and the cause would be
//    invisible from the screenshot.
//
// 2. A refused redemption is one answer, not two. Upstream deliberately reports
//    a wrong code and a withdrawn code identically; a client that told them
//    apart would hand back the very oracle the service refuses to be.

const origin = (o: string) => {
  Object.defineProperty(window, 'location', {
    value: new URL(o), writable: true, configurable: true,
  });
};

describe('inviteUrl', () => {
  it('is built from the current origin, whichever host that is', () => {
    origin('https://connection.tecosystem.app/app');
    expect(inviteUrl('abc123')).toBe('https://connection.tecosystem.app/app?invite=abc123');

    origin('https://tec-connection.vercel.app/app');
    expect(inviteUrl('abc123')).toBe('https://tec-connection.vercel.app/app?invite=abc123');
  });

  it('encodes the code', () => {
    origin('https://connection.tecosystem.app/app');
    // base64url has no characters needing escape, but the code is a value from
    // the server and this function must not be the place that assumes so.
    expect(inviteUrl('a+b/c=')).toBe('https://connection.tecosystem.app/app?invite=a%2Bb%2Fc%3D');
  });
});

describe('joinByInvite', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the conversation on success, unwrapping the nested envelope', async () => {
    // The gateway envelope is `{ success, data: {...} }`. Reading it flat gives
    // `undefined` with no error — the exact shape of the Session 27 incident.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'c1', title: 'TEC', joined: true } }),
    });
    await expect(joinByInvite('a-real-code')).resolves.toEqual({ id: 'c1' });
  });

  it('gives ONE answer for a wrong code and a withdrawn one', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(joinByInvite('made-up')).resolves.toBeNull();
  });

  it('is null when the network fails, not a throw', async () => {
    // A thrown error here reaches a click handler and becomes an unhandled
    // rejection; the screen would sit on "joining…" forever.
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(joinByInvite('a-real-code')).resolves.toBeNull();
  });

  it('is null when a 200 carries no id — a contract break is not a success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    await expect(joinByInvite('a-real-code')).resolves.toBeNull();
  });

  it('sends the code in the body, never in the URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'c1' } }) });
    await joinByInvite('a-real-code');
    // Asserted rather than destructured. `mock.calls[0]` is possibly undefined
    // under this project's strict index checks, and destructuring it is what
    // failed CI while passing every local run of the tests themselves — a type
    // error is invisible to the test runner.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    // A code in a query string lands in access logs and browser history. It is
    // a credential; it travels in the body.
    expect(call[0]).not.toContain('a-real-code');
    expect(JSON.parse(call[1].body)).toEqual({ code: 'a-real-code' });
  });
});

describe('the invite waits for the session before it is spent', () => {
  const src = () =>
    readFileSync(join(process.cwd(), 'src/app/app/page.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('does not redeem until /api/auth/me has answered', () => {
    // Arriving on an invite link means arriving without a session yet. The
    // redemption fired on mount, was made logged-out, came back 401, and the
    // screen said "That link is not valid any more" — about a link that was
    // perfectly good.
    expect(src()).toMatch(/if \(me\.loading\) return;/);
    expect(src()).toMatch(/\[me\.loading, me\.authenticated\]/);
  });

  it('holds the code across a sign-in instead of losing it', () => {
    // The code is stripped from the address bar on arrival, so once the first
    // attempt failed there was nothing left to retry with.
    expect(src()).toMatch(/sessionStorage\.setItem\(PENDING_INVITE/);
    expect(src()).toMatch(/sessionStorage\.getItem\(PENDING_INVITE/);
  });

  it('clears the code once it is spent, however it went', () => {
    // A success must not replay; a genuinely dead code must not re-fail on
    // every visit for the rest of the session.
    expect(src()).toMatch(/removeItem\(PENDING_INVITE/);
  });

  it('says SIGN IN rather than "not valid" when there is no session', () => {
    expect(src()).toMatch(/setInviteState\('needsAuth'\)/);
    expect(src()).toMatch(/inviteNeedsAuth/);
  });

  it('paints needsAuth as a next step, not an error', () => {
    // Red on a good link tells somebody it is broken.
    expect(src()).toMatch(/inviteState === 'failed' \? errorA\(0\.1\) : goldA/);
  });
});

describe('the login redirect keeps the invite', () => {
  const mw = () =>
    readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('carries the QUERY, not just the path', () => {
    // `/app` is protected, and the guard sent back `pathname` alone — so
    // `/app?invite=CODE` became `/app` and the invite was destroyed before the
    // page it was meant for ever ran. Someone who already had a session for
    // THIS origin skipped the branch entirely, which is exactly why it worked
    // for one account and not the other.
    expect(mw()).toMatch(/pathname \+ req\.nextUrl\.search/);
  });

  it('is READ by the landing, not dropped a second time', () => {
    // The middleware fix is inert on its own: handleLogin hard-coded `/app`, so
    // an invite that survived the bounce was thrown away here instead — and the
    // person arrived signed in, on the right app, nowhere near the group.
    const landing = readFileSync(join(process.cwd(), 'src/components/landing/Landing.tsx'), 'utf8');
    expect(landing).toMatch(/searchParams\.get\('redirect'\)/);
    expect(landing).toMatch(/ssoRedirect\(HUB_URL, `\$\{APP_URL\}\$\{target\(\)\}`\)/);
    expect(landing).toMatch(/router\.replace\(target\(\)\)/);
  });

  it('refuses a redirect that could leave the origin', () => {
    // `//evil.com` is protocol-relative — browsers treat it as external, which
    // is why startsWith('/') alone is not enough.
    const landing = readFileSync(join(process.cwd(), 'src/components/landing/Landing.tsx'), 'utf8');
    expect(landing).toMatch(/!raw\.startsWith\('\/\/'\)/);
  });

  it('still sends them to the landing, not somewhere a caller chose', () => {
    // The destination is ours; only the return path is taken from the request,
    // and sso-callback refuses anything that is not a same-origin absolute path.
    expect(mw()).toMatch(/new URL\('\/', req\.url\)/);
  });
});
