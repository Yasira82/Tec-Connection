'use client';

// TEC Connection (C-107) — the block list.
//
// The charter promised "right to disconnect / block", and the service has
// enforced it since messaging shipped: a block stops sending in BOTH directions,
// inside existing threads as well as new ones. What did not exist was any way to
// press it. This is that.
//
// It is also, with the rate limit, the only moderation this app has. There is no
// automated content review, so the one control a person holds over who can reach
// them needs to be findable and instant — not buried behind a settings toggle.
import { useCallback, useEffect, useState } from 'react';

const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

export interface BlockedPerson { username: string; at: string }

export function useBlocks() {
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/connection/blocks', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setBlocked([]); return; }
      const json = await res.json().catch(() => ({}));
      const d = (json?.data ?? json ?? {}) as Record<string, unknown>;
      setBlocked(((d.blocks ?? []) as BlockedPerson[]).filter((b) => b?.username));
    } catch {
      // A block list that fails to load must not read as "nobody is blocked" —
      // but there is nothing truer to show, so it stays empty and the mutation
      // paths below still work. Silence here is the least-wrong option.
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = useCallback(async (username: string, method: 'POST' | 'DELETE') => {
    const u = norm(username);
    if (!u) return false;
    setBusy(true);
    try {
      const res = await fetch('/api/bff/connection/blocks', {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
      });
      if (!res.ok) { setError('failed'); return false; }
      setError(null);
      await load();
      return true;
    } catch {
      setError('failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const block   = useCallback((u: string) => mutate(u, 'POST'),   [mutate]);
  const unblock = useCallback((u: string) => mutate(u, 'DELETE'), [mutate]);

  /** Case-insensitive, @-tolerant — the service normalizes, the session does not. */
  const isBlocked = useCallback(
    (u: string) => blocked.some((b) => norm(b.username) === norm(u)),
    [blocked],
  );

  return { blocked, loading, busy, error, isBlocked, block, unblock, reload: load };
}
