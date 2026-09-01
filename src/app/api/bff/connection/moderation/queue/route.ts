import { NextRequest, NextResponse } from 'next/server';
import { isModerator, moderationConfigured, sessionUsername } from '@/lib/connection/moderators';

// GET /api/bff/connection/moderation/queue?status=OPEN
//
// The reviewer surface. Reports were being FILED with nowhere to read them —
// a report button that goes into a table nobody opens is a button that lies to
// the person who pressed it.
//
// ── The two gates, and why both are needed ───────────────────────────────────
// The backend queue takes `x-internal-key` and refuses a user session outright,
// on purpose: who reported whom must never be readable by the person reported.
// That means the secret is the only way in — and the secret lives here, on the
// server.
//
// So this route decides, per request, whether it is willing to SPEND that
// secret on the caller's behalf. The session says who is asking; the allowlist
// says whether they may. Neither half is sufficient alone: a session with no
// allowlist would open the queue to everyone, and an allowlist with no session
// would open it to anyone who guessed a name.
//
// Fails closed everywhere (P6): no session → 401, not on the list → 404.
const GW = process.env.API_GATEWAY_URL ?? '';

/** 404, not 403. "Forbidden" confirms the queue exists and that someone is on a list. */
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = sessionUsername(req.cookies.get('tec_user')?.value);
  if (!moderationConfigured || !isModerator(me)) return notFound();
  if (!GW || !process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const status = req.nextUrl.searchParams.get('status');
  // Only the states the service knows. An unrecognised one is dropped rather
  // than forwarded, so it takes the default instead of becoming a value the
  // backend has to reject.
  const q = ['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED'].includes(status ?? '')
    ? `?status=${status}` : '';

  try {
    const res = await fetch(`${GW}/api/identity/connection/reports/queue${q}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': crypto.randomUUID(),
        'x-internal-key': process.env.INTERNAL_SECRET,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[bff/moderation] queue error:', res.status);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[bff/moderation] network error:', (err as Error).message);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
