'use client';

import { useCallback, useEffect, useState } from 'react';

// TEC Connection (C-107) client hooks. Self-declared social graph — the caller's
// own follow edges only (server scopes by session; the client never sends identity).

export interface FollowEdge {
  username: string;
  since:    string;
}

export interface ConnectionStats {
  following: number;
  followers: number;
}

// The service wraps payloads as { success, data: {...} }.
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json?.error as string) ?? `Request failed (${res.status})`;
    throw new Error(err);
  }
  return (json?.data as Record<string, unknown>) ?? json;
}

export function useConnection() {
  const [following, setFollowing] = useState<FollowEdge[]>([]);
  const [stats,     setStats]     = useState<ConnectionStats>({ following: 0, followers: 0 });
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/bff/connection/following', { credentials: 'include', cache: 'no-store' }).then(readJson),
      fetch('/api/bff/connection/stats',     { credentials: 'include', cache: 'no-store' }).then(readJson),
    ])
      .then(([f, s]) => {
        setFollowing((f.following as FollowEdge[]) ?? []);
        setStats((s.stats as ConnectionStats) ?? { following: 0, followers: 0 });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load connections'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const mutate = useCallback(async (fn: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      await readJson(await fn());
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const follow = useCallback((username: string) =>
    mutate(() => fetch('/api/bff/connection/following', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })), [mutate]);

  const unfollow = useCallback((username: string) =>
    mutate(() => fetch(`/api/bff/connection/following/${encodeURIComponent(username)}`, {
      method: 'DELETE', credentials: 'include',
    })), [mutate]);

  return { following, stats, loading, busy, error, reload, follow, unfollow };
}
