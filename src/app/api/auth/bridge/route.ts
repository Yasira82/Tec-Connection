import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/observability/logger';
import { arrivedSessionCookies } from '@/lib/auth/session-cookies';

// Session bridge — C-123 §11. Keeps LAW 2 (cookies land on a 200, never a 3xx).
//
// What Vercel's logs showed on a phone (2026-09-25), in three apps alike:
//   · `/app` served 200 — the page guard only admits a NAVIGATION that carried
//     both tec_access_token and tec_user;
//   · `/api/auth/me`, fetched by that same page a moment later, arrived with
//     NO session cookie at all (`auth.me_refused` · cookies:none · count 0/1,
//     sec-fetch-site: same-origin).
// Pi Browser gives the page's own requests a different cookie store from its
// navigations. The one cookie that did arrive was the `tec_csrf` the
// middleware sets on any request that lacks one — so that store keeps what is
// written INTO it; it just never received the session.
//
// This route is a navigation, so it arrives WITH the session. It answers a 200
// page whose script writes the same three cookies through `document.cookie` —
// i.e. into the store the page's requests use — and returns to where the
// visitor was. It is the sso-callback landing's fallback (setDocCookies), with
// the session taken from this request instead of a one-time Hub token.
//
// Nothing new is exposed: these cookies are already `httpOnly: false` and the
// landing already writes them from script. A cross-site page can navigate a
// visitor here, but it cannot read the response, and the page only copies the
// visitor's own cookies into the visitor's own browser.
//
// When the navigation did NOT carry the session there is nothing to copy: it
// goes back unchanged, and the caller's once-per-window guard ends it there.

const DEFAULT_REDIRECT = '/app';

/** Same-origin absolute path only: no `//host`, no `/\host`, no scheme. */
const safeRedirect = (raw: string | null): string =>
  raw && /^\/(?![/\\])/.test(raw) ? raw : DEFAULT_REDIRECT;

const MAX_AGE_S = 60 * 60 * 24; // the landing's lifetime; the token's own exp still rules

export function GET(req: NextRequest) {
  const redirect = safeRedirect(req.nextUrl.searchParams.get('redirect'));
  const token    = req.cookies.get('tec_access_token')?.value;
  const user     = req.cookies.get('tec_user')?.value;
  const csrf     = req.cookies.get('tec_csrf')?.value;

  log.info('auth.bridge', { cookies: arrivedSessionCookies(req) });

  if (!token || !user) {
    const back = NextResponse.redirect(new URL(redirect, req.url));
    back.headers.set('Cache-Control', 'no-store');
    return back;
  }

  const cookies = [
    { name: 'tec_access_token', value: token },
    { name: 'tec_user',         value: user },
    ...(csrf ? [{ name: 'tec_csrf', value: csrf }] : []),
  ];
  const esc = (s: string) => s.replace(/</g, '\\u003c');

  // No backticks inside the script — it lives in a template literal.
  // Written exactly like the landing's fallback: host-only, path=/, Secure,
  // SameSite=None, and NOT partitioned — the partitioned copy is the one this
  // page's requests are not receiving (see the REVERSAL note in sso-callback).
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Signing in…</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
</head>
<body><script>
(function () {
  var cookies  = ${esc(JSON.stringify(cookies))};
  var redirect = ${esc(JSON.stringify(redirect))};
  var attrs    = ${JSON.stringify(`; path=/; max-age=${MAX_AGE_S}; secure; samesite=none`)};
  for (var i = 0; i < cookies.length; i++) {
    document.cookie = cookies[i].name + '=' + encodeURIComponent(cookies[i].value) + attrs;
  }
  location.replace(redirect);
})();
</script></body></html>`;

  return new NextResponse(html, {
    status:  200,
    headers: {
      'Content-Type':    'text/html; charset=utf-8',
      'Cache-Control':   'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
