'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Searching inside ONE open conversation.
//
// Debounced rather than searched-per-keystroke. On a phone keyboard "invoice"
// is seven requests, six of which are answering a question nobody asked, and
// they arrive out of order — so the results for "inv" can land after the
// results for "invoice" and replace them. The delay is not a performance
// nicety; it is what stops the answer being wrong.

const DEBOUNCE_MS = 300;

/** Below this the query matches most of the thread and answers nothing. */
export const MIN_QUERY = 2;

export interface Hit {
  id: string;
  body: string;
  by: string;
  at: string;
  media: string | null;
}

export function useChatSearch(conversationId: string | null) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  /**
   * Which request is the current one.
   *
   * A slow response for an earlier query must not overwrite the results of a
   * later one. Comparing a sequence number on arrival is the cheap, correct fix
   * — the alternative is an AbortController per keystroke, which does not help
   * when the request already reached the server.
   */
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!conversationId || query.length < MIN_QUERY) {
      setHits([]); setSearching(false); setFailed(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bff/connection/conversations/${encodeURIComponent(conversationId)}/search?q=${encodeURIComponent(query)}`,
          { credentials: 'include', cache: 'no-store' },
        );
        if (mine !== seq.current) return;   // a newer query is already in flight
        if (!res.ok) { setFailed(true); setHits([]); return; }
        const json = await res.json().catch(() => ({}));
        const d = (json?.data ?? json) as { results?: Hit[] };
        setHits(Array.isArray(d?.results) ? d.results : []);
        setFailed(false);
      } catch {
        if (mine === seq.current) { setFailed(true); setHits([]); }
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, conversationId]);

  const reset = useCallback(() => { setQ(''); setHits([]); setFailed(false); }, []);

  return { q, setQ, hits, searching, failed, reset };
}
