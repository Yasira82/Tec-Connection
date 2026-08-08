import { NextRequest, NextResponse } from 'next/server';
import { resolveFollowers, resolveProStatus } from '@/lib/connection/discovery';

// GET /api/bff/connection/followers — Connection Pro "Network Insights" (C-107). The
// caller's OWN followers + a mutual flag ("do I follow back?"). Own-scope: the backend
// resolves the username from the session token, never a client field (P6). The LIST is
// gated behind the caller's LIVE subscription (P5 — Connection never stores billing);
// the follower COUNT is non-sensitive and always returned so a non-Pro sees a teaser.
export async function GET(req: NextRequest) {
  const tok = req.cookies.get('tec_access_token')?.value ?? null;
  if (!tok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { count, followers } = await resolveFollowers(tok);
  const isPro = await resolveProStatus(tok);
  if (!isPro) {
    return NextResponse.json({ pro: false, count, followers: [] }, { headers: { 'Cache-Control': 'private, max-age=15' } });
  }
  return NextResponse.json({ pro: true, count, followers }, { headers: { 'Cache-Control': 'private, max-age=15' } });
}
