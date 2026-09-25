'use client';

// Sign this app in with its OWN Pi handshake, when it has no TEC session.
//
// The Founding Quest and the reward campaign open an app as a standalone visit
// (no referrer, no Hub SSO), so the app loads the Pi SDK and Pi counts the visit.
// The price was that the app arrived with no session of its own: `/me` answered
// `no_token` and every screen said "Not signed in" (seen on a phone, 2026-09-25).
//
// The warm-up has already run `Pi.authenticate` on such a visit. This finishes
// the job the way the Hub's own login does (C-123 §3): Pi's token → our
// /api/auth/pi-login → a one-time token → a TOP-LEVEL navigation to this app's
// /api/auth/sso-callback, whose 200 landing sets the cookies in THIS browser
// context and confirms `/me` can see them before coming back here.
//
// When it does nothing — each one on purpose:
//   · a Hub-owned Pi session (ADR-007): authenticate never answers there, and an
//     app entered through Hub SSO already has a session;
//   · `/me` already says yes: nothing to fix;
//   · it already tried in this tab within the window below. If this browser
//     context refuses the cookies (C-123 LAW 3), the landing still proceeds back
//     here (§7), `/me` still says no — and without this guard that would be a
//     sign-in loop. One attempt, then the page stays as it is;
//   · sessionStorage is unavailable: without the guard there is no loop
//     protection, so it does not start.

import { piSession } from './pi-session';
import { PiRuntime } from './PiRuntime';

const TRIED_KEY = '__tec_self_signin';
const RETRY_AFTER_MS = 10 * 60 * 1000;

// WHICH step stopped the sign-in, for Settings to print next to `no_token`.
//
// Every "does nothing" above is silent on purpose, and that is exactly why a
// phone that stays signed out cannot tell us which one it hit: Pi never
// answered, pi-login refused, or the landing ran and the cookies did not stick.
// Each has a different fix. The step is a fixed word from this file — never a
// token, never a value from the server — and it lives only in this tab.
const STEP_KEY = '__tec_self_signin_step';
export const SELF_SIGNIN_EVENT = 'tec-self-signin';

const readStored = (): string | null => {
  try { return sessionStorage.getItem(STEP_KEY); } catch { return null; }
};

function note(step: string | null): void {
  try {
    if (step) sessionStorage.setItem(STEP_KEY, step);
    else sessionStorage.removeItem(STEP_KEY);
  } catch { /* shown only where it can be kept */ }
  window.dispatchEvent(new Event(SELF_SIGNIN_EVENT));
}

/** The last step this tab reached, or where it is waiting. Null when there is nothing to say. */
export function selfSignInStep(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TEC_PI_FOREIGN_SESSION?: boolean; __TEC_PI_ERROR?: boolean };
  if (w.__TEC_PI_FOREIGN_SESSION === true) return 'hub_session';
  const stored = readStored();
  if (stored) return stored;
  if (w.__TEC_PI_ERROR === true) return 'pi_no_sdk';
  return 'pi_not_ready';
}

const isForeignSession = (): boolean =>
  (window as unknown as { __TEC_PI_FOREIGN_SESSION?: boolean }).__TEC_PI_FOREIGN_SESSION === true;

/** True when an attempt may start; records the attempt. False when it must not. */
function claimAttempt(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(TRIED_KEY) ?? 0);
    if (last && now - last < RETRY_AFTER_MS) return false;
    sessionStorage.setItem(TRIED_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export type SelfSignInOutcome =
  | 'foreign-session' | 'has-session' | 'already-tried' | 'no-pi'
  | 'refused' | 'navigating';

export async function selfSignIn(now: number = Date.now()): Promise<SelfSignInOutcome> {
  if (typeof window === 'undefined' || isForeignSession()) return 'foreign-session';
  const prev = readStored();

  const me = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).catch(() => null);
  // Only a definite "no session" starts a sign-in. A network failure is not one.
  if (!me || me.ok || me.status !== 401) {
    note(!me ? 'me_network' : me.ok ? null : `me_http_${me.status}`);
    return 'has-session';
  }

  note('pi_waiting');
  if (!(await piSession.ensureAuth())) {
    note(PiRuntime.isAvailable() ? 'pi_auth_failed' : 'pi_no_sdk');
    return 'no-pi';
  }
  const accessToken = piSession.accessToken;
  if (!accessToken) { note('pi_no_token'); return 'no-pi'; }

  if (!claimAttempt(now)) {
    // Back from the landing and STILL no session: the cookies were set on a 200
    // and this context did not keep them (C-123 LAW 3). Otherwise keep saying
    // what the attempt in this window ran into.
    note(prev === 'sent_to_landing' || prev === 'landing_no_cookie' ? 'landing_no_cookie'
       : prev && prev !== 'pi_waiting' ? prev : 'already_tried');
    return 'already-tried';
  }

  const res = await fetch('/api/auth/pi-login', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ accessToken }),
  }).catch(() => null);
  const ssoToken = res?.ok
    ? ((await res.json().catch(() => null)) as { ssoToken?: unknown } | null)?.ssoToken
    : null;
  if (typeof ssoToken !== 'string' || !ssoToken) {
    note(!res ? 'login_network' : !res.ok ? `login_http_${res.status}` : 'login_no_token');
    return 'refused';
  }

  // Back to exactly where the visitor is — path and query, so the Quest's `q`
  // marker (the way back) survives the trip. Same-origin by construction; the
  // callback re-checks it anyway.
  const here = window.location.pathname + window.location.search;
  note('sent_to_landing');
  window.location.replace(
    `/api/auth/sso-callback?token=${encodeURIComponent(ssoToken)}&redirect=${encodeURIComponent(here)}`,
  );
  return 'navigating';
}
