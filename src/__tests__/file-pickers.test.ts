import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { VISUALLY_HIDDEN } from '@/lib-client/visuallyHidden';

// A file input must never be `display: none`.
//
// Every picker in this app is a hidden `<input type="file">` that a visible
// button clicks programmatically, and all four were written as `hidden` — which
// is `display: none`. Such an input is not merely invisible; it is out of the
// layout entirely, and several Android WebViews (which is what Pi Browser is)
// refuse to open the system picker for one: `.click()` returns, nothing opens,
// nothing throws.
//
// The symptom is a button that does nothing, on that browser only. It was
// reported three separate times — the profile photo, the status photo, the chat
// attachment — as "works on my account, not on theirs", because the account it
// worked on was being used in a different browser. Nothing about the code
// differs per account; the browser was the variable the whole time.
//
// This is a structural check because the failure is invisible everywhere it is
// convenient to test: it works in a normal tab, so a review, a render test and
// a desktop pass all say the same wrong thing.

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

/** Every `<input type="file">` in the app, with the file it lives in. */
function fileInputs(): { file: string; tag: string }[] {
  const out: { file: string; tag: string }[] = [];
  for (const path of sourceFiles(ROOT)) {
    const src = readFileSync(path, 'utf8');
    // The whole tag, across however many lines it is wrapped over.
    for (const m of src.matchAll(/<input\b[^>]*?type="file"[^>]*?\/?>/gs)) {
      out.push({ file: path.slice(ROOT.length + 1), tag: m[0] });
    }
  }
  return out;
}

describe('file pickers', () => {
  const inputs = fileInputs();

  it('there are file inputs to check', () => {
    // Guards the regex itself: a check that silently matches nothing passes
    // forever and protects nothing.
    expect(inputs.length).toBeGreaterThanOrEqual(4);
  });

  it.each(inputs.map((i) => [i.file, i.tag] as const))(
    '%s does not hide its file input with display:none',
    (_file, tag) => {
      // `hidden` is the attribute form of `display: none`.
      expect(tag).not.toMatch(/\shidden(\s|\/|>|=\{true\})/);
      expect(tag).not.toMatch(/display:\s*['"]?none/);
      expect(tag).toContain('VISUALLY_HIDDEN');
    },
  );

  it('the shared style keeps the input in the layout', () => {
    const style = VISUALLY_HIDDEN as Record<string, unknown>;
    expect(style.display).toBeUndefined();
    expect(style.position).toBe('absolute');
    expect(style.opacity).toBe(0);
    // Not zero-sized: a 0×0 input is treated as unrendered by some engines,
    // which is the same failure by a different route.
    expect(style.width).toBe(1);
    expect(style.height).toBe(1);
  });
});
