import { NextRequest, NextResponse } from 'next/server';
import { purgeObjects } from '@/lib/connection/purge';

// GET /api/cron/purge-stories — sweep lapsed statuses and the photos behind them.
//
// A status is invisible the second it lapses: every read filters on
// `expires_at`, so nothing here changes what anyone SEES. What it changes is
// what is KEPT. Without it, "visible for 24 hours" means the picture stays in
// the bucket forever — a promise the data does not honour, and a storage bill
// that only grows.
//
// ── Why it is a GET, and why it is not under /api/bff ────────────────────────
// Vercel Cron issues a GET with no Origin and no cookies. Every `/api/bff/*`
// route sits behind the CSRF middleware, so a cron POST there would be answered
// with 403 forever and the sweep would silently never run. A GET outside that
// prefix is the shape the platform actually delivers.
//
// The GET is not a claim that this is read-only — it deletes. What makes that
// acceptable is that nothing but the scheduler can reach it: the secret below is
// required, checked in constant time, and fails CLOSED when unset (P6).
//
// ── The two halves ──────────────────────────────────────────────────────────
// identity-service deletes the ROWS and reports the keys they held; storage
// deletes the OBJECTS. Neither service can do the other's half — identity makes
// no outbound calls at all, and storage does not know what a status is. This
// route is the only place that holds both, which is exactly why it exists here.
const GW = process.env.API_GATEWAY_URL ?? '';

/** One pass. Bounded so a backlog drains over several runs instead of one long request. */
const BATCH = 200;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured → refuse. An unguarded delete endpoint is worse than a
  // sweep that has not started running yet.
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided.length !== secret.length) return false;
  // Constant-time: lengths already match, so a plain XOR fold is enough and
  // avoids leaking the secret one character at a time through timing.
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!GW || !process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${GW}/api/identity/connection/stories/purge-expired?limit=${BATCH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET,
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      console.error('[cron/purge-stories] identity refused:', res.status);
      return NextResponse.json({ error: 'Purge failed' }, { status: 502 });
    }

    // NESTED envelope — `{ success, data: { deleted, mediaKeys } }`. Reading
    // `body.mediaKeys` here would be `undefined` with no error, and the objects
    // would be orphaned by the very job written to collect them.
    const body = await res.json().catch(() => ({}));
    const deleted  = Number(body?.data?.deleted ?? 0);
    const keys     = Array.isArray(body?.data?.mediaKeys) ? body.data.mediaKeys : [];
    const purged   = await purgeObjects(keys);

    // The counts differ legitimately: a text-only status has no key at all. A
    // gap between `keys.length` and `purged` is the one worth watching.
    console.log(`[cron/purge-stories] rows=${deleted} keys=${keys.length} purged=${purged}`);
    return NextResponse.json({ ok: true, deleted, purged });
  } catch (err) {
    console.error('[cron/purge-stories] network error:', (err as Error).message);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
