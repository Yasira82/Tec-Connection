import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Light mode existed on paper for months: the token file carried a
// `[data-theme='light']` block, no code ever set the attribute, and every
// component painted from hex literals that could not follow a theme anyway.
//
// Every rule below fails SILENTLY when broken — a wrong colour is not an error,
// it is a screen nobody can read — so each one is pinned here rather than
// trusted to review.
const root = process.cwd();
const src  = (p: string) => readFileSync(join(root, 'src', p), 'utf8');
const css  = readFileSync(join(root, 'src/styles/tec-design-tokens.css'), 'utf8');

const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** Every component file the app paints with. */
function paintedFiles(dir = 'src', acc: string[] = []): string[] {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      paintedFiles(p, acc);
    } else if (/\.tsx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('the token layer defines all three theme states', () => {
  it('has an explicit dark block and an explicit light block', () => {
    expect(css).toContain("[data-theme='dark']");
    expect(css).toContain("[data-theme='light']");
  });

  it('follows the phone only when the reader has NOT chosen', () => {
    // Scoped to `:root:not([data-theme])`. Unscoped, a light phone would
    // silently overrule someone who explicitly picked dark — and they would
    // have no way to tell the setting was being ignored.
    expect(css).toMatch(/@media \(prefers-color-scheme: light\)[\s\S]{0,80}:root:not\(\[data-theme\]\)/);
  });

  it('does not pin color-scheme in CSS', () => {
    // It has to follow the stored choice, which only the boot script knows. A
    // hardcoded `dark` gave light mode dark scrollbars and dark form controls.
    expect(strip(css)).not.toMatch(/color-scheme:\s*dark/);
  });

  it('paints the page from a token, not a literal', () => {
    const shell = strip(css).slice(0, strip(css).indexOf(':root'));
    expect(shell).toContain('background: var(--tec-bg)');
    expect(shell).not.toMatch(/background:\s*#[0-9a-fA-F]{6}/);
  });

  it('publishes colour CHANNELS, not just colours', () => {
    // Without these, opacity cannot follow a theme — see the next block.
    for (const t of ['--tec-gold-rgb', '--tec-text-rgb', '--tec-green-rgb']) {
      expect(css).toContain(t);
    }
  });

  it('the surface ramp is the Hub\'s NEUTRAL charcoal, not the old blue-black', () => {
    // C-83 §5.6. #050816 reads cold and pushes the Pi amber green; #101014 is
    // four points of blue — enough to avoid a dead grey, not enough to tint.
    // Pinned by VALUE because the whole point of §5.6 is that two apps must not
    // be a shade apart: an approximation here is the bug it documents.
    const dark = css.slice(css.indexOf("[data-theme='dark']"), css.indexOf("[data-theme='light']"));
    for (const [t, v] of [
      ['--tec-bg', '#101014'], ['--tec-surface-1', '#21212a'],
      ['--tec-surface-2', '#2c2c37'], ['--tec-surface-3', '#383844'],
    ] as const) {
      expect(new RegExp(`${t}:\\s*${v}`).test(dark)).toBe(true);
    }
    // The page CHANNELS move with it, or the frosted bar stays the old colour.
    expect(dark).toMatch(/--tec-bg-rgb:\s*16, 16, 20/);
  });

  it('the light ramp is a WARM off-white PAGE under a WHITE card', () => {
    // That order. A white page with a grey card inverts elevation: the thing
    // you are meant to look at ends up darker than its ground.
    const light = css.slice(css.indexOf("[data-theme='light']"));
    expect(light).toMatch(/--tec-bg:\s*#f4f3f1/);
    expect(light).toMatch(/--tec-surface-1:\s*#ffffff/);
    expect(light).toMatch(/--tec-surface-2:\s*#f1efec/);
  });

  it('the ink ladder has FOUR steps and its own icon stroke', () => {
    // With three, a component that needs a fourth hardcodes it — which is how
    // #3a3a4a ended up on a bottom nav and went invisible in light.
    for (const t of ['--tec-text-4', '--tec-icon', '--tec-fill-softer']) {
      expect(css).toContain(t);
    }
  });

  it('status colours DARKEN for light — contrast, not taste', () => {
    // The dark-theme brights were picked to glow on near-black. #22C55E on
    // white measures ~2.3:1, so every success line was unreadable as TEXT once
    // the page went light. The gold-family check below did not cover these,
    // and they were missed for exactly that reason.
    const light = css.slice(css.indexOf("[data-theme='light']"));
    for (const t of ['--tec-green', '--tec-blue', '--tec-red', '--tec-purple']) {
      expect(light).toMatch(new RegExp(`${t}:`));
    }
    // And the CHANNELS with them, or `successA()` keeps painting the bright one.
    expect(light).toMatch(/--tec-green-rgb:\s*21, 128, 61/);
  });

  it('the light theme overrides the WHOLE gold family, not just the accent', () => {
    // Overriding `--tec-gold` alone is not a theme, it is half of one. The
    // companions stayed on their dark-ground values, so every primary button
    // ran `#FEA500 -> #E8962A` — and #E8962A carries a desaturated brown cast
    // chosen to sit on near-black. On white it reads as a dirty dark patch, in
    // 26 places, and it looks like the gradient is broken rather than a token.
    //
    // Derived from `:root` rather than listed, so a NEW gold token is covered
    // the day it is added instead of the day someone notices.
    const root = css.slice(css.indexOf(':root'), css.indexOf("[data-theme='dark']"));
    const family = [...root.matchAll(/(--tec-gold[a-z-]*):/g)].map((m) => m[1]!);
    expect(family.length).toBeGreaterThan(4);

    const light = css.slice(css.indexOf("[data-theme='light']"));
    const missing = family.filter((t) => !new RegExp(`${t}:`).test(light));
    expect(missing).toEqual([]);
  });

  it('the ink channels actually flip between the themes', () => {
    const light = css.slice(css.indexOf("[data-theme='light']"));
    expect(light).toMatch(/--tec-text-rgb:\s*0, 0, 0/);
    const dark = css.slice(css.indexOf("[data-theme='dark']"), css.indexOf("[data-theme='light']"));
    expect(dark).toMatch(/--tec-text-rgb:\s*255, 255, 255/);
  });
});

describe('nothing appends alpha to a CSS variable', () => {
  // `var(--tec-gold)33` is invalid CSS and raises NO error: the declaration is
  // dropped and the border silently stops painting. This is the single most
  // likely way for this change to be undone by someone doing the obvious thing.
  const files = paintedFiles();

  it('checks a real set of files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  /**
   * Any interpolation that yields a token, with two hex digits stuck on the end.
   *
   * This started as `\$\{\s*C\.\w+\s*\}` — matching only the ONE form I had
   * seen. Three more turned up afterwards, each doing exactly the same damage:
   *
   *     `${C.gold}22`                      the original
   *     `${(v ? C.gold : C.subtext)}55`     an expression, not a bare member
   *     C.subtext + '55'                    concatenation, no template at all
   *     rgba(5,8,22,0.92)                   a raw colour (covered further down)
   *
   * So this matches an interpolation CONTAINING a token rather than one shaped
   * a particular way. Chasing syntax one form at a time is how a guard ends up
   * finding each bug once.
   */
  const ALPHA_ON_TOKEN = /\$\{[^}]*(?:C\.[a-zA-Z0-9]+|var\(--tec-[a-z0-9-]+\))[^}]*\}[0-9a-fA-F]{2}/;
  const CONCAT_ALPHA   = /(?:C\.[a-zA-Z0-9]+|var\(--tec-[a-z0-9-]+\)['"`]?)\s*\+\s*['"`][0-9a-fA-F]{2}['"`]/;

  it('no alpha appended to an interpolated token, in ANY form', () => {
    const offenders = files.filter((f) => ALPHA_ON_TOKEN.test(strip(src(f.slice(4)))));
    expect(offenders).toEqual([]);
  });

  it('no alpha CONCATENATED onto a token', () => {
    const offenders = files.filter((f) => CONCAT_ALPHA.test(strip(src(f.slice(4)))));
    expect(offenders).toEqual([]);
  });

  /**
   * A `${…}` inside SINGLE quotes is not an interpolation — it is those five
   * characters, literally, in the CSS value.
   *
   *     border: '1px solid ${successA(0.25)}'
   *
   * The browser cannot parse that, drops the declaration, and says nothing: the
   * border simply never paints. Identical damage to `var(--tec-gold)22`, from a
   * different direction — and it shipped in THREE places in this repo, because
   * the sweep that replaced the old hex strings rewrote what was inside the
   * quotes without noticing the quotes themselves were wrong.
   *
   * That is the fourth form now. The pattern holds: a guard that knows only the
   * shapes of the bugs already found finds each bug exactly once.
   */
  /*
   * Backticks are excluded from every run, and that is the whole difficulty.
   * Without it, `[^']*` happily spans from the CLOSING quote of one string,
   * across a perfectly good template literal, to the OPENING quote of the next —
   * which flagged four innocent files on the first attempt.
   */
  const DEAD_PLACEHOLDER = /'[^'`\n]*\$\{[^'`\n]*\}[^'`\n]*'/;

  /*
   * `theme.ts` builds the boot script as a template literal whose OUTPUT is
   * JavaScript containing single-quoted strings — `localStorage.getItem('${KEY}')`.
   * There the `${…}` does interpolate and the quotes belong to the generated
   * code, not to ours. It is the one true instance of this shape in the repo.
   */
  const GENERATES_CODE = ['lib-client/theme.ts'];

  it('no `${…}` inside a non-template string', () => {
    const offenders = files
      .map((f) => f.slice(4))
      .filter((f) => !GENERATES_CODE.includes(f) && DEAD_PLACEHOLDER.test(strip(src(f))));
    expect(offenders).toEqual([]);
  });

  it('no bare `var(--tec-…)NN`', () => {
    const offenders = files.filter((f) => /var\(--tec-[a-z0-9-]+\)[0-9a-fA-F]{2}/.test(strip(src(f.slice(4)))));
    expect(offenders).toEqual([]);
  });

  it('every form the app has actually shipped is caught', () => {
    // Each of these was real, in this repo, and each shipped past an earlier
    // version of this test.
    expect(ALPHA_ON_TOKEN.test('`1px solid ${C.gold}22`')).toBe(true);
    expect(ALPHA_ON_TOKEN.test('`1px solid ${(v ? C.gold : C.subtext)}55`')).toBe(true);
    expect(CONCAT_ALPHA.test("border: C.subtext + '55'")).toBe(true);
    expect(DEAD_PLACEHOLDER.test("border: '1px solid ${successA(0.25)}'")).toBe(true);
    // …and the correct forms must NOT trip it, or the guard becomes noise
    // people learn to route around.
    expect(ALPHA_ON_TOKEN.test('`1px solid ${goldA(0.33)}`')).toBe(false);
    expect(CONCAT_ALPHA.test('const s = C.gold + suffix')).toBe(false);
    expect(DEAD_PLACEHOLDER.test('border: `1px solid ${successA(0.25)}`')).toBe(false);
  });
});

describe('components paint from tokens, not from fixed hex', () => {
  it('TEC_COLORS is no longer imported into any component', () => {
    // Those are plain hex by contract (the package pins it), which is right for
    // the package and fatal here: a hex baked into a style={{}} is decided at
    // render and can never follow the page.
    const offenders = paintedFiles()
      .filter((f) => !f.endsWith('lib-client/palette.ts'))
      .filter((f) => /TEC_COLORS/.test(src(f.slice(4))));
    expect(offenders).toEqual([]);
  });
});

describe('the theme is applied before the first paint', () => {
  const layout = strip(src('app/layout.tsx'));

  it('runs the boot script inline in <head>', () => {
    // Anything deferred paints too late: the page renders dark and snaps to
    // light on every load, which is worse than not offering the choice.
    expect(layout).toContain('THEME_BOOT_SCRIPT');
    expect(layout).toMatch(/<head>[\s\S]*THEME_BOOT_SCRIPT/);
  });

  it('suppresses the hydration warning it deliberately causes', () => {
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });

  it('gives the browser chrome a colour per scheme', () => {
    // One dark theme-color left a black bar sitting on top of a light app.
    expect(layout).toMatch(/theme-color[\s\S]{0,80}prefers-color-scheme: dark/);
    expect(layout).toMatch(/theme-color[\s\S]{0,80}prefers-color-scheme: light/);
  });

  it('no longer declares a fixed color-scheme meta', () => {
    expect(layout).not.toMatch(/name="color-scheme"/);
  });
});

describe('"system" stays a live choice, not a snapshot', () => {
  const theme = strip(src('lib-client/theme.ts'));

  it('REMOVES the attribute for system instead of resolving it', () => {
    // Resolving it here would freeze the page at whatever the phone was when
    // this ran; removing it lets the media query keep tracking.
    expect(theme).toMatch(/choice === 'system'[\s\S]{0,80}removeAttribute\('data-theme'\)/);
  });

  it('degrades to following the phone when storage is blocked', () => {
    // Private mode. A theme is a preference, not a feature.
    expect(theme).toMatch(/catch[\s\S]{0,120}return 'system'/);
  });
});

// ── The hole this suite had, and the bug that found it ──────────────────────
//
// The first version checked for `${C.x}NN`, for `var(--tec-…)NN`, and for
// TEC_COLORS imports. The bottom nav was a hardcoded `rgba(5,8,22,0.92)` —
// none of those patterns — so it sailed through, and on a light page the bar
// stayed black while the inactive tab icons, drawn from an ink token, flipped
// to black. Every tab was invisible until you tapped it and it turned gold.
//
// A guard that only knows the shapes of the bugs already found is a guard that
// finds each bug once. These check for a RAW COLOUR of any shape.
describe('no component paints a raw colour', () => {
  /**
   * The two places a literal is CORRECT, each for a different reason.
   *
   * Listed by file rather than by value, so adding one is a visible decision in
   * a diff — the same shape as TEMPLATE_FILES in the silent-failures guard.
   *
   *   · sso-callback — plain HTML served BEFORE any stylesheet loads. It cannot
   *     read a CSS variable at all, so its colours are hex by necessity. This
   *     is a platform-wide rule, not a local shortcut: the KB says explicitly
   *     not to "fix" this file or `next/og` into var(), because Satori and a
   *     pre-stylesheet document both resolve no custom properties.
   *   · layout — the two `theme-color` metas. A <meta> content attribute is not
   *     CSS; it takes a literal, and there are already two of them, one per
   *     scheme, which is the whole point.
   */
  const EXEMPT_FILES = [
    'app/api/auth/sso-callback/route.ts',
    'app/layout.tsx',
    // `next/og` renders through Satori, which resolves NO custom properties —
    // a `var(--tec-gold)` there paints nothing at all. Same constraint as the
    // pre-stylesheet SSO landing, and the KB says explicitly not to "fix"
    // either into var(). The share card is also a fixed image: it is composed
    // once on the server and cached, so it has no reader whose theme it could
    // follow.
    'app/u/[username]/opengraph-image.tsx',
  ];

  const files = paintedFiles()
    .filter((f) => !f.endsWith('lib-client/palette.ts'))
    .filter((f) => !EXEMPT_FILES.some((e) => f.endsWith(e)));

  /**
   * Colours that are correct to hardcode.
   *
   * `#0a0800` and the ink-on-a-solid-object family are fixed in both themes by
   * design — but they have TOKENS now (`C.onGold`), so nothing needs the
   * literal. This list is empty on purpose: if a real exception turns up, it is
   * added here in a diff someone can see, rather than by widening the pattern.
   */
  const ALLOWED_LITERALS: string[] = [];

  it('the EXEMPT files use hex and must NOT use var() — the exemption cuts both ways', () => {
    // The hex exemption was one-directional and that was the hole. It said
    // "these files may keep literals" and nothing said "these files may keep
    // NOTHING ELSE" — so the sweep converted the share card's colours to
    // var(--tec-*) and the test that should have caught it was the one
    // excusing the file.
    //
    // Satori resolves no custom property, and the SSO landing is served before
    // any stylesheet. In both, a var() is not a fallback — it is no colour at
    // all. The card rendered with no ground and no gold.
    for (const f of EXEMPT_FILES) {
      const code = strip(src(f));
      expect(code, `${f} cannot resolve a CSS variable`).not.toMatch(/var\(--tec-/);
      expect(code, `${f} must not import the token refs`).not.toMatch(/from '@\/lib-client\/palette'/);
      // The alpha helpers are just as unusable there: they return
      // `rgba(var(--tec-text-rgb), …)`, which is the same var() one level down.
      expect(code, `${f} cannot use the alpha helpers either`)
        .not.toMatch(/\b(inkA|goldA|successA|errorA|bgA|onGoldA)\(/);
    }
  });

  it('no `rgba()` with literal channels — use bgA / inkA / goldA / successA / errorA', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const code = strip(src(f.slice(4)));
      for (const m of code.matchAll(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g)) {
        offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no `#rrggbb` OR `#rgb` literal in a component', () => {
    // The SHORTHAND was the hole. This checked six digits only, so nine
    // `color: '#fff'` survived the sweep — on the landing, the directory card,
    // /discover and /u/<handle>, which are exactly the surfaces least likely to
    // be opened in light mode during a spot check. White text on a white page.
    // `#333`/`#888` on the disabled Pro button went the same way.
    const offenders: string[] = [];
    for (const f of files) {
      const code = strip(src(f.slice(4)));
      for (const m of code.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
        if (ALLOWED_LITERALS.includes(m[0])) continue;
        offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('both checks can actually fail', () => {
    expect(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+/.test("background: 'rgba(5,8,22,0.92)'")).toBe(true);
    expect(/#[0-9a-fA-F]{6}\b/.test("color: '#050816'")).toBe(true);
    // …and must NOT fire on the token form that replaced them.
    expect(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+/.test('rgba(var(--tec-bg-rgb), 0.92)')).toBe(false);
  });
});

describe('a translucent surface follows the theme too', () => {
  it('the page background publishes channels', () => {
    // A frosted bar cannot use `var(--tec-bg)` — it needs an alpha — so without
    // channels it will be hardcoded again by whoever builds the next one.
    expect(css).toContain('--tec-bg-rgb');
    const light = css.slice(css.indexOf("[data-theme='light']"));
    expect(light).toMatch(/--tec-bg-rgb:\s*244, 243, 241/);
  });

  it('the bottom nav paints from them', () => {
    const nav = strip(src('app/app/components/BottomNav.tsx'));
    expect(nav).toContain('bgA(');
    expect(nav).not.toContain('rgba(5,8,22');
  });
});

// ── The top band ────────────────────────────────────────────────────────────
//
// The Hub frames every inner page with a solid band that has rounded BOTTOM
// corners. The tabs here opened on exactly the same flat ground as each other,
// so switching between them felt like nothing had happened.
//
// The band is dark in BOTH themes, which is the part that needs pinning: a
// control inside it reads the PAGE palette, so on a light page it would paint
// black ink onto a near-black band and disappear.
describe('the inner pages are framed like the Hub', () => {
  const page = strip(src('app/app/page.tsx'));

  it('the header is a band with rounded bottom corners', () => {
    expect(page).toContain("background: 'var(--tec-topbar)'");
    expect(page).toMatch(/borderRadius:\s*'0 0 var\(--tec-topbar-radius\) var\(--tec-topbar-radius\)'/);
  });

  it('uses the fleet token, not a number of its own', () => {
    // A hardcoded radius here is how one app ends up framed differently from
    // the Hub it was copied from.
    expect(css).toContain('--tec-topbar-radius');
  });

  it('re-scopes the palette for everything inside it', () => {
    expect(page).toContain('tec-on-band');
    expect(css).toContain('.tec-on-band');
  });

  it('the band stays dark on a LIGHT page', () => {
    // Not `var(--tec-surface-1)`: on a light page that is white, and the band
    // would vanish into the page it is supposed to frame.
    const light = css.slice(css.indexOf("[data-theme='light']"));
    expect(light).toMatch(/--tec-topbar:\s*#1[0-9a-f]{5}/);
  });

  it('the on-band ink does NOT follow the page', () => {
    // The RULE, not the first mention of the name — the token block above
    // refers to it in prose.
    const band = css.slice(css.indexOf('\n.tec-on-band {'));
    expect(band.slice(0, 700)).toMatch(/--tec-text-rgb:\s*255, 255, 255/);
  });
});

// ── The composer, and emoji as UI ───────────────────────────────────────────
//
// The message bar was the one place in the app drawing its controls with
// emoji: 📎 🎤 ➤. Three reasons that is not a style preference:
//
//   · an emoji carries its OWN colour, so no token can reach it — every theme
//     rule in this file stops at that button;
//   · it is drawn by the platform's font, so the same control looked different
//     on Samsung, in Pi Browser and on iOS, while the bottom nav (a real icon
//     set, in this repo) looked identical everywhere;
//   · `➤` is not a paper plane in most fonts. It is a triangle.
describe('the composer draws with the icon set, not with emoji', () => {
  const files = ['app/app/components/Messages.tsx', 'app/app/components/VoiceRecorder.tsx'];

  it.each(files)('%s has no emoji glyph as a control', (f) => {
    const code = strip(src(f));
    for (const e of ['📎', '🎤', '➤']) expect(code).not.toContain(e);
  });

  it('the icons exist in the set rather than being drawn inline', () => {
    const icons = src('app/app/components/Icon.tsx');
    for (const n of ['paperclip', 'mic', 'send']) expect(icons).toContain(`${n}:`);
  });

  it('they inherit colour, so a token can still reach them', () => {
    // `stroke="currentColor"` is the whole point: it is what an emoji could
    // never do.
    expect(src('app/app/components/Icon.tsx')).toContain("color = 'currentColor'");
  });
});

describe('one slot for mic and send', () => {
  const code = strip(src('app/app/components/Messages.tsx'));

  it('Send is rendered only when there is something to send', () => {
    // Two permanent buttons left the PRIMARY action grey and disabled for most
    // of the time the screen was open, and the field paid for both in width.
    expect(code).toMatch(/draft\.trim\(\) \? \([\s\S]{0,400}aria-label=\{a\.send\}/);
  });

  it('the microphone is the empty state of that same slot', () => {
    expect(code).toMatch(/\) : \(\s*<VoiceRecorder/);
  });

  it('there is exactly ONE VoiceRecorder in the composer', () => {
    expect(code.match(/<VoiceRecorder/g)?.length).toBe(1);
  });
});

describe('a message bubble is grey, and gold means one thing', () => {
  const code = strip(src('app/app/components/Messages.tsx'));

  it('your own bubble is a surface, not an amber wash', () => {
    // A hundred amber rectangles down a transcript spends the accent on the
    // most repeated element on the screen — and after the neutral ramp the wash
    // read as brown against #101014 rather than as amber.
    expect(code).toContain('background: mine ? C.surface3 : C.surface2');
    expect(code).not.toMatch(/background: mine \? goldA/);
  });

  it('the accent is kept for a MENTION — the one place it carries meaning', () => {
    expect(code).toMatch(/includes\(meNorm\) \? goldA\(0\.533\) : C\.border/);
  });
});
