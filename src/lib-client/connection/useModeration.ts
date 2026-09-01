'use client';

import { useCallback, useEffect, useState } from 'react';

// The report queue, client side.
//
// `allowed` is not something the browser decides — it is what the server
// answered. The route returns 404 to anyone not on the moderator allowlist, so
// "am I a moderator?" is asked by trying, and the answer is the same one that
// governs the data. A client-side flag would be a second, weaker copy of a rule
// the server already owns (P5), and the queue would still be closed to anyone
// who flipped it.
//
// Until the first fetch answers, `allowed` is null — not false. Rendering the
// entry point on a guess and then removing it is worse than showing nothing for
// a moment.

export type ReportStatus = 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

export interface ReportRow {
  id: string;
  kind: string;
  target_id: string;
  target_author: string;
  reporter_username: string;
  reason: string;
  note: string;
  snapshot: string;
  status: ReportStatus;
  created_at: string;
}

export interface ReportGroup {
  author: string;
  count: number;
  reports: ReportRow[];
}

export function useModeration(status: ReportStatus = 'OPEN') {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bff/connection/moderation/queue?status=${status}`, {
        credentials: 'include', cache: 'no-store',
      });
      if (res.status === 404 || res.status === 401) { setAllowed(false); setGroups([]); return; }
      if (!res.ok) { setGroups([]); return; }
      const d = await res.json().catch(() => ({}));
      setAllowed(true);
      // NESTED envelope: `{ success, data: { total, authors } }`.
      setGroups((d?.data?.authors ?? []) as ReportGroup[]);
    } catch {
      // A network failure is not an answer about permission — leave `allowed`
      // as it was rather than hiding a moderator's own queue on one bad request.
      setGroups([]);
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  /** Decide one report. Reloads so the list reflects what the server now holds. */
  const resolve = useCallback(async (id: string, next: Exclude<ReportStatus, 'OPEN'>, note?: string) => {
    try {
      const res = await fetch(`/api/bff/connection/moderation/${encodeURIComponent(id)}/resolve`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, resolution: note ?? '' }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    } catch { return false; }
  }, [load]);

  return { allowed, groups, loading, reload: load, resolve };
}
