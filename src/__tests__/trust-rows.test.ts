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
  // Read through the TYPED dictionary, not `as Record<string, string>`.
  //
  // That cast was the bug CI caught: it replaces a mapped type whose keys are
  // known with an index signature, so under `noUncheckedIndexedAccess` every
  // lookup becomes `string | undefined` — and it throws away the exact
  // guarantee the dictionary system exists for. `Dictionary = typeof en`, so a
  // key missing from a language is a TYPE ERROR, not a blank space that only a
  // speaker of that language would ever notice. A test asserting the keys exist
  // should lean on that, not cast it away.
  const KEYS = ['trustRankTitle', 'trustRankBuilding', 'trustRankTop'] as const;

  it('exists in all twelve', () => {
    for (const l of LOCALES) {
      for (const key of KEYS) {
        expect(DICTIONARIES[l.code].app[key], `${l.code}.${key}`).toBeTruthy();
      }
    }
  });

  it('says something, rather than being a placeholder', () => {
    // The whole point of the note is that this ranking sits ABOVE the paid
    // slot. A locale left with a stub would drop that argument in the one place
    // a merchant reads about it.
    for (const l of LOCALES) {
      expect(DICTIONARIES[l.code].app.trustRankTop.length, l.code).toBeGreaterThan(10);
      expect(DICTIONARIES[l.code].app.trustRankBuilding.length, l.code).toBeGreaterThan(10);
    }
  });

  it('names the threshold as 5 in every language', () => {
    // The number is the promise. A locale that said 10 would send a merchant
    // looking for a tier they cannot reach.
    for (const l of LOCALES) {
      expect(DICTIONARIES[l.code].app.trustRankBuilding, l.code).toMatch(/5|٥|५/);
    }
  });
});
