'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Finding a group, and asking to be let in.
//
// Every piece of state here comes from the server, including "have I already
// asked". That matters: a client that tracks its own request state shows
// "Pending" after a reload only if it happened to persist it, and shows "Join"
// to someone who asked yesterday — who then asks again, and the owner gets two
// rows to decide.

export type JoinState = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

export interface PublicGroup {
  id: string;
  title: string | null;
  description: string | null;
  hasPhoto: boolean;
  owner: string | null;
  members: number;
  joined: boolean;
  request: JoinState;
  at: string;
}

/** Long enough that typing a word is one request, short enough to feel live. */
const DEBOUNCE_MS = 350;

export function useGroupDiscovery() {
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Guards against an out-of-order response overwriting a newer one: type
  // "tec" quickly and the reply for "te" can land after the reply for "tec".
  const seq = useRef(0);

  const load = useCallback(async (term: string) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bff/connection/groups/discover${term ? `?q=${encodeURIComponent(term)}` : ''}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (mine !== seq.current) return;
      if (!res.ok) { setFailed(true); setGroups([]); return; }
      const d = await res.json().catch(() => ({}));
      setFailed(false);
      // NESTED envelope: { success, data: { groups } }.
      setGroups((d?.data?.groups ?? []) as PublicGroup[]);
    } catch {
      if (mine === seq.current) { setFailed(true); setGroups([]); }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void load(q); }, q ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  /** Ask to join, or withdraw. The server decides what the new state is. */
  const toggleRequest = useCallback(async (id: string, withdraw = false) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/join`, {
        method: withdraw ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const d = await res.json().catch(() => ({}));
      const status: JoinState = withdraw ? null : (d?.data?.status ?? 'PENDING');
      const joined = d?.data?.joined === true;
      // Updated in place rather than refetched: a full reload would re-sort the
      // list under the thumb that just tapped it.
      setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, request: status, joined: joined || g.joined } : g)));
      return true;
    } catch { return false; }
    finally { setBusyId(null); }
  }, []);

  return { q, setQ, groups, loading, failed, busyId, toggleRequest, reload: () => load(q) };
}

/** The people waiting on a decision for one group. Owner-only server-side. */
export function useJoinRequests(conversationId: string | null, isOwner: boolean) {
  const [requests, setRequests] = useState<{ username: string; at: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    // Not asked for at all unless the caller is the owner — the server would
    // refuse anyway, but a 403 per render is noise in the log for a question
    // whose answer is already known here.
    if (!conversationId || !isOwner) { setRequests([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(conversationId)}/requests`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!res.ok) { setRequests([]); return; }
      const d = await res.json().catch(() => ({}));
      setRequests((d?.data?.requests ?? []) as { username: string; at: string }[]);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [conversationId, isOwner]);

  useEffect(() => { void load(); }, [load]);

  const decide = useCallback(async (username: string, approve: boolean) => {
    if (!conversationId) return false;
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(conversationId)}/requests/${encodeURIComponent(username)}`,
        {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve }),
        },
      );
      if (!res.ok) return false;
      // Dropped from the list immediately. Waiting for a refetch leaves a row
      // the owner has already decided sitting there, and they tap it again.
      setRequests((rs) => rs.filter((r) => r.username !== username));
      return true;
    } catch { return false; }
  }, [conversationId]);

  return { requests, loading, decide, reload: load };
}
