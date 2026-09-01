import { NextRequest, NextResponse } from 'next/server';
import { isModerator, moderationConfigured, sessionUsername } from '@/lib/connection/moderators';

// POST /api/bff/connection/moderation/<id>/resolve  { status, resolution? }
//
// The other half of the reviewer surface: reading a queue you cannot act on is
// a queue that only grows. Same two gates as the read — session says who is
// asking, allowlist says whether they may, and the internal key never leaves
// this server.
//
// Deciding a report is a moderation ACT, so the reviewer's username is recorded
// with it: an unattributable decision is not a decision anyone can be asked
// about later (Invariant #4 — every consequential action leaves a trail).
const GW = process.env.API_GATEWAY_URL ?? '';

// Exactly what the service accepts — REVIEWED (looked at, no action), ACTIONED
// (something was done), DISMISSED (not a problem). Kept in step deliberately:
// a value this route invents would 400 at the boundary and read as a broken
// button rather than a rejected input.
const STATUSES = ['REVIEWED', 'ACTIONED', 'DISMISSED'] as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = sessionUsername(req.cookies.get('tec_user')?.value);
  // 404 rather than 403 — consistent with the queue, and for the same reason.
  if (!moderationConfigured || !isModerator(me)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!GW || !process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status ?? '');
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
  }

  // The note the reviewer typed, prefixed with WHO decided. The reviewer's name
  // is added here from the session and never taken from the request — a client
  // that could name the deciding moderator could name someone else.
  const typed = typeof body?.resolution === 'string' ? body.resolution.trim().slice(0, 500) : '';
  const resolution = [`by @${me}`, typed].filter(Boolean).join(' — ');

  try {
    const res = await fetch(
      `${GW}/api/identity/connection/reports/${encodeURIComponent(id)}/resolve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET,
        },
        body: JSON.stringify({ status, resolution }),
        cache: 'no-store',
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[bff/moderation] resolve error:', res.status);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[bff/moderation] network error:', (err as Error).message);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
