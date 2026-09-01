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
  last: { body: string; by: string; at: string; media?: string | null } | null;
  last_message_at: string;
}

export interface MsgMedia { type: 'image' | 'audio'; mime?: string | null; durationMs?: number | null }
export interface Msg {
  id: string; body: string; by: string; at: string;
  media?: MsgMedia | null;
  /** A tombstone: the row survives so the transcript keeps its order. */
  deleted?: boolean;
}

export interface Thread {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string | null;
  owner: string | null;
  role: 'owner' | 'member';
  peer: string | null;
  members: string[];
  /**
   * DIRECT only — when the other person last read this thread. A group reports
   * nothing: "read" there is per member, and one tick cannot say "three of five".
   */
  peerReadAt?: string | null;
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

  // Returns the conversation id, or an object carrying the HTTP status. The
  // previous version returned null for every failure, so the screen closed the
  // composer and said nothing — which is what "New chat doesn't work" looked
  // like from the outside. A status the user can read is also a status they can
  // send back in a screenshot.
  const openDirect = useCallback(async (username: string): Promise<{ id: string } | { code: number }> => {
    try {
      const res = await fetch('/api/bff/connection/conversations/direct', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().replace(/^@+/, '') }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(res.status === 403 ? 'blocked' : 'failed'); return { code: res.status }; }
      setError(null);
      await load();
      const id = unwrap<{ id: string }>(json, 'conversation')?.id;
      // A 200 with no id is a contract break, not a success — say so rather than
      // returning to an unchanged screen.
      return id ? { id } : { code: 502 };
    } catch {
      setError('failed');
      return { code: 0 };
    }
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

  /**
   * Upload an attachment and post it as a message. The bytes go to this app's
   * own origin — a presigned PUT from a browser needs bucket CORS that does not
   * exist, and a blocked cross-origin request looks exactly like a dead network.
   * The caption and duration ride as query params because the body is the file.
   */
  const sendMedia = useCallback(async (blob: Blob, caption = '', durationMs?: number) => {
    if (!id) return false;
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (caption.trim()) qs.set('caption', caption.trim());
      if (durationMs && durationMs > 0) qs.set('ms', String(Math.round(durationMs)));
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/media${qs.toString() ? `?${qs}` : ''}`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': blob.type }, body: blob },
      );
      if (!res.ok) { setError(res.status === 400 ? 'toobig' : 'attach'); return false; }
      setError(null);
      // A full reload rather than an append: the upload response is one message,
      // but the cursor has not moved, so the next poll would fetch it again.
      cursor.current = null;
      await poll();
      return true;
    } catch {
      setError('attach');
      return false;
    } finally {
      setBusy(false);
    }
  }, [id, poll]);

  /** Delete one of your own messages. The service enforces "your own". */
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!id) return false;
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) { setError('failed'); return false; }
      // A tombstone REPLACES a message rather than adding one, and the poll only
      // fetches what is new — so the whole thread has to be re-read for the
      // deletion to show at all.
      cursor.current = null;
      await poll();
      return true;
    } catch { setError('failed'); return false; }
  }, [id, poll]);

  /** Remove this conversation from MY list. A new message brings it back. */
  const hide = useCallback(async () => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/hide`, {
        method: 'POST', credentials: 'include',
      });
      return res.ok;
    } catch { return false; }
  }, [id]);

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

  return { thread, busy, error, send, sendMedia, deleteMessage, hide, addMember, leave, reload: poll };
}
