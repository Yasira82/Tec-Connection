import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A full-width field must declare `box-sizing: border-box`.
//
// This project has NO platform-wide `* { box-sizing: border-box }` — that is a
// deliberate choice, written down in public-surface.css: adding one now would
// silently re-lay-out every existing screen. The cost of that choice is that
// each full-width field has to say it for itself.
//
// What happens when one forgets: `width: 100%` plus 16px of padding and a
// border makes the field ~34px WIDER than the column holding it. It overflows
// the screen — and in a right-to-left layout the overflow is on the LEADING
// edge, so the first character of what someone typed is cut in half. Typing
// "TEC" in the group search showed "EC".
//
// Nothing errors, nothing logs, and it is invisible in a left-to-right
// language, which is why a structural check earns its place over a review note.

const ROOT = join(process.cwd(), 'src');

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      yield* sourceFiles(path);
    } else if (name.endsWith('.tsx')) {
      yield path;
    }
  }
}

/**
 * Style objects that set a full width, paired with the element they belong to.
 *
 * Deliberately narrow: only `<input>` and `<textarea>`, and only where padding
 * is also set. A full-width DIV with padding is usually fine — it is a block in
 * normal flow. A FIELD is the case that overflows visibly and silently.
 */
function offenders(src: string): string[] {
  const found: string[] = [];
  // Each JSX element, from its tag to the closing `/>` or `>`.
  const elements = src.match(/<(input|textarea)\b[\s\S]{0,1600}?\/>/g) ?? [];
  for (const el of elements) {
    const fullWidth = /width:\s*['"]100%['"]/.test(el);
    const padded = /padding:\s*['"`]/.test(el);
    const declared = /boxSizing:\s*['"]border-box['"]/.test(el);
    if (fullWidth && padded && !declared) {
      found.push(el.slice(0, 80).replace(/\s+/g, ' '));
    }
  }
  return found;
}

describe('full-width fields declare border-box', () => {
  it('no input or textarea sets width:100% with padding and no boxSizing', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      for (const el of offenders(readFileSync(file, 'utf8'))) {
        bad.push(`${file.replace(ROOT, 'src')} — ${el}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the check actually detects the shape it is looking for', () => {
    // A guard that cannot fail is not a guard. This is the exact code that
    // shipped, and it must be reported.
    const shipped = `<input value={q} style={{ width: '100%', padding: '11px 16px' }} />`;
    expect(offenders(shipped)).toHaveLength(1);

    const fixed = `<input value={q} style={{ boxSizing: 'border-box', width: '100%', padding: '11px 16px' }} />`;
    expect(offenders(fixed)).toHaveLength(0);

    // A flex field is immune — it is sized by the container, not by 100%.
    const flex = `<input value={q} style={{ flex: 1, minWidth: 0, padding: '11px 16px' }} />`;
    expect(offenders(flex)).toHaveLength(0);
  });
});
