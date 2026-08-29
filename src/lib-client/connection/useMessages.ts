'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// TEC Connection (C-107) — Messaging. HTTP polling, matching the presence
// heartbeat: no browser WebSocket, so behaviour is the same in Pi Browser as
// anywhere else and a failure is a visible status code rather than a socket that
// silently stopped delivering.
//
// Two different rhythms on purpose. The thread list is background information and
// refreshes slowly; an OPEN thread is what the person is looking at, polls fast,
// and asks only for messages after the newest one it holds — so an idle
// conversation costs one empty response rather than its whole history.

const LIST_MS = 20_000;
const THREAD_MS = 5_000;

export interface Summary {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string | null;
  peer: string | null;
  members: number;
  unread: number;
  role: 'owner' | 'member';
  last: { body: string; by: string; at: string } | null;
  last_message_at: string;
}

export interface Msg { id: string; body: string; by: string; at: string }

export interface Thread {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string | null;
  owner: string | null;
  role: 'owner' | 'member';
  peer: string | null;
  members: string[];
  messages: Msg[];
}

const unwrap = <T,>(json: unknown, key: string): T | null => {
  const j = (json ?? {}) as Record<string, unknown>;
  const d = (j.data ?? j) as Record<string, unknown>;
  return (d?.[key] as T) ?? null;
};

/** The caller's conversations, refreshed in the background. */
export function useConversations() {
  const [conversations, setConversations] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/connection/conversations', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setError('unavailable'); return; }
      const json = await res.json().catch(() => ({}));
      setConversations(unwrap<Summary[]>(json, 'conversations') ?? []);
      setError(null);
    } catch {
      setError('unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, LIST_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0);

  const openDirect = useCallback(async (username: string): Promise<string | null> => {
    const res = await fetch('/api/bff/connection/conversations/direct', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().replace(/^@+/, '') }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(res.status === 403 ? 'blocked' : 'failed'); return null; }
    setError(null);
    await load();
    return unwrap<{ id: string }>(json, 'conversation')?.id ?? null;
  }, [load]);

  const createGroup = useCallback(async (title: string, members: string[] = []): Promise<string | null> => {
    const res = await fetch('/api/bff/connection/conversations/group', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), members: members.map((m) => m.trim().replace(/^@+/, '')).filter(Boolean) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError('failed'); return null; }
    setError(null);
    await load();
    return unwrap<{ id: string }>(json, 'conversation')?.id ?? null;
  }, [load]);

  return { conversations, unreadTotal, loading, error, reload: load, openDirect, createGroup };
}

/** One open thread: fast poll, incremental fetch, optimistic send. */
export function useThread(id: string | null) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The newest timestamp already held. Kept in a ref so the poll interval does
  // not have to be re-armed every time a message arrives.
  const cursor = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (!id) return;
    const after = cursor.current;
    const url = `/api/bff/connection/conversations/${encodeURIComponent(id)}${after ? `?after=${encodeURIComponent(after)}` : ''}`;
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setError(res.status === 404 ? 'notfound' : 'unavailable'); return; }
      const json = await res.json().catch(() => ({}));
      const t = unwrap<Thread>(json, 'conversation');
      if (!t) return;
      setError(null);
      setThread((prev) => {
        // An incremental poll returns ONLY new messages, so it must append. A
        // full load replaces. Getting this backwards empties the thread on the
        // first quiet poll.
        if (!prev || !after) return t;
        if (t.messages.length === 0) return { ...prev, ...t, messages: prev.messages };
        const seen = new Set(prev.messages.map((m) => m.id));
        return { ...prev, ...t, messages: [...prev.messages, ...t.messages.filter((m) => !seen.has(m.id))] };
      });
      const newest = t.messages[t.messages.length - 1]?.at;
      if (newest) cursor.current = newest;
    } catch {
      setError('unavailable');
    }
  }, [id]);

  useEffect(() => {
    cursor.current = null;
    setThread(null);
    if (!id) return;
    poll();
    // Reading a thread you have open marks it read; the badge should not survive
    // you looking straight at the message.
    fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/read`, {
      method: 'POST', credentials: 'include',
    }).catch(() => {});
    const t = setInterval(poll, THREAD_MS);
    return () => clearInterval(t);
  }, [id, poll]);

  const send = useCallback(async (body: string) => {
    if (!id) return false;
    const text = body.trim();
    if (!text) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        // 403 is the block or the rate limit — both mean "this will not be
        // delivered", and both deserve a specific message rather than "failed".
        setError(res.status === 403 ? 'refused' : 'failed');
        return false;
      }
      setError(null);
      await poll();
      return true;
    } catch {
      setError('failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, [id, poll]);

  const addMember = useCallback(async (username: string) => {
    if (!id) return false;
    const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/members`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().replace(/^@+/, '') }),
    });
    if (!res.ok) { setError('failed'); return false; }
    cursor.current = null;
    await poll();
    return true;
  }, [id, poll]);

  const leave = useCallback(async () => {
    if (!id) return false;
    const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/leave`, {
      method: 'POST', credentials: 'include',
    });
    return res.ok;
  }, [id]);

  return { thread, busy, error, send, addMember, leave, reload: poll };
}
