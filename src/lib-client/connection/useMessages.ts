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
  /**
   * Muted for me. Reported, NOT applied — `unread` still counts, because the
   * service zeroing it would make "muted" and "read" indistinguishable and the
   * thread would open with no idea where you had stopped. The screen decides
   * what a muted count is allowed to do.
   */
  muted?: boolean;
  role: 'owner' | 'admin' | 'member';
  last: { body: string; by: string; at: string; media?: string | null } | null;
  last_message_at: string;
}

export interface MsgMedia { type: 'image' | 'audio'; mime?: string | null; durationMs?: number | null }

/**
 * The message a reply points at.
 *
 * `deleted` and `hidden` are NOT the same fact and the UI says so differently:
 * deleted means retracted for everyone; hidden means this reader removed their
 * own copy, and the quote withholds the text rather than handing it back.
 */
export interface QuotedMsg {
  id: string;
  by: string | null;
  body: string;
  deleted: boolean;
  hidden: boolean;
  media: string | null;
}
export interface Msg {
  id: string; body: string; by: string; at: string;
  media?: MsgMedia | null;
  /** The message this one answers, or null. Resolved server-side at read time. */
  replyTo?: QuotedMsg | null;
  /**
   * Handles named in this message that are actually IN the conversation —
   * filtered server-side against the member list, so a message naming a
   * stranger does not get highlighted as if it reached them.
   */
  mentions?: string[];
  /** When the sender last rewrote it, or null. The original text is not kept. */
  editedAt?: string | null;
  /** Who WROTE it, when this copy was forwarded here. A name, never an id. */
  forwardedFrom?: string | null;
  /** Counts per emoji, and whether I am in each. Never who else is. */
  reactions?: { emoji: string; count: number; mine: boolean }[];
  /** A tombstone: the row survives so the transcript keeps its order. */
  deleted?: boolean;
}

export interface Thread {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string | null;
  owner: string | null;
  role: 'owner' | 'admin' | 'member';
  /** GROUP only — who helps run it. The OWNER is `owner`, and is not in here. */
  admins?: string[];
  /** Whether older messages exist above the ones in this payload. */
  hasMore?: boolean;
  peer: string | null;
  members: string[];
  /**
   * DIRECT only — when the other person last read this thread. A group reports
   * nothing: "read" there is per member, and one tick cannot say "three of five".
   */
  peerReadAt?: string | null;
  /** GROUP only — whether the group is FINDABLE. Not whether it is readable. */
  visibility?: 'PUBLIC' | 'PRIVATE';
  /** GROUP only — the blurb a stranger reads before asking to join. */
  description?: string | null;
  /**
   * Where THIS reader had got to when the thread was opened — captured before
   * the open marks it read, which is the only moment the answer still exists.
   */
  myLastReadAt?: string | null;
  /** Muted for me. Per-member; nobody else can see it. */
  muted?: boolean;
  /** GROUP only — who may write here. Sent to every member, not just admins. */
  posting?: 'EVERYONE' | 'ADMINS';
  /** The one message held at the top, or null. Resolved server-side each read. */
  pinned?: { id: string; by: string; at: string; body: string; media: string | null } | null;
  /**
   * Whether an invite link EXISTS. Never the code — that is a credential, and
   * only the owner fetches it, on demand.
   */
  hasInvite?: boolean;
  messages: Msg[];
}

const unwrap = <T,>(json: unknown, key: string): T | null => {
  const j = (json ?? {}) as Record<string, unknown>;
  const d = (j.data ?? j) as Record<string, unknown>;
  return (d?.[key] as T) ?? null;
};

/**
 * Send one message into a conversation you already have the id for, without
 * opening it.
 *
 * `useThread` is bound to the OPEN thread; a status reply has no thread open —
 * it resolves the author's DM and writes into it. Same endpoint, same
 * membership check server-side; the only thing missing is the polling.
 */
export async function sendToConversation(id: string, body: string): Promise<boolean> {
  const text = body.trim();
  if (!id || !text) return false;
  try {
    const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    return res.ok;
  } catch { return false; }
}

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

  // The NAV badge skips muted threads — that badge is the thing that pulls
  // someone back into the app, and pulling them back is precisely what they
  // said no to. The per-row count stays, so nothing is hidden once they are
  // already looking at the list.
  const unreadTotal = conversations.reduce((n, c) => (c.muted ? n : n + c.unread), 0);

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

  /**
   * Create a group, or say WHY it could not be created.
   *
   * Returns a reason rather than null. A refusal with no reason becomes "could
   * not open (—)" on screen, which is what a name collision looked like: the
   * server explained itself and this threw the explanation away.
   */
  const createGroup = useCallback(async (
    title: string, members: string[] = [],
  ): Promise<{ id: string } | { code: string }> => {
    const res = await fetch('/api/bff/connection/conversations/group', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), members: members.map((m) => m.trim().replace(/^@+/, '')).filter(Boolean) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError('failed');
      // Nest puts a BadRequest's message in `message`; it may arrive as an
      // array when several validators fail at once.
      const raw = json?.message ?? json?.error ?? '';
      const code = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw);
      return { code: code || String(res.status) };
    }
    setError(null);
    await load();
    const id = unwrap<{ id: string }>(json, 'conversation')?.id;
    return id ? { id } : { code: 'no-id' };
  }, [load]);

  return { conversations, unreadTotal, loading, error, reload: load, openDirect, createGroup };
}

