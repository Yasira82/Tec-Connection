import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The sign-in round trip on a shared profile link.
//
// The whole value of /u/<handle> is that a stranger can tap Follow with no
// session and end up having followed. That path crosses three systems — this
// app, the Hub, and the SSO callback — and each hop can drop the intent
// silently: the tap works, the sign-in works, and the person lands somewhere
// having followed nobody. Nothing errors.
//
// These are structural checks on the contract between those hops. They are
// deliberately not a rendering test: what breaks here is a URL shape, and a
// rendering test would pass while the shape was wrong.

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

describe('the follow intent survives sign-in', () => {
  const cta = src('components/public/FollowCta.tsx');

  it('sends the visitor back to THIS profile, not to /app', () => {
    // The Hub preserves `pathname + search` of the sign-in target and hands it
    // back to /api/auth/sso-callback as `redirect`. So the target must BE the
    // profile URL — returning to /app is the old behaviour this replaced, and
    // it drops both the person and the intent.
    expect(cta).toMatch(/\/u\/\$\{encodeURIComponent\(username\)\}\?follow=1/);
    expect(cta).not.toMatch(/ssoRedirect\([^)]*\/app/);
  });

  it('encodes the handle into the return URL', () => {
    // A handle is user-controlled text going into a URL that the Hub will parse
    // and hand back. Unencoded, a crafted handle rewrites the return path.
    expect(cta).toContain('encodeURIComponent(username)');
  });

  it('spends the intent BEFORE acting on it', () => {
    // Left in the address bar, `?follow=1` replays on every refresh — and a
    // screenshot of that URL would follow on the reader's behalf. The param is
    // stripped with replaceState, and that must happen before the request.
    const strip = cta.indexOf('replaceState');
    const post  = cta.indexOf('void follow()');
    expect(strip).toBeGreaterThan(-1);
    expect(post).toBeGreaterThan(-1);
    expect(strip).toBeLessThan(post);
  });

  it('fires the auto-follow at most once', () => {
    // Auth resolves asynchronously and the effect re-runs. Without a guard one
    // intent becomes several POSTs and the button flickers between states.
    expect(cta).toMatch(/fired\.current/);
  });

  it('treats an already-following answer as success', () => {
    // 409 means the edge is there. From where the visitor stands that is
    // "followed", and showing an error would be a lie about their own graph.
    expect(cta).toContain('409');
  });
});

describe('the share link', () => {
  const share = src('components/public/ShareProfile.tsx');

  it('is built from the current origin, never a hard-coded host', () => {
    // This app answers on two hostnames. A hard-coded one sends half the people
    // who tap it to the host their session is not on — the same reason the
    // group invite link is built this way.
    expect(share).toContain('window.location.origin');
    expect(share).not.toMatch(/https:\/\/connection\.tecosystem\.app/);
  });

  it('tries the native share sheet before the clipboard', () => {
    // On a phone that opens straight into WhatsApp / Telegram / Pi Chat, which
    // is the path this link exists to travel. Clipboard is the desktop
    // fallback, not the first choice.
    const nativeShare = share.indexOf('navigator.share');
    const clipboard   = share.indexOf('navigator.clipboard');
    expect(nativeShare).toBeGreaterThan(-1);
    expect(clipboard).toBeGreaterThan(-1);
    expect(nativeShare).toBeLessThan(clipboard);
  });

  it('still shows the URL when both share and clipboard are refused', () => {
    // Pi Browser does not always grant clipboard access. A button that appears
    // to do nothing is worse than no button.
    expect(share).toMatch(/setShown\(link\)/);
  });
});

describe('the public profile page', () => {
  const page = src('app/u/[username]/page.tsx');

  it('no longer offers "open the app" as its primary action', () => {
    // The old CTA was <Link href="/app">, which is the one sentence a shared
    // link exists to avoid.
    expect(page).toContain('<FollowCta');
    expect(page).not.toMatch(/href="\/app"[^>]*className="pub-cta"/);
  });

  it('offers the share control', () => {
    expect(page).toContain('<ShareProfile');
  });
});

// ── The follower count is its own disclosure (C-107 §14.5) ──────────────────
//
// `published` used to be one switch deciding everything a stranger could see.
// A follower count is a fact about the GRAPH, and §4 of the charter says the
// graph is sovereign — so it has its own control.
//
// What is checked here is the shape of the failure, not the happy path: a
// withheld count must never render as "0 followers", and an unrelated edit must
// never carry the setting along with it. Both are silent when wrong.

describe('a withheld follower count', () => {
  it('is never coerced to zero when it arrives as null', () => {
    // `Number(o.followers ?? 0)` is exactly the bug this field exists to avoid:
    // it turns "withheld" into "nobody follows this person".
    const disc = src('lib/connection/discovery.ts');
    expect(disc).not.toMatch(/followers:\s*Number\(o\.followers \?\? 0\)/);
    expect(disc).toMatch(/o\.followers === null \|\| o\.followers === undefined \? null/);
  });

  it('renders nothing on the directory card — not "0 followers"', () => {
    expect(src('components/public/DirectoryCard.tsx')).toMatch(/profile\.followers !== null/);
  });

  it('renders nothing on the public profile page', () => {
    expect(src('app/u/[username]/page.tsx')).toMatch(/p\.followers !== null && \(/);
  });

  it('is kept out of the share preview and the OG card', () => {
    // These travel further than the page: they are what WhatsApp and Telegram
    // render for anyone the link is forwarded to.
    expect(src('app/u/[username]/page.tsx')).toMatch(/p\.followers !== null\s*$/m);
    expect(src('app/u/[username]/opengraph-image.tsx')).toMatch(/p\.followers !== null/);
  });
});

describe('saving the setting', () => {
  it('sends the field ONLY when it is being changed', () => {
    // The backend treats an absent field as "leave it alone". Sending the
    // current value on every save would work today and silently overwrite the
    // stored value the moment the two drift.
    const editor = src('app/app/components/ProfileEditor.tsx');
    expect(editor).toMatch(/typeof showFollowers === 'boolean' && \{ show_followers: showFollowers \}/);
  });

  it('the BFF forwards a boolean and nothing else', () => {
    const route = src('app/api/bff/connection/profile/me/route.ts');
    expect(route).toMatch(/typeof body\.show_followers === 'boolean' && \{ show_followers: body\.show_followers \}/);
  });
});
