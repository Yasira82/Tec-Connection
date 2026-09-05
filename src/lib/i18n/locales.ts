// The languages TEC Connection speaks.
//
// The list is chosen from where Pi Network's communities actually are, not from
// a generic "top languages" table: Chinese, Vietnamese, Korean and Indonesian are
// among the largest Pioneer populations, and the front door was previously
// English-only. A visitor who cannot read the first screen does not become a user.
//
// Adding a locale is: one entry here + one dictionary file. Nothing else needs to
// know the list — the picker, the server resolver and the middleware all read it
// from here, so a language can never be half-added.

export const LOCALES = [
  { code: 'en', native: 'English',    dir: 'ltr' },
  { code: 'zh', native: '中文',        dir: 'ltr' },
  { code: 'vi', native: 'Tiếng Việt', dir: 'ltr' },
  { code: 'ko', native: '한국어',       dir: 'ltr' },
  { code: 'id', native: 'Indonesia',  dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी',       dir: 'ltr' },
  { code: 'es', native: 'Español',    dir: 'ltr' },
  { code: 'pt', native: 'Português',  dir: 'ltr' },
  { code: 'fr', native: 'Français',   dir: 'ltr' },
  { code: 'tr', native: 'Türkçe',     dir: 'ltr' },
  { code: 'ru', native: 'Русский',    dir: 'ltr' },
  { code: 'ar', native: 'العربية',     dir: 'rtl' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'tec_locale';

/**
 * The ONE place the locale cookie's attributes are written.
 *
 * They used to exist twice — here, and as a `document.cookie` string in the
 * client provider — and the two disagreed on `Partitioned`. That is not a
 * cosmetic difference: a browser keeps partitioned and unpartitioned cookies of
 * the same name in SEPARATE jars, so inside Pi Browser (an embedded context)
 * the in-app language picker wrote to a jar nothing reads, while the value the
 * server saw stayed whatever the public picker had set. The language changed
 * on screen and was gone on the next visit.
 *
 * `Partitioned` alongside `None`+`Secure` is C-123 LAW 3 — the embedded context
 * requires all three. `httpOnly: false` because the client provider reads this
 * to stay in sync; it is a display preference, not a credential.
 */
export const LOCALE_COOKIE_OPTIONS = {
  httpOnly:    false,
  secure:      true,
  sameSite:    'none',
  partitioned: true,
  path:        '/',
  maxAge:      60 * 60 * 24 * 365,
} as const;

const CODES = LOCALES.map(l => l.code) as readonly string[];

export const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && CODES.includes(v);

export const dirOf = (code: Locale): 'ltr' | 'rtl' =>
  LOCALES.find(l => l.code === code)?.dir ?? 'ltr';

/**
 * Best locale from an `Accept-Language` header.
 *
 * Deliberately tolerant: it matches on the PRIMARY subtag, so `zh-Hans-CN`,
 * `zh-TW` and `zh` all resolve to `zh`, and `pt-BR` to `pt`. Quality values are
 * honoured in order. An unparseable or unknown header yields null rather than a
 * guess, and the caller falls back to the default — a wrong language is worse
 * than English, because a visitor cannot tell it is a bug.
 */
export function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map(part => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find(p => p.trim().startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .filter(x => x.tag && x.tag !== '*')
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0] ?? '';
    if (isLocale(primary)) return primary;
  }
  return null;
}
