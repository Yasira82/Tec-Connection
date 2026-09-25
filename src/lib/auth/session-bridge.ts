'use client';

// Start the session bridge (api/auth/bridge) when THIS page's own request
// arrived without the session, on a page the guard only serves WITH one.
//
// A protected page rendering at all means its navigation carried both session
// cookies (middleware.ts). If `/me` from that page then says `no_token` or
// `no_user`, the page's requests are using a cookie store the session is not
// in — the bridge copies it there.
//
// At most once per tab per window: if the copy does not take, the page stays
// as it is instead of bouncing (the same guard shape as self-sign-in.ts).

const KEY       = '__tec_session_bridge';
const WINDOW_MS = 10 * 60 * 1000;
const GUARDED   = ['/app', '/dashboard', '/profile', '/settings'];

export type BridgeOutcome = 'not-needed' | 'not-guarded' | 'already-tried' | 'navigating';

export function bridgeSession(reason: string | null, now: number = Date.now()): BridgeOutcome {
  if (typeof window === 'undefined') return 'not-needed';
  if (reason !== 'no_token' && reason !== 'no_user') return 'not-needed';

  const { pathname, search } = window.location;
  if (!GUARDED.some((r) => pathname.startsWith(r))) return 'not-guarded';

  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (last && now - last < WINDOW_MS) return 'already-tried';
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return 'already-tried'; // no storage → no loop guard → do not start
  }

  window.location.replace(`/api/auth/bridge?redirect=${encodeURIComponent(pathname + search)}`);
  return 'navigating';
}

/** True when this tab already ran the bridge within the window — for Settings. */
export function bridgedRecently(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    return !!last && now - last < WINDOW_MS;
  } catch {
    return false;
  }
}
