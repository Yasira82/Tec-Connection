// @vitest-environment node
//
// One build serves TWO Pi apps on two hosts — `connection.tecosystem.app` is the
// Mainnet app, `tec-connection.vercel.app` the paired Testnet one. So any URL
// this app hands to the Hub as a RETURN ADDRESS must be the host the visitor is
// actually on, never a build-time constant.
//
// It was a constant. Signing in on the Testnet host sent the Hub
// `https://connection.tecosystem.app/app`; the Hub authenticated correctly and
// returned the visitor to the OTHER origin, where the cookies then lived. The
// Testnet host never got a session and simply rendered "Unauthorized", with no
// error in any log to say why. `NEXT_PUBLIC_APP_URL` cannot fix that: there is
// one build and one value, so pointing it at either host breaks the other.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const LANDING = read('src/components/landing/Landing.tsx');
const PAYMENT = read('src/lib/pi-payment.ts');
const FOLLOW  = read('src/components/public/FollowCta.tsx');

describe('every return address is the origin the visitor is on', () => {
  it('the login redirect uses location.origin, not NEXT_PUBLIC_APP_URL', () => {
    expect(LANDING).toMatch(/ssoRedirect\(HUB_URL,[\s\S]{0,200}window\.location\.origin/);
    // The old form must not come back. Asserting the new one alone would pass
    // just as happily if someone re-added the constant beside it.
    expect(LANDING).not.toMatch(/ssoRedirect\(HUB_URL,\s*`\$\{APP_URL\}/);
  });

  it("Mode 1's return_url uses location.origin too", () => {
    // Same class of bug, same file family: a Testnet buyer sent to the Hub and
    // returned to the Mainnet origin lands on a different session.
    expect(PAYMENT).toMatch(/return_url:\s*`\$\{window\.location\.origin\}\/app`/);
    expect(PAYMENT).not.toContain('NEXT_PUBLIC_APP_URL');
  });

  it('FollowCta — the one that was already right — stays right', () => {
    // This is where the correct pattern already lived. Two call sites in one app
    // disagreed, and the login was the wrong one; pin the survivor so a future
    // "consistency" pass cannot align them onto the broken form instead.
    expect(FOLLOW).toContain('window.location.origin');
  });
});
