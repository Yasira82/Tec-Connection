'use client';

// The caller's OWN chosen name (C-107).
//
// `useMe` answers "who am I?" — the Pi username, resolved server-side because
// Pi Browser hides the cookie from client JS (C-123 §3). It cannot answer "what
// do I call myself?", because a chosen name is profile data owned by the
// Connection store, not an identity claim in the session token.
//
// Every screen that shows the caller needs both: the name to lead with and the
// handle to print beside it. So this is one small read, shared.
//
// ── Why a module-level cache ────────────────────────────────────────────────
// Four separate places show the caller — the Home header, the Settings card,
// the status strip, and the profile editor. A hook per component means four
// identical requests on every load of the app. The answer is the same for all
// of them and changes only when the person edits it, so it is fetched once and
// handed out; `refreshMyName()` is what the editor calls after a save, which is
// the only moment it can change from inside the app.
import { useEffect, useState } from 'react';

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<(name: string | null) => void>();

async function load(): Promise<string | null> {
  try {
    const res = await fetch('/api/bff/connection/profile/me', {
      credentials: 'include', cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => ({}))) as { profile?: { display_name?: string } };
    const name = (j.profile?.display_name ?? '').trim();
    return name || null;
  } catch {
    // A name is decoration on top of a handle that is already on screen. It is
    // never worth an error state — the handle alone is a complete answer.
    return null;
  }
}

/** Re-read after the person edits their profile, and tell every screen. */
export async function refreshMyName(next?: string | null): Promise<void> {
  cached = next !== undefined ? (next?.trim() || null) : await load();
  listeners.forEach((fn) => fn(cached));
}

export function useMyName(): string | null {
  const [name, setName] = useState<string | null>(cached);

  useEffect(() => {
    listeners.add(setName);
    if (cached === null) {
      inflight = inflight ?? load();
      void inflight.then((n) => {
        inflight = null;
        // Only publish a name that was actually found. A null answer leaves the
        // cache empty so a later mount can try again — the alternative is one
        // failed request deciding, for the rest of the session, that nobody has
        // a name.
        if (n) { cached = n; listeners.forEach((fn) => fn(n)); }
      });
    }
    return () => { listeners.delete(setName); };
  }, []);

  return name;
}
