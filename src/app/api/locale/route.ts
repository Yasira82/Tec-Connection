import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, isLocale } from '@/lib/i18n/locales';

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
    res.cookies.set(LOCALE_COOKIE, lang, LOCALE_COOKIE_OPTIONS);
  }
  return res;
}

/**
 * The same choice, from a client that is already on the page.
 *
 * The in-app picker used to write the cookie itself with `document.cookie`, and
 * a string built by hand cannot express `Partitioned` reliably — nor should it
 * have to. One writer, one set of attributes (P1/P2): the picker sends the code
 * here and the server sets exactly the cookie the GET route sets.
 *
 * No redirect: the caller already re-renders itself from React state, so this
 * answers with the stored value and nothing moves.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { lang?: unknown };
  const lang = typeof body.lang === 'string' ? body.lang : null;
  // Unknown code → refuse rather than store. A bad value would otherwise sit in
  // the cookie and be re-read on every request (P6).
  if (!isLocale(lang)) {
    return NextResponse.json({ error: 'UNKNOWN_LOCALE' }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, locale: lang });
  res.cookies.set(LOCALE_COOKIE, lang, LOCALE_COOKIE_OPTIONS);
  return res;
}
