import { NextRequest, NextResponse } from 'next/server';
import { resolveAvatarBytes } from '@/lib/connection/avatar';

// GET /api/avatar/<handle> — a profile photo, served same-origin.
//
// Public and session-free by design: this is what an <img> on the landing, the
// directory and a shared profile link points at, and all three are reachable
// without signing in. The storage bucket is private, so the bytes are fetched
// server-side (see src/lib/connection/avatar.ts) and streamed from here.
//
// 404 rather than a placeholder when there is no photo: the client-side Avatar
// falls back to the person's coloured initial, and an endpoint that invents an
// image would make "no photo" indistinguishable from "photo failed to load".
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const img = await resolveAvatarBytes(username);
  if (!img) return new NextResponse(null, { status: 404 });

  return new NextResponse(img.body, {
    headers: {
      'Content-Type': img.contentType,
      // Cached hard at the edge and in the browser. A photo change mints a NEW
      // key, and the page requests `?v=<n>` when one exists, so a stale copy can
      // only ever be the photo the viewer already had.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      // The bytes came from user upload. Never let a browser sniff its way to a
      // different content type than the one we validated.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
