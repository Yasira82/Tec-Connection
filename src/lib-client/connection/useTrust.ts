'use client';

import { useCallback, useEffect, useState } from 'react';

// TEC Connection (C-107) Trust Graph — the caller's own trust view (derived from
// paid orders, eventual). Server scopes by session; the client never sends identity.

export interface TrustEdge {
  user_id: string;
  /**
   * The counterparty's Pi username, when auth could resolve it.
   *
   * Optional on purpose: the backend asks auth (the identity authority) and
   * falls back to an empty map on any failure, so a row without a name is the
   * normal degraded case and never an error. The UI renders an ordinal there.
   */
  username?: string;
  orders:  number;
  volume:  string;
  last_at: string;
}
export interface TrustSide {
  partners: number;
  orders:   number;
  volume:   string;
  edges:    TrustEdge[];
}
export interface Trust {
  given:    TrustSide;
  received: TrustSide;
}

const EMPTY: TrustSide = { partners: 0, orders: 0, volume: '0', edges: [] };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json?.error as string) ?? `Request failed (${res.status})`);
  return (json?.data as Record<string, unknown>) ?? json;
}

export function useTrust() {
  const [trust,   setTrust]   = useState<Trust>({ given: EMPTY, received: EMPTY });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/bff/connection/trust', { credentials: 'include', cache: 'no-store' })
      .then(readJson)
      .then((d) => setTrust((d.trust as Trust) ?? { given: EMPTY, received: EMPTY }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load trust'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  return { trust, loading, error, reload };
}
