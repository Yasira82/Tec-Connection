import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Every route that can receive a freed storage key must actually purge it.
//
// This guard exists because the mistake it catches was made and shipped. The
// backend was taught to report the keys a delete frees, three routes were wired
// to purge them — and `leave` was not. The result is the worst shape this can
// take:
//
//   · the objects were never deleted (a growing bill and a broken promise), AND
//   · every storage key in the group was handed to the browser.
//
// Nothing failed. No test broke, no log appeared, the leave worked perfectly.
// Half a feature is indistinguishable from a whole one from the outside, which
// is exactly why it needs a structural check rather than a behavioural one.
//
// A source scan rather than a unit test per route: what went wrong was an
// omission, and only something that enumerates the routes can see an omission.

const ROOT = join(process.cwd(), 'src/app/api');

/**
 * Routes whose upstream returns `mediaKey` / `mediaKeys`.
 *
 * Keep this in step with the service methods that return them:
 *   messaging: setGroupAvatar · deleteMessage · leave
 *   story:     remove · purgeExpired
 */
const MUST_PURGE = [
  'bff/connection/conversations/[id]/messages/[messageId]/route.ts',
  'bff/connection/conversations/[id]/leave/route.ts',
  'bff/connection/conversations/[id]/avatar/route.ts',
  'bff/connection/stories/[id]/route.ts',
  'cron/purge-stories/route.ts',
];

describe('media-purge wiring', () => {
  it.each(MUST_PURGE)('%s purges the keys it receives', (rel) => {
    const path = join(ROOT, rel);
    // A moved or renamed route fails loudly rather than silently passing —
    // a guard that skips what it cannot find guards nothing.
    expect(existsSync(path), `${rel} not found — did the route move?`).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('purgeObjects');
  });

  it.each(MUST_PURGE.filter((r) => !r.startsWith('cron/')))(
    '%s strips the keys instead of forwarding them to the browser',
    (rel) => {
      // A storage key in a JSON response is a key a client can keep. These
      // routes must unwrap it server-side, which is what takeMediaKeys does —
      // a plain passthrough would purge nothing and leak everything.
      expect(readFileSync(join(ROOT, rel), 'utf8')).toContain('takeMediaKeys');
    },
  );

  it('no route under /api/bff forwards a raw gateway response it should have stripped', () => {
    // The specific failure: `forwardConnection` passes the upstream body
    // through untouched. On a key-returning endpoint that is a leak. These
    // routes must use `callConnection` — which hands back the body to act on
    // first — not the passthrough helper.
    for (const rel of MUST_PURGE.filter((r) => !r.startsWith('cron/'))) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src, `${rel} still uses the passthrough helper`).not.toContain('forwardConnection');
    }
  });
});
