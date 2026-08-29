import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchAcceptLanguage, dirOf, type Locale } from './locales';
import { dictionaryFor, type Dictionary } from './dictionaries';

/**
 * Resolve the visitor's language on the SERVER.
 *
 * The public surfaces are server components, so the previous client-side locale
 * context could not reach them at all: the landing, /discover and /u/<handle>
 * rendered English for everyone, including the crawler and the link preview.
 * That is the half of the app a stranger sees first.
 *
 * Order of authority, strongest first:
 *   1. the `tec_locale` cookie — an explicit choice the person made, and it must
 *      win over anything their device claims;
 *   2. `Accept-Language` — what the browser says, which is right often enough to
 *      be worth using and is the only signal available on a first visit;
 *   3. English.
 *
 * Never throws. A malformed cookie or header falls through to the default rather
 * than failing the render — the front door has to load.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(chosen)) return chosen;
  } catch { /* cookies() unavailable in this context — fall through */ }

  try {
    const detected = matchAcceptLanguage((await headers()).get('accept-language'));
    if (detected) return detected;
  } catch { /* headers() unavailable — fall through */ }

  return DEFAULT_LOCALE;
}

/** Locale + its dictionary + text direction, for a server component. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary; dir: 'ltr' | 'rtl' }> {
  const locale = await getLocale();
  return { locale, t: dictionaryFor(locale), dir: dirOf(locale) };
}
