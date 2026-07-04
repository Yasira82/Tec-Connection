'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// TEC Connection (C-107 §13) — presence for the people you follow. One heartbeat
// round-trip every 30s marks you online AND returns which follows are online.
// HTTP-based (no browser WebSocket) — robust + verifiable. Eventual.

const HEARTBEAT_MS = 30_000;

export function usePresence(usernames: string[]) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  // Keep the latest usernames without re-arming the interval each render.
  const ref = useRef<string[]>(usernames);
  ref.current = usernames;

  const sync = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/connection/presence', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: ref.current }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const list = (json?.data?.online ?? json?.online ?? []) as string[];
      setOnline(new Set(list.map((u) => u.toLowerCase())));
    } catch { /* presence is best-effort */ }
  }, []);

  useEffect(() => {
    sync();
    const id = setInterval(sync, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [sync]);

  const isOnline = useCallback((u: string) => online.has(u.toLowerCase()), [online]);
  return { online, isOnline };
}
