import 'server-only';

// Who may read the report queue.
//
// The backend deliberately does NOT accept a user session on the queue at all —
// it takes `x-internal-key` and nothing else, because who reported whom is the
// most dangerous thing in this module to leak. That decision stands; it is not
// relaxed here.
//
// What this adds is the second half: the internal key lives on the SERVER, so
// something has to decide which logged-in person the server is willing to spend
// it on behalf of. That is this list.
//
// ── Why an env var and not a role in the JWT ─────────────────────────────────
// Connection does not own identity (C-107) and cannot mint a `moderator` claim;
// adding one would mean an auth-service change, a token-shape change, and a
// coordinated deploy across the fleet — for a list that currently has one name
// on it. An env var is honest about what it is: an ops-managed allowlist, read
// server-side, changeable without a release.
//
// It is a floor, not a ceiling. When the platform grows a real moderator role
// (SYSTEM / C-110 governs capability grants), this reads it instead — and the
// call sites do not change, because they ask this module, not the env.
//
// Fails CLOSED: unset means nobody, never everybody.

/** Comma- or space-separated Pi usernames, case-insensitive, `@` optional. */
const RAW = process.env.CONNECTION_MODERATORS ?? '';

const LIST: string[] = RAW
  .split(/[\s,]+/)
  .map((u) => u.trim().replace(/^@+/, '').toLowerCase())
  .filter(Boolean);

/** True when this session belongs to someone allowed to review reports. */
export function isModerator(username: string | null | undefined): boolean {
  if (LIST.length === 0) return false;
  const u = (username ?? '').trim().replace(/^@+/, '').toLowerCase();
  return !!u && LIST.includes(u);
}

/** Whether moderation is configured at all — lets the UI say so instead of 403ing blankly. */
export const moderationConfigured = LIST.length > 0;

/**
 * The Pi username of the current session, from the `tec_user` cookie.
 *
 * The cookie is written by the Hub and read here — the same source every other
 * server-side identity check in this app uses. It is never taken from a body or
 * a query param (C-107 / P6).
 */
export function sessionUsername(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  try {
    let u: Record<string, unknown>;
    // Written encoded on some paths and plain on others; both are read.
    try { u = JSON.parse(cookieValue); } catch { u = JSON.parse(decodeURIComponent(cookieValue)); }
    const name = (u?.piUsername ?? u?.username ?? '') as unknown;
    return typeof name === 'string' && name ? name : null;
  } catch { return null; }
}
