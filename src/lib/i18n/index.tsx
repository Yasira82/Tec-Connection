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
      return;
    }
    // One-time migration from the localStorage-only era. Written back as a
    // cookie so the server can honour it from the next request onward.
    try {
      const legacy = localStorage.getItem('tec_locale');
      if (isLocale(legacy)) {
        setLocaleState(legacy);
        applyDir(legacy);
        document.cookie = `${LOCALE_COOKIE}=${legacy}; path=/; max-age=31536000; samesite=none; secure`;
      }
    } catch { /* storage blocked — keep the server's choice */ }
    // Runs once on mount: this reconciles with what the server already rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyDir(next);
    // The cookie is what the SERVER will read on the next navigation, so the
    // choice has to be written here and not only held in React state.
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=none; secure`;
      localStorage.setItem('tec_locale', next);
    } catch { /* non-fatal: the session still switches, it just won't persist */ }
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
