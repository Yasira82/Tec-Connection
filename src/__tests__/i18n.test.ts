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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('the IN-APP strings are translated too, not just the public pages', () => {
    // The failure this exists for was visible on a phone: the public surfaces
    // were translated while every card inside /app stayed English, so choosing
    // Arabic produced a half-translated screen. A partly translated screen reads
    // as broken; an untranslated one only reads as unsupported.
    //
    // Measured in AGGREGATE rather than per key. A per-key inequality rule looks
    // stricter but is wrong: "Notifications" is genuinely the French word, and
    // "Connection Pro" is a product name in every language. Demanding that each
    // string differ would fail on correct translations and teach the next person
    // to mangle a word to get green. A stubbed-out file, which is what this
    // actually guards against, fails the ratio by a wide margin.
    const keys = Object.keys(DICTIONARIES.en.app) as (keyof typeof DICTIONARIES.en.app)[];
    for (const l of LOCALES) {
      if (l.code === 'en') continue;
      const differing = keys.filter(k => DICTIONARIES[l.code].app[k] !== DICTIONARIES.en.app[k]);
      const ratio = differing.length / keys.length;
      expect(
        ratio,
        `${l.code}.app looks untranslated — only ${differing.length}/${keys.length} strings differ from English`,
      ).toBeGreaterThan(0.85);
    }
  });

  it('keeps the {days} placeholder the Pro expiry line needs', () => {
    for (const l of LOCALES) {
      expect(DICTIONARIES[l.code].app.proExpires, `${l.code} proExpires`).toContain('{days}');
    }
  });

  it('keeps the ✅ prefix the UI uses to colour a success message', () => {
    // AvatarUpload and ProfileEditor decide green-vs-red with
    // `msg.startsWith('✅')`. A translation that dropped the emoji would render
    // a successful save in the error colour — no test, no error, just wrong.
    for (const l of LOCALES) {
      expect(DICTIONARIES[l.code].app.photoUpdated, `${l.code} photoUpdated`).toMatch(/^✅/);
      expect(DICTIONARIES[l.code].app.savedPublic,  `${l.code} savedPublic`).toMatch(/^✅/);
      expect(DICTIONARIES[l.code].app.savedHidden,  `${l.code} savedHidden`).toMatch(/^✅/);
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

describe('the language control in Settings', () => {
  // It was a wrapping wall of twelve pills — three rows of chips, taller than
  // every other setting combined, pushing About off the screen. A language is
  // chosen roughly once; it should not be the largest thing in Settings.
  // Explorer had already settled this with a select; this pins the parity.
  const src = readFileSync(
    join(process.cwd(), 'src/app/app/components/SettingsView.tsx'), 'utf8',
  );
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  it('is a select over LOCALES, not a grid of buttons', () => {
    expect(code).toMatch(/<select[\s\S]{0,400}LOCALES\.map/);
    expect(code).not.toMatch(/LOCALES\.map[\s\S]{0,200}<button/);
  });

  it('lists every language in its own script', () => {
    // Someone who cannot read the current interface language cannot read
    // "Vietnamese" either — but they can always read "Tiếng Việt". That is the
    // whole reason a language menu lists native names.
    expect(code).toMatch(/<option[\s\S]{0,160}l\.native/);
    for (const l of LOCALES) expect(l.native.trim().length).toBeGreaterThan(0);
  });

  it('marks each option with its own lang, so the browser picks the right font', () => {
    expect(code).toMatch(/<option[\s\S]{0,120}lang=\{l\.code\}/);
  });
});
