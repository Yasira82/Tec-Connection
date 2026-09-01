'use client';

import { useCallback, useState } from 'react';

// A group's invite link — for the owner to read, mint, or withdraw.
//
// Fetched ON DEMAND, never in the conversation payload. The code is a
// credential: anyone holding it can walk into the group without the owner's
// approval, so it is not something to hand to all fifty members on every poll.
// The thread only reports that a link EXISTS.

/**
 * The URL a person actually shares.
 *
 * Built from the browser's own origin rather than an env var. This app is
 * reachable on two hostnames (the domain and the Vercel one), and a link that
 * hard-coded either would send half the people who tap it to the wrong host —
 * where the session cookie is not, so the link would appear to be broken.
 */
export const inviteUrl = (code: string): string =>
  `${typeof window === 'undefined' ? '' : window.location.origin}/app?invite=${encodeURIComponent(code)}`;

export function useInvite(conversationId: string | null) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const path = conversationId
    ? `/api/bff/connection/conversations/${encodeURIComponent(conversationId)}/invite`
    : null;

  const read = useCallback(async () => {
    if (!path) return;
    setBusy(true); setFailed(false);
    try {
      const res = await fetch(path, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setFailed(true); return; }
      const json = await res.json().catch(() => ({}));
      setCode(((json?.data ?? json) as { code?: string | null })?.code ?? null);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }, [path]);

  /**
   * `true` mints a FRESH code; `false` withdraws the link.
   *
   * Re-issuing is how a leaked link is revoked, so the caller gets the NEW code
   * back — and the old one stops working the moment this returns. The state is
   * written from the server's answer, never from what was asked for.
   */
  const set = useCallback(async (enabled: boolean) => {
    if (!path) return false;
    setBusy(true); setFailed(false);
    try {
      const res = await fetch(path, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) { setFailed(true); return false; }
      const json = await res.json().catch(() => ({}));
      setCode(((json?.data ?? json) as { code?: string | null })?.code ?? null);
      return true;
    } catch { setFailed(true); return false; }
    finally { setBusy(false); }
  }, [path]);

  return { code, busy, failed, read, set };
}

/**
 * Redeem a link.
 *
 * A wrong code and a withdrawn one come back identically, and that is
 * deliberate upstream — telling them apart is what turns this into a way to
 * test codes. The caller gets one answer: it worked, or it did not.
 */
export async function joinByInvite(code: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch('/api/bff/connection/conversations/join-by-invite', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const d = (json?.data ?? json) as { id?: string };
    return d?.id ? { id: d.id } : null;
  } catch { return null; }
}
