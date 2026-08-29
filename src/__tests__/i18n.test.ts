// @vitest-environment node
//
// Two things here fail SILENTLY if they regress, which is why they get tests
// rather than review:
//
//   · Locale detection. A wrong answer shows a readable page in the wrong
//     language — nothing errors, nothing is logged, and only a speaker of that
//     language would ever report it.
//   · The `next` parameter on /api/locale. It is attacker-controllable and ends
//     up in a redirect, so an unchecked value turns the app's FRONT DOOR into an
//     open redirect: a link that looks like connection.tecosystem.app, sets a
//     cookie, and lands the visitor somewhere else entirely.
//
// The dictionaries are also checked for shape parity. TypeScript already enforces
// that every locale has every KEY (`Dictionary = typeof en`), but not that the
// values were actually translated — an untranslated file would compile happily.
import { describe, it, expect } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, isLocale, dirOf, matchAcceptLanguage } from '@/lib/i18n/locales';
import { DICTIONARIES, dictionaryFor, fill } from '@/lib/i18n/dictionaries';

describe('locale detection from Accept-Language', () => {
  it('matches on the primary subtag, so regional variants resolve', () => {
    expect(matchAcceptLanguage('zh-Hans-CN,zh;q=0.9')).toBe('zh');
    expect(matchAcceptLanguage('pt-BR,pt;q=0.9')).toBe('pt');
    expect(matchAcceptLanguage('ar-EG')).toBe('ar');
  });

  it('honours quality order rather than document order', () => {
    // en appears first but is explicitly the LESS preferred language.
    expect(matchAcceptLanguage('en;q=0.3,vi;q=0.9')).toBe('vi');
  });

  it('skips languages we do not speak and takes the next best', () => {
    expect(matchAcceptLanguage('sv,de;q=0.8,fr;q=0.7')).toBe('fr');
  });

  it('returns null rather than guessing', () => {
    // A wrong language is worse than English: the visitor cannot tell it is a bug.
    expect(matchAcceptLanguage('sv-SE,de-DE')).toBeNull();
    expect(matchAcceptLanguage('*')).toBeNull();
    expect(matchAcceptLanguage('')).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });

  it('survives a malformed header', () => {
    expect(() => matchAcceptLanguage(';;;q=,,')).not.toThrow();
  });
});

describe('the locale registry', () => {
  it('accepts exactly the codes it advertises', () => {
    for (const l of LOCALES) expect(isLocale(l.code)).toBe(true);
    expect(isLocale('sv')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('marks Arabic right-to-left and the rest left-to-right', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    expect(dirOf('zh')).toBe('ltr');
  });
});

describe('dictionaries', () => {
  it('every advertised locale has one', () => {
    // The failure this prevents: adding a locale to LOCALES and forgetting the
    // dictionary, which would render the picker with an option that silently
    // falls back to English.
    for (const l of LOCALES) expect(DICTIONARIES[l.code]).toBeDefined();
    expect(Object.keys(DICTIONARIES).sort()).toEqual(LOCALES.map(l => l.code).sort());
  });

  it('every non-English dictionary is actually translated', () => {
    // TypeScript guarantees the KEYS match; it cannot tell a copied English
    // string from a translation. Checking a few load-bearing sentences catches a
    // file that was stubbed out and never filled in.
    const probes = ['headline', 'lede', 'cta', 'step3Body', 'emptyBody'] as const;
    for (const l of LOCALES) {
      if (l.code === 'en') continue;
      for (const key of probes) {
        expect(
          DICTIONARIES[l.code].public[key],
          `${l.code}.public.${key} is still the English string`,
        ).not.toBe(DICTIONARIES.en.public[key]);
      }
    }
  });

  it('falls back to the default for an unknown code', () => {
    expect(dictionaryFor('sv' as never)).toBe(DICTIONARIES[DEFAULT_LOCALE]);
  });

  it('keeps the {name} and {date} placeholders every locale needs', () => {
    for (const l of LOCALES) {
      expect(DICTIONARIES[l.code].public.follow, `${l.code} follow`).toContain('{name}');
      expect(DICTIONARIES[l.code].public.since,  `${l.code} since`).toContain('{date}');
    }
  });
});

describe('placeholder filling', () => {
  it('substitutes known tokens', () => {
    expect(fill('Follow @{name}', { name: 'sara' })).toBe('Follow @sara');
    expect(fill('On TEC since {date}', { date: 'March 2026' })).toBe('On TEC since March 2026');
  });

  it('leaves an unknown token visible rather than blanking it', () => {
    // A missing value should look like a bug, not like intentionally empty copy.
    expect(fill('Hello {missing}', {})).toBe('Hello {missing}');
  });
});

describe('/api/locale redirect target (open-redirect guard)', () => {
  // safeNext is not exported — the route is the unit under test, so the rule is
  // asserted through it. Each of these is a real bypass of a naive
  // `startsWith('/')` check.
  const load = async () => (await import('@/app/api/locale/route')).GET;
  const call = async (url: string) => {
    const GET = await load();
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest(url, { method: 'GET' }));
    return new URL(res.headers.get('location') as string);
  };

  it('follows a root-relative path', async () => {
    const u = await call('https://connection.tecosystem.app/api/locale?lang=vi&next=%2Fdiscover');
    expect(u.host).toBe('connection.tecosystem.app');
    expect(u.pathname).toBe('/discover');
  });

  it('refuses a protocol-relative URL', async () => {
    // `//evil.com` starts with '/' but browsers follow it off-origin.
    const u = await call('https://connection.tecosystem.app/api/locale?lang=vi&next=%2F%2Fevil.com');
    expect(u.host).toBe('connection.tecosystem.app');
    expect(u.pathname).toBe('/');
  });

  it('refuses a backslash-smuggled URL', async () => {
    const u = await call('https://connection.tecosystem.app/api/locale?lang=vi&next=%2F%5Cevil.com');
    expect(u.host).toBe('connection.tecosystem.app');
    expect(u.pathname).toBe('/');
  });

  it('refuses an absolute URL', async () => {
    const u = await call('https://connection.tecosystem.app/api/locale?lang=vi&next=https%3A%2F%2Fevil.com');
    expect(u.host).toBe('connection.tecosystem.app');
    expect(u.pathname).toBe('/');
  });

  it('stores a known locale and ignores an unknown one', async () => {
    const GET = await load();
    const { NextRequest } = await import('next/server');

    const good = await GET(new NextRequest('https://connection.tecosystem.app/api/locale?lang=ko&next=%2F'));
    expect(good.cookies.get('tec_locale')?.value).toBe('ko');

    // An unknown code must not be persisted — it would be re-read on every
    // request and could never resolve to a dictionary.
    const bad = await GET(new NextRequest('https://connection.tecosystem.app/api/locale?lang=xx&next=%2F'));
    expect(bad.cookies.get('tec_locale')).toBeUndefined();
  });
});
