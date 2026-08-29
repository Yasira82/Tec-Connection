// @vitest-environment node
//
// A dictionary key that no component ever reads is worth nothing, and nothing in
// the toolchain notices: TypeScript is satisfied because the key EXISTS, the
// translation tests pass because the key is TRANSLATED, and the component beside
// it renders a hardcoded English literal to every user on earth.
//
// That is exactly what shipped. `app` gained 81 translated keys, and
// NetworkInsights, ConnectionPro and half of Collaboration went on printing
// English — so an Arabic user got an Arabic shell wrapped around an English
// payment card. It was found on a phone, not in CI, which is the whole problem.
//
// So this file parses the in-app components and asserts two things a type system
// cannot:
//
//   1. every component that renders user-facing prose imports the dictionary;
//   2. no English sentence is hardcoded in JSX text or in a user-visible attribute.
//
// It reads the files with the real TypeScript parser rather than a regex. The
// first attempt used `>([^<>{}]+)<` and matched ordinary code — `) : error ||
// empty ? (` was reported as English prose. A scanner that cries wolf is worse
// than no scanner, because the fix is always to delete it.
//
// It is a lint, not a proof: it cannot tell a good translation from a bad one.
// It catches only the failure that actually happened — text that never went
// through the dictionary at all.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const DIR = join(process.cwd(), 'src/app/app/components');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

// Presentational shells with no prose of their own. Each is listed with the
// reason it is exempt — an entry without one is how an allowlist rots into a
// place to hide failures.
const NO_PROSE: Record<string, string> = {
  'Icon.tsx':      'renders SVG paths only',
  'BottomNav.tsx': 'tab labels come from t.connection.nav',
};

// Attributes the user can actually read. `alt` and `title` are included because
// a screen reader speaking English into an Arabic page is the same bug, just
// less visible.
const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label']);

// Latin-script tokens that stay Latin in every locale because they are names,
// not prose: the platform, the network, the currency, the formats we accept.
const PROPER_NOUNS = /^(TEC|Pi|Connection|Pro|PRO|Zone|KYC|JPEG|PNG|WebP|MB|π)$/;

interface Finding { text: string; kind: 'text' | 'attr' }

function scan(src: string, file: string): Finding[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Finding[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      if (text) found.push({ text, kind: 'text' });
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      if (VISIBLE_ATTRS.has(name)) found.push({ text: node.initializer.text, kind: 'attr' });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return found;
}

/**
 * Suspect = any ≥3-letter Latin word that is not a proper noun.
 *
 * The first version of this required TWO words, on the theory that a lone token
 * is as often a symbol ("✓", "›", "—") as a sentence. Requiring ≥3 Latin letters
 * already excludes every symbol, and the word count only created a blind spot:
 * it waved through `Loading…`, `title="Unfollow"` and the `online` in
 * `{onlineCount} online` — three real defects sitting in the same file the guard
 * had just declared clean. A one-word label is still a word the user reads.
 *
 * The one exclusion is a machine string: a domain, path or identifier — dots,
 * slashes or underscores between letters, and no spaces. `connection.tecosystem.app`
 * is shown to the user verbatim in every locale, because it is a name, not text.
 */
const MACHINE_STRING = /^\S*[A-Za-z][._/][A-Za-z]\S*$/;

function looksLikeEnglishProse(text: string): boolean {
  if (!/[A-Za-z]/.test(text)) return false;
  if (MACHINE_STRING.test(text.trim())) return false;
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))   // strip edge punctuation
    .some((w) => /^[A-Za-z’']+$/.test(w) && w.length >= 3 && !PROPER_NOUNS.test(w));
}

describe('in-app screens are actually translated', () => {
  it.each(FILES.filter((f) => !(f in NO_PROSE)))(
    '%s reads its copy from the dictionary',
    (file) => {
      const src = readFileSync(join(DIR, file), 'utf8');
      expect(
        src.includes("from '@/lib/i18n'"),
        `${file} renders user-facing text but never imports the dictionary, so every ` +
        'string in it stays English in all twelve locales.',
      ).toBe(true);
    },
  );

  it.each(FILES)('%s hardcodes no English sentence', (file) => {
    const src = readFileSync(join(DIR, file), 'utf8');
    const offenders = scan(src, file).filter((f) => looksLikeEnglishProse(f.text)).map((f) => f.text);
    expect(offenders, `hardcoded English in ${file} — move these into the \`app\` namespace`).toEqual([]);
  });
});

describe('the guard detects the bug it was written for', () => {
  // Without this, a broken matcher reports a green, meaningless pass.
  const of = (src: string) => scan(src, 'sample.tsx').filter((f) => looksLikeEnglishProse(f.text)).map((f) => f.text);

  it('flags a hardcoded sentence', () => {
    expect(of('const A = () => <p>Pro shows you who they are.</p>;'))
      .toEqual(['Pro shows you who they are.']);
  });

  it('flags a hardcoded placeholder', () => {
    expect(of('const A = () => <input placeholder="Add an item…" />;'))
      .toEqual(['Add an item…']);
  });

  it('leaves dictionary-sourced text, punctuation and proper nouns alone', () => {
    expect(of(`const A = () => <div>
      <h2>{a.networkInsights}</h2><span>·</span><span>✓</span>
      <span>🔗 {a.proTitle}</span><input placeholder={a.searchPeople} />
    </div>;`)).toEqual([]);
  });

  it('does not mistake ordinary code for prose — the first version did', () => {
    // `) : error || empty ? (` was reported as English by a regex-based scan.
    expect(of('const A = ({ error, empty }) => <div>{error || empty ? <b>{a.x}</b> : null}</div>;'))
      .toEqual([]);
  });

  it('does not mistake a domain or identifier for prose', () => {
    // Settings shows the app's own domain, verbatim in every locale.
    expect(of('const A = () => <div>connection.tecosystem.app</div>;')).toEqual([]);
  });

  it('flags a SINGLE English word — the blind spot that let three defects through', () => {
    expect(of('const A = () => <p>Loading…</p>;')).toEqual(['Loading…']);
    expect(of('const A = () => <button title="Unfollow" />;')).toEqual(['Unfollow']);
    expect(of('const A = ({ n }) => <span>{n} online</span>;')).toEqual(['online']);
  });
});
