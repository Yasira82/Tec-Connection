import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicProfile } from '@/lib/connection/discovery';

// GET /api/bff/connection/profile/[username] — a PUBLIC shareable profile (C-107).
// PUBLISHED profiles only (opt-in). 404 when unknown/unpublished so the public page
// can show an honest "not found" rather than a fabricated card. No session required.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const profile = await resolvePublicProfile(username);
  if (!profile) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(
    { profile },
    { headers: { 'Cache-Control': 'public, max-age=30' } },
  );
}
