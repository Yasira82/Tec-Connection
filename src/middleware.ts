import { NextRequest, NextResponse } from 'next/server';

// ── Per-app config — adjust for the new app ──────────────────────────
const PROTECTED_ROUTES  = ['/app', '/dashboard', '/profile', '/settings'];
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Where a session-less guarded page goes to sign in. A real https URL or the
// Mainnet Hub — a placeholder such as `C_HUB_URL` once became the redirect
// target and 404'd login across the fleet. Login is NOT network-routed: the
// Mainnet Hub signs sessions for Testnet hosts too (lib/pi-network.ts).
const HUB_URL = /^https?:\/\//i.test((process.env.NEXT_PUBLIC_HUB_URL ?? '').trim())
  ? (process.env.NEXT_PUBLIC_HUB_URL as string).trim()
  : 'https://hub.tecosystem.app';
// Marks the one SSO round trip a guarded page may start (see the guard).
const SSO_TRIED = '__sso';
const CSRF_PROTECTED    = [
  '/api/auth/logout',
  '/api/auth/pi-login', // a sign-in is a state change too (login CSRF)
  '/api/auth/refresh',
  '/api/bff/',          // all BFF routes (payment, orders, …)
  '/api/payment',
];

// Double-submit CSRF token cookie. Not a secret — same-origin policy stops
// cross-origin attackers from reading it. httpOnly:false so client JS can
// echo it back in the x-csrf-token header.
const CSRF_COOKIE_OPTS = {
  httpOnly: false,
  secure:   true,
  sameSite: 'none' as const,
  partitioned: true,
  path:     '/',
  maxAge:   60 * 60 * 24,
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

// CSRF is enforced in EXACTLY ONE place — here. A state-changing request is
// trusted if EITHER the double-submit token matches OR it is first-party
// (same-origin / a *.tecosystem.app origin).
//
// ⚠️ DO NOT re-validate CSRF inside a route handler. Pure double-submit is
// unreliable across SSO domains and inside Pi Browser (sameSite=None cookies
// get dropped) → legit payment/order POSTs 403. Verifying the Origin is an
// OWASP-recommended, cookie-independent CSRF defence; a cross-site attacker
// cannot forge the browser-set Origin header. (See KB C-12 §11. A CI guard
// blocks route-level CSRF checks.)
function isTrustedCsrf(req: NextRequest): boolean {
  const cookie = req.cookies.get('tec_csrf')?.value ?? '';
  const header = req.headers.get('x-csrf-token') ?? '';
  if (cookie && header && timingSafeStringEqual(cookie, header)) return true;

  const host   = req.headers.get('host') ?? '';
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const oh = new URL(origin).host;
      if (oh === host || oh.endsWith('.tecosystem.app')) return true;
    } catch { /* malformed Origin → not trusted */ }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method       = req.method.toUpperCase();

  // ── Page auth guard ──────────────────────────────────────
  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('tec_access_token')?.value;
    // A session is BOTH cookies — the same definition `/api/auth/me` uses.
    //
    // This guard used to accept the token alone. When `tec_user` had lapsed
    // and the token had not, the page opened and then every screen said
    // "Not signed in": the guard and `/me` disagreed about what a session is,
    // and the person was stranded between them with no way to sign in. A half
    // session now counts as none, so it goes through the Hub's SSO — which is
    // silent when the Hub session is good — and comes back whole (P6: when in
    // doubt about identity, do not proceed as if there were one).
    const user  = req.cookies.get('tec_user')?.value;
    if (!token || token.trim() === '' || !user || user.trim() === '') {
      // No session in THIS context → through the Hub's SSO, straight away (C-123 §3, §11).
      //
      // This guard sat at the repo root beside `src/app`, where Next.js never
      // loads a middleware — so for the whole life of the app it did not run,
      // `/app` opened for anyone, and a visit from the Quest (standalone, §9)
      // showed "Not signed in" instead of signing in. It used to send the
      // visitor to `/`, which only offers a button; the Hub's SSO is silent when
      // the Hub is signed in in this context, and asks when it is not.
      //
      // `__sso=1` rides the round trip so it happens ONCE: if the landing comes
      // back and the context still refused the cookies (LAW 3), the page opens
      // as it is (§7) instead of bouncing between here and the Hub.
      //
      // The QUERY comes too, as before: `/app?invite=CODE` must survive sign-in.
      if (req.nextUrl.searchParams.get(SSO_TRIED) === '1') return NextResponse.next();
      const back = new URL(req.nextUrl.pathname + req.nextUrl.search, req.nextUrl.origin);
      back.searchParams.set(SSO_TRIED, '1');
      const sso = new URL('/api/auth/sso', HUB_URL);
      sso.searchParams.set('target', back.toString());
      return NextResponse.redirect(sso);
    }
  }

  // ── Unsafe method → CSRF (double-submit OR first-party origin) ────────
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some(r => pathname.startsWith(r));
    if (isCsrfProtected && !isTrustedCsrf(req)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // ── Safe method → ensure a tec_csrf cookie exists ────────
  const res = NextResponse.next();
  if (!req.cookies.get('tec_csrf')?.value) {
    res.cookies.set('tec_csrf', crypto.randomUUID(), CSRF_COOKIE_OPTS);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