/** One open thread: fast poll, incremental fetch, optimistic send. */
export function useThread(id: string | null) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Whether anything exists ABOVE what is loaded. Starts true so the control
  // is offered on a full first page; the server corrects it on the first ask.
  const [hasMore, setHasMore] = useState(false);
  // The newest timestamp already held. Kept in a ref so the poll interval does
  // not have to be re-armed every time a message arrives.
  const cursor = useRef<string | null>(null);
  /**
   * Where the reader had stopped, frozen at the moment the thread opened.
   *
   * It has to be frozen. Opening a thread marks it read, so from the second
   * poll onward the server's honest answer is "you have read everything" — and
   * a divider computed from that would appear for a fraction of a second and
   * then vanish, which is worse than never showing it. This is the one fact in
   * the thread that is deliberately NOT kept current.
   */
  const [readMark, setReadMark] = useState<string | null>(null);
  const markPinned = useRef(false);

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
      // Only a FULL load learns whether there is history above. An incremental
      // poll is at the bottom by definition and always reports false, so
      // trusting it here would clear the flag on the next quiet tick.
      if (!after) setHasMore(t.hasMore === true);
      // First full load only — see `readMark`.
      if (!after && !markPinned.current) {
        markPinned.current = true;
        setReadMark(t.myLastReadAt ?? null);
      }
      const newest = t.messages[t.messages.length - 1]?.at;
      if (newest) cursor.current = newest;
    } catch {
      setError('unavailable');
    }
  }, [id]);

  useEffect(() => {
    cursor.current = null;
    markPinned.current = false;
    setReadMark(null);
    setThread(null);
    if (!id) return;
    // Read the thread BEFORE marking it read, and in that order — not merely
    // "start both". The mark-read write moves the very watermark the first load
    // reports, so two requests in flight together is a race whose loser is the
    // "new messages" divider: sometimes there, sometimes not, on the same
    // thread. Awaiting costs one round trip and makes it deterministic.
    void poll().then(() => (
      fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/read`, {
        method: 'POST', credentials: 'include',
      }).catch(() => {})
    ));
    const t = setInterval(poll, THREAD_MS);
    return () => clearInterval(t);
  }, [id, poll]);

  /**
   * One page further back.
   *
   * PREPENDS, and never touches `cursor` — that ref tracks the NEWEST message
   * for polling. Moving it backwards would make the next poll re-fetch the
   * whole conversation and treat every message as new.
   */
  const loadOlder = useCallback(async () => {
    if (!id || loadingOlder) return;
    const oldest = thread?.messages[0]?.at;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}?before=${encodeURIComponent(oldest)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!res.ok) return;
      const t = unwrap<Thread>(await res.json().catch(() => ({})), 'conversation');
      if (!t) return;
      setHasMore(t.hasMore === true);
      setThread((prev) => {
        if (!prev) return t;
        // Deduped: a message can arrive in a page AND already be held if it was
        // written between the two requests.
        const seen = new Set(prev.messages.map((m) => m.id));
        const older = t.messages.filter((m) => !seen.has(m.id));
        return { ...prev, messages: [...older, ...prev.messages] };
      });
    } catch { /* the button simply stays offered */ }
    finally { setLoadingOlder(false); }
  }, [id, loadingOlder, thread?.messages]);

  const send = useCallback(async (body: string, replyTo?: string) => {
    if (!id) return false;
    const text = body.trim();
    if (!text) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, ...(replyTo && { reply_to: replyTo }) }),
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
  /**
   * `me` removes it from your copy; `everyone` clears it for both sides and
   * leaves a tombstone. The scope is always sent explicitly — a delete should
   * never depend on which default happens to be in force upstream.
   */
  const deleteMessage = useCallback(async (messageId: string, scope: 'me' | 'everyone' = 'everyone') => {
    if (!id) return false;
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}?scope=${scope}`,
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
  /**
   * Remove this conversation from MY list. `permanent` also erases the
   * transcript, so it does not come back in full with the next message —
   * which is what "delete" is taken to mean.
   *
   * Neither form stops a NEW message arriving; only a block does that.
   */
  const hide = useCallback(async (permanent = false) => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/hide`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanent }),
      });
      return res.ok;
    } catch { return false; }
  }, [id]);

  /** Empty the transcript for me. The conversation stays in my list. */
  const clear = useCallback(async () => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/clear`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) { setError('failed'); return false; }
      // The transcript shrinks rather than grows, and the poll only fetches
      // what is new — so the whole thread has to be re-read for the clear to
      // show at all.
      cursor.current = null;
      await poll();
      return true;
    } catch { setError('failed'); return false; }
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

  /**
   * Mute or unmute, for me alone.
   *
   * Writes the returned value rather than the requested one — the switch should
   * move because the server stored something, not because the request came
   * back. A refusal leaves it exactly where it was.
   */
  const setMuted = useCallback(async (muted: boolean) => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/mute`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });
      if (!res.ok) { setError('failed'); return false; }
      const next = unwrap<boolean>(await res.json().catch(() => ({})), 'muted');
      setThread((prev) => (prev ? { ...prev, muted: next ?? muted } : prev));
      return true;
    } catch { setError('failed'); return false; }
  }, [id]);

  /**
   * React, or take it back.
   *
   * Optimistic, and it has to be: a reaction is a tap that must feel instant,
   * and waiting a poll cycle to see your own thumb appear makes the button feel
   * broken. The server's counts replace the guess on the next read; a refusal
   * simply loses the guess, which is the smallest possible wrong outcome.
   */
  const react = useCallback(async (messageId: string, emoji: string, on: boolean) => {
    if (!id) return false;
    setThread((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.id !== messageId) return m;
          const list = [...(m.reactions ?? [])];
          const i = list.findIndex((r) => r.emoji === emoji);
          const hit = i >= 0 ? list[i] : undefined;
          if (on) {
            if (!hit) list.push({ emoji, count: 1, mine: true });
            // Already mine: nothing to add. Counting again would show two of
            // your own thumbs until the next poll corrected it.
            else if (!hit.mine) list[i] = { ...hit, count: hit.count + 1, mine: true };
          } else if (hit?.mine) {
            if (hit.count <= 1) list.splice(i, 1);
            else list[i] = { ...hit, count: hit.count - 1, mine: false };
          }
          return { ...m, reactions: list };
        }),
      };
    });
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/reactions`,
        {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji, on }),
        },
      );
      if (!res.ok) { await poll(); return false; }
      return true;
    } catch { await poll(); return false; }
  }, [id, poll]);

  /**
   * Rewrite one of your own messages.
   *
   * A full re-read afterwards, not an append: an edit REPLACES a message rather
   * than adding one, and the poll only fetches what is new — so without this
   * the corrected text would not appear until something else was said.
   */
  const editMessage = useCallback(async (messageId: string, body: string) => {
    if (!id) return false;
    const text = body.trim();
    if (!text) return false;
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: text }),
        },
      );
      if (!res.ok) { setError(res.status === 403 ? 'editWindow' : 'failed'); return false; }
      setError(null);
      cursor.current = null;
      await poll();
      return true;
    } catch { setError('failed'); return false; }
  }, [id, poll]);

  /** Copy a message into another conversation the caller also belongs to. */
  const forwardMessage = useCallback(async (messageId: string, to: string) => {
    if (!id) return false;
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/forward`,
        {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to }),
        },
      );
      if (!res.ok) { setError(res.status === 403 ? 'refused' : 'failed'); return false; }
      setError(null);
      return true;
    } catch { setError('failed'); return false; }
  }, [id]);

  /** Pin a message, or pass null to take the pin down. */
  const setPinned = useCallback(async (messageId: string | null) => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/pin`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) { setError('failed'); return false; }
      const next = unwrap<Thread['pinned']>(await res.json().catch(() => ({})), 'pinned');
      setThread((prev) => (prev ? { ...prev, pinned: next ?? null } : prev));
      return true;
    } catch { setError('failed'); return false; }
  }, [id]);

  /**
   * Open or close the group to ordinary members.
   *
   * Written from the SERVER's answer, like every other switch here — the
   * control should move because something was stored, not because a request
   * came back.
   */
  const setPosting = useCallback(async (posting: 'EVERYONE' | 'ADMINS') => {
    if (!id) return false;
    try {
      const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/posting`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posting }),
      });
      if (!res.ok) { setError('failed'); return false; }
      const next = unwrap<'EVERYONE' | 'ADMINS'>(await res.json().catch(() => ({})), 'posting');
      setThread((prev) => (prev ? { ...prev, posting: next ?? posting } : prev));
      return true;
    } catch { setError('failed'); return false; }
  }, [id]);

  const leave = useCallback(async () => {
    if (!id) return false;
    const res = await fetch(`/api/bff/connection/conversations/${encodeURIComponent(id)}/leave`, {
      method: 'POST', credentials: 'include',
    });
    return res.ok;
  }, [id]);

  return {
    thread, busy, error, send, sendMedia, deleteMessage, hide, clear, addMember, leave,
    loadOlder, loadingOlder, hasMore, reload: poll, setMuted, readMark,
    react, editMessage, forwardMessage, setPinned, setPosting,
  };
}
