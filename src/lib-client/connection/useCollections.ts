'use client';

import { useCallback, useEffect, useState } from 'react';

// TEC Connection (C-107) — Collaboration: shared collections. Own-or-member
// scope (server-enforced by session). The client never sends identity.

export interface CollectionSummary {
  id: string; title: string; owner: string;
  role: 'owner' | 'member'; members: number; items: number; updated_at: string;
}
export interface CollectionItem { id: string; text: string; by: string; at: string }
export interface CollectionDetail {
  id: string; title: string; owner: string; role: 'owner' | 'member';
  members: string[]; items: CollectionItem[];
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json?.error as string) ?? `Request failed (${res.status})`);
  return (json?.data as Record<string, unknown>) ?? json;
}

export function useCollections() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true); setError(null);
    fetch('/api/bff/connection/collections', { credentials: 'include', cache: 'no-store' })
      .then(readJson)
      .then((d) => setCollections((d.collections as CollectionSummary[]) ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const mutate = useCallback(async (fn: () => Promise<Response>) => {
    setBusy(true); setError(null);
    try { await readJson(await fn()); reload(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }, [reload]);

  const create = useCallback((title: string) =>
    mutate(() => fetch('/api/bff/connection/collections', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    })), [mutate]);

  return { collections, loading, busy, error, reload, create };
}

/** Detail loader for one collection (items + members) + add-item / invite. */
export function useCollection(id: string | null) {
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) { setDetail(null); return; }
    setError(null);
    fetch(`/api/bff/connection/collections/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(readJson)
      .then((d) => setDetail((d.collection as CollectionDetail) ?? null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id]);

  useEffect(() => reload(), [reload]);

  const act = useCallback(async (fn: () => Promise<Response>) => {
    if (!id) return;
    setBusy(true); setError(null);
    try { await readJson(await fn()); reload(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }, [id, reload]);

  const addItem = useCallback((text: string) =>
    act(() => fetch(`/api/bff/connection/collections/${encodeURIComponent(id!)}/items`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    })), [act, id]);

  const invite = useCallback((username: string) =>
    act(() => fetch(`/api/bff/connection/collections/${encodeURIComponent(id!)}/members`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
    })), [act, id]);

  return { detail, busy, error, reload, addItem, invite };
}
