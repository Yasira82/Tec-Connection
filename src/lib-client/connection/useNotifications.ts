'use client';

import { useCallback, useEffect, useState } from 'react';

// TEC Connection (C-107) — the caller's own relationship notifications ("X
// followed you"). Durable + own-scope; polled every 30s (near-live, robust).

export interface Notification {
  id:    string;
  type:  string;   // 'follow'
  actor: string;   // username
  read:  boolean;
  at:    string;
}

const POLL_MS = 30_000;

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json?.error as string) ?? `Request failed (${res.status})`);
  return (json?.data as Record<string, unknown>) ?? json;
}

export function useNotifications() {
  const [items,  setItems]  = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const reload = useCallback(async () => {
    try {
      const d = await readJson(await fetch('/api/bff/connection/notifications', { credentials: 'include', cache: 'no-store' }));
      setItems((d.items as Notification[]) ?? []);
      setUnread((d.unread as number) ?? 0);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/bff/connection/notifications', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
    } catch { reload(); }
  }, [unread, reload]);

  return { items, unread, markAllRead, reload };
}
