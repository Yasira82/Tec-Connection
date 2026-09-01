'use client';

// "typing…" — the System of Engagement, never the record.
//
// One round trip does both halves, the same shape as the presence heartbeat:
// it tells the server I am typing here, and answers with who else is. The state
// lives in Redis with an 8s TTL, so nothing has to send a "stopped typing"
// message — and nothing breaks when that message is the one that goes missing,
// which is exactly what happens when someone closes the app mid-word.
//
// The ping is THROTTLED, not debounced. Debouncing would send after you stop,
// which is the one moment the signal is worthless; throttling sends while you
// are still going, which is when the other person needs it.
import { useCallback, useEffect, useRef, useState } from 'react';

const PING_EVERY_MS = 4_000;   // comfortably inside the server's 8s window
const POLL_MS = 4_000;

export function useTyping(conversationId: string | null, members: string[]) {
  const [typing, setTyping] = useState<string[]>([]);
  const lastPing = useRef(0);
  // Kept in a ref so a changing member list does not re-arm the interval.
  const membersRef = useRef<string[]>(members);
  membersRef.current = members;

  const call = useCallback(async (announce: boolean) => {
    if (!conversationId) return;
    if (announce) lastPing.current = Date.now();
    try {
      const res = await fetch('/api/bff/connection/typing', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, usernames: membersRef.current }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const d = (json?.data ?? json ?? {}) as Record<string, unknown>;
      setTyping(((d.typing ?? []) as string[]).filter(Boolean));
    } catch {
      // Cosmetic. A failure here must never surface to the person.
    }
  }, [conversationId]);

  // Reading who else is typing does NOT announce that I am. Polling would
  // otherwise mark me as typing forever just for having the thread open.
  useEffect(() => {
    setTyping([]);
    if (!conversationId) return;
    const t = setInterval(() => { void call(false); }, POLL_MS);
    return () => clearInterval(t);
  }, [conversationId, call]);

  /** Call on every keystroke — throttled internally. */
  const ping = useCallback(() => {
    if (Date.now() - lastPing.current < PING_EVERY_MS) return;
    void call(true);
  }, [call]);

  return { typing, ping };
}
