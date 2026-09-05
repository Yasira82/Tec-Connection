'use client';

// Client-side locale context for the authenticated app.
//
// ── What changed and why ─────────────────────────────────────────────────────
// This provider used to hold the ONLY source of locale, in localStorage, with
// two languages. That made the three public surfaces — which are server
// components — permanently English: a server render cannot read a client
// context or localStorage, so the front door spoke one language regardless of
// what the visitor had chosen inside the app.
//
// The source of truth is now the `tec_locale` COOKIE, which both sides can read:
// the server resolves it during render (src/lib/i18n/server.ts) and this provider
// reads the same value so the two can never disagree. localStorage is still read
// once, only to carry over a choice made by the previous version.
//
// `initialLocale` comes from the server layout, so the first client render already
// matches the HTML that was delivered — otherwise every page would flash English
// before hydration.
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirOf, isLocale, type Locale } from './locales';
import { dictionaryFor, fill, type Dictionary } from './dictionaries';

export { LOCALES } from './locales';
export type { Locale };

interface LocaleContextValue {
  locale:    Locale;
  setLocale: (locale: Locale) => void;
  t:         Dictionary;
  dir:       'ltr' | 'rtl';
  /** Fill `{token}` placeholders — `format(t.connection.welcomeName, { name })`. */
  format:    (template: string, values: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find(c => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

/**
 * Store the choice — on the SERVER, which is the only writer of this cookie.
 *
 * This used to be a `document.cookie` string written here, and it silently
 * failed in the one browser that matters. A hand-built string cannot express
 * `Partitioned`, and inside Pi Browser (an embedded context) an unpartitioned
 * `SameSite=None` cookie goes into a jar nothing reads — so the language
 * changed on screen, then came back as it was on the next visit. The server
 * route sets one cookie with one set of attributes; see /api/locale.
 *
 * Best-effort: a failed request leaves the language switched for this session
 * and localStorage still holds it for the next one.
 */
async function persist(locale: Locale): Promise<void> {
  try {
    await fetch('/api/locale', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: locale }),
    });
  } catch { /* offline — the choice still applies to this session */ }
}

function applyDir(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('dir', dirOf(locale));
  document.documentElement.setAttribute('lang', locale);
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const fromCookie = readCookie(LOCALE_COOKIE);
    if (isLocale(fromCookie)) {
      if (fromCookie !== locale) { setLocaleState(fromCookie); applyDir(fromCookie); }
      // Mirror it, so localStorage can never hold a STALER choice than the
      // cookie and then override it below. The public picker sets the cookie
      // through a plain link and never touches storage, so without this a
      // language chosen on the landing page would be undone on the next
      // in-app load by an older choice.
      try { localStorage.setItem('tec_locale', fromCookie); } catch { /* blocked */ }
      return;
    }
    // No cookie: either a first visit, or the browser refused to store it.
    // localStorage is then the ONLY record of a choice, so it is honoured and
    // re-sent to the server — the one thing that writes the cookie.
    try {
      const legacy = localStorage.getItem('tec_locale');
      if (isLocale(legacy)) {
        setLocaleState(legacy);
        applyDir(legacy);
        void persist(legacy);
      }
    } catch { /* storage blocked — keep the server's choice */ }
    // Runs once on mount: this reconciles with what the server already rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // On screen immediately — the request below is what makes it survive, not
    // what makes it happen.
    setLocaleState(next);
    applyDir(next);
    void persist(next);
    try { localStorage.setItem('tec_locale', next); } catch { /* storage blocked */ }
  }, []);

  return (
    <LocaleContext.Provider value={{
      locale,
      setLocale,
      t:      dictionaryFor(locale),
      dir:    dirOf(locale),
      format: fill,
    }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useTranslation must be used within LocaleProvider');
  return context;
}
