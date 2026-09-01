import { NextRequest, NextResponse } from 'next/server';
import { resolveChatMedia } from '@/lib/connection/chat-media';

// GET /api/bff/connection/conversations/<id>/media/<messageId>
//
// The bytes of one attachment, streamed same-origin. This is what an <img src>
// and an <audio src> point at, so it is a PUBLIC-looking URL guarding PRIVATE
// content — the session cookie is the only thing that makes it resolve.
//
// Everything that decides "may this person see it" happens in identity-service
// (membership + the message belonging to the conversation). A signed-out or
// non-member request gets 404 with no body: the same answer for "no such
// message" and "not yours", so the URL cannot be used to probe what exists.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return new NextResponse(null, { status: 404 });

  const media = await resolveChatMedia(token, id, messageId);
  if (!media) return new NextResponse(null, { status: 404 });

  return new NextResponse(media.body, {
    headers: {
      'Content-Type': media.contentType,
      'Content-Disposition': 'inline',
      // Never let a browser guess a type for bytes someone else uploaded.
      'X-Content-Type-Options': 'nosniff',
      // An attachment is immutable — a new photo is a new message — but the
      // cache must stay PRIVATE: a shared cache holding a private conversation's
      // image would serve it to whoever asked next.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
