import { NextRequest, NextResponse } from 'next/server';
import { resolveDirectory } from '@/lib/connection/discovery';

// GET /api/bff/connection/discover — the PUBLIC Discover directory (C-107). Opt-in
// listings only; no session required (a Pi-community surface). `source: 'live'` when
// the backend answered, else an honest empty state — never a fabricated directory.
export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q')        ?? undefined;
  const category = req.nextUrl.searchParams.get('category') ?? undefined;
  const profiles = await resolveDirectory({ query: q, category });
  return NextResponse.json(
    { source: 'live', profiles },
    { headers: { 'Cache-Control': 'public, max-age=30' } },
  );
}
