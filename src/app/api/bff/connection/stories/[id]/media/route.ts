import { NextRequest, NextResponse } from 'next/server';
import { resolveStoryMedia } from '@/lib/connection/story-media';

// GET /api/bff/connection/stories/<id>/media
//
// The photo behind one status, streamed same-origin. This is what an <img src>
// points at: a public-LOOKING URL guarding private content, where the session
// cookie is the only thing that makes it resolve.
//
// Everything deciding "may this person see it" happens in identity-service —
// the follow graph and the block list, re-derived per request. A signed-out
// request, a stranger's, or an expired status all get the same 404 with no
// body, so the URL cannot be used to probe what exists.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return new NextResponse(null, { status: 404 });

  const media = await resolveStoryMedia(token, id);
  if (!media) return new NextResponse(null, { status: 404 });

  return new NextResponse(media.body, {
    headers: {
      'Content-Type': media.contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      // A status photo never changes — but it does EXPIRE, and a year-long
      // cache would outlive the status itself. One hour, private: long enough
      // that flicking back through a feed does not refetch, short enough that
      // the cache cannot outlast the audience check that authorised it.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
