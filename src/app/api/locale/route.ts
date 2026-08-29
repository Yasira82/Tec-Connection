import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/locales';

// Set the visitor's language and send them back where they were.
//
// A GET route rather than a client handler, on purpose: the language picker on
// the public pages is then a set of plain links, so choosing a language works
// with JavaScript disabled and inside any in-app browser. It is also the reason
// the choice can be applied by the SERVER on the very next render — the public
// surfaces are server components and cannot read a client context.
//
// The redirect target is same-origin ONLY. `next` arrives in the URL, so an
// unchecked value here would be an open redirect on the app's front door: a link
// that sets a cookie and then bounces the visitor to an attacker's page while
// still looking like connection.tecosystem.app.
export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  // Must be a root-relative path. `//evil.com` and `/\evil.com` are
  // protocol-relative URLs that browsers follow off-origin, so they are refused
  // alongside anything carrying a scheme.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.includes('://')) return '/';
  return raw;
}

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang');
  const next = safeNext(req.nextUrl.searchParams.get('next'));

  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin));

  // An unknown code is ignored rather than stored: a bad value would otherwise
  // sit in the cookie and be re-read on every request.
  if (isLocale(lang)) {
    res.cookies.set(LOCALE_COOKIE, lang, {
      httpOnly: false,      // the client provider reads it to stay in sync
      secure:   true,
      sameSite: 'none',     // survives the Hub SSO hop (C-123 LAW 3)
      partitioned: true,
      path:     '/',
      maxAge:   ONE_YEAR,
    });
  }
  return res;
}
