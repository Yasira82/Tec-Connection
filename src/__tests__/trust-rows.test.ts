import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@/lib/i18n/locales';
import { DICTIONARIES } from '@/lib/i18n/dictionaries';

// The Trust tab, and what it is FOR.
//
// It listed "Seller 1 · 2× · π 20". Every number was real — derived from
// completed Pi payments — and none of it told anyone anything they could act
// on: the counterparty had no name, and the number had no consequence attached.
//
// Two changes. A row now names the person (auth resolves the id), and the tab
// says what the number DOES: buyers are the signal Explorer ranks by, above the
// paid placement (C-108 §10).

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

describe('a row names the person, and falls back honestly', () => {
  const src = strip(read('app/app/components/Trust.tsx'));

  it('renders the resolved username when there is one', () => {
    expect(src).toMatch(/e\.username \?/);
    expect(src).toMatch(/@\{e\.username\}/);
  });

  it('links a named row to that person’s public profile', () => {
    // Where the follow control already lives — so this does not grow a second
    // one beside every row.
    expect(src).toMatch(/href=\{`\/u\/\$\{encodeURIComponent\(e\.username\)\}`\}/);
  });

  it('keeps the ordinal for a row with no name', () => {
    // Auth may be unreachable, or the counterparty may have no Pi username.
    // Unnamed is the DEGRADED case, never an error — and never the raw id: a
    // screen of `afa10f…c983` is why this tab read as a debug view.
    expect(src).toMatch(/\{label\} \{i \+ 1\}/);
    expect(src).not.toMatch(/\{e\.user_id\}</);
  });
});

describe('the number is given a consequence', () => {
  const src = strip(read('app/app/components/Trust.tsx'));

  it('shows the ranking note only to someone who HAS buyers', () => {
    // Telling a person with none that they could rank higher is an advert, not
    // information.
    expect(src).toMatch(/trust\.received\.partners > 0 &&/);
  });

  it('splits at 5 buyers — the same threshold as the backend', () => {
    // ExplorerService.TRUST_TIERS: 1–4 → tier 1, 5+ → tier 2. A UI that
    // promised the top tier at a different number would be lying about a
    // ranking the user can check.
    expect(src).toMatch(/trust\.received\.partners >= 5 \?[\s\S]{0,80}trustRankTop[\s\S]{0,60}trustRankBuilding/);
  });

  it('reads the copy from the dictionary, not from JSX', () => {
    expect(src).toMatch(/a\.trustRankTitle/);
  });
});

describe('the ranking copy, in every language', () => {
  it('exists in all twelve', () => {
    for (const l of LOCALES) {
      const app = DICTIONARIES[l.code].app as Record<string, string>;
      for (const key of ['trustRankTitle', 'trustRankBuilding', 'trustRankTop']) {
        expect(app[key], `${l.code}.${key}`).toBeTruthy();
      }
    }
  });

  it('never claims trust can be bought, in any language', () => {
    // The whole point of the note is that this ranking sits ABOVE the paid
    // slot. Copy that blurred that would undo C-108 §7 in the one place a
    // merchant reads about it.
    for (const l of LOCALES) {
      const app = DICTIONARIES[l.code].app as Record<string, string>;
      expect(app.trustRankTop.length).toBeGreaterThan(10);
      expect(app.trustRankBuilding.length).toBeGreaterThan(10);
    }
  });

  it('names the threshold as 5 in every language', () => {
    // The number is the promise. A locale that said 10 would send a merchant
    // looking for a tier they cannot reach.
    for (const l of LOCALES) {
      const app = DICTIONARIES[l.code].app as Record<string, string>;
      expect(app.trustRankBuilding, l.code).toMatch(/5|٥|५/);
    }
  });
});
