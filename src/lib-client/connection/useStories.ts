'use client';

// Status (C-107), client side.
//
// The feed arrives already grouped by author and already ordered — you first,
// then people with something you have not seen, then the rest. That ordering is
// the server's because it depends on the follow graph and on who has seen what,
// and neither is the client's to know.
import { useCallback, useEffect, useState } from 'react';

export interface StoryItem {
  id: string;
  caption: string;
  hasMedia: boolean;
  at: string;
  expiresAt: string;
  seen: boolean;
  /** Present only on your own — a viewer never learns another viewer's count. */
  views?: number;
}

export interface StoryAuthor {
  author: string;
  seen: boolean;
  stories: StoryItem[];
}

export type StoryError = 'failed' | 'toobig' | 'empty' | null;

/** Same-origin URL for a status photo. The session cookie is what resolves it. */
export const storyMediaUrl = (id: string) =>
  `/api/bff/connection/stories/${encodeURIComponent(id)}/media`;

export function useStories(me: string) {
  const [authors, setAuthors] = useState<StoryAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StoryError>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/connection/stories', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setAuthors([]); return; }
      const j = await res.json().catch(() => ({}));
      setAuthors(Array.isArray(j?.data?.authors) ? j.data.authors : []);
    } catch {
      // A feed that cannot load is empty, not broken: a status is the least
      // important thing on the screen and must never take the page with it.
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const post = useCallback(async (caption: string, file?: File | Blob | null) => {
    const text = caption.trim();
    if (!text && !file) { setError('empty'); return false; }
    setBusy(true); setError(null);
    try {
      const res = file
        ? await fetch(`/api/bff/connection/stories/upload?caption=${encodeURIComponent(text)}`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': file.type || 'image/jpeg' },
            body: file,
          })
        : await fetch('/api/bff/connection/stories', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption: text }),
          });
      if (!res.ok) { setError(res.status === 400 && file ? 'toobig' : 'failed'); return false; }
      await load();
      return true;
    } catch { setError('failed'); return false; } finally { setBusy(false); }
  }, [load]);

  /**
   * Mark one seen. The local ring updates immediately rather than waiting for a
   * refetch — the request is idempotent, so an optimistic update that races a
   * reload cannot double-count.
   */
  const markSeen = useCallback(async (id: string) => {
    setAuthors((prev) => prev.map((a) => {
      if (!a.stories.some((s) => s.id === id)) return a;
      const stories = a.stories.map((s) => (s.id === id ? { ...s, seen: true } : s));
      return { ...a, stories, seen: stories.every((s) => s.seen) };
    }));
    try {
      await fetch(`/api/bff/connection/stories/${encodeURIComponent(id)}/seen`, {
        method: 'POST', credentials: 'include',
      });
    } catch { /* seen-state is not worth an error message */ }
  }, []);

  const remove = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/connection/stories/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) { setError('failed'); return false; }
      await load();
      return true;
    } catch { setError('failed'); return false; } finally { setBusy(false); }
  }, [load]);

  const mine = authors.find((a) => a.author === (me ?? '').trim().replace(/^@+/, '').toLowerCase());

  return { authors, mine, loading, busy, error, post, markSeen, remove, reload: load };
}
