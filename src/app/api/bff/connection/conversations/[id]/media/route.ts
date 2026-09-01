import { NextRequest, NextResponse } from 'next/server';
import {
  CHAT_FOLDER, extOf, isAllowedAttachment, kindOf,
  IMAGE_MAX_BYTES, AUDIO_MAX_BYTES,
} from '@/lib/connection/chat-media';

// POST /api/bff/connection/conversations/<id>/media
//
// The whole attachment upload, server-side: validate → presign → PUT to R2 →
// post the message. The browser talks only to its own origin, which is what
// makes this work at all — a presigned PUT from a browser needs bucket CORS the
// bucket does not have, and a blocked cross-origin request is indistinguishable
// from a dead network. That is the avatar bug; this path never had it.
//
// The caption and duration ride as query params because the body is the raw
// bytes.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GW = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!GW) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id } = await ctx.params;
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mime  = (req.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const bytes = await req.arrayBuffer().catch(() => null);
  if (!bytes) return NextResponse.json({ error: 'INVALID_FILE' }, { status: 400 });

  // The size checked is the ACTUAL byte length, never a number the client
  // claimed — a client-declared size is a suggestion, not a limit.
  if (!isAllowedAttachment(mime, bytes.byteLength)) {
    return NextResponse.json({
      error: 'INVALID_FILE',
      message: `Images up to ${IMAGE_MAX_BYTES / 1024 / 1024}MB (JPEG/PNG/WebP), audio up to ${AUDIO_MAX_BYTES / 1024 / 1024}MB.`,
    }, { status: 400 });
  }

  const kind = kindOf(mime)!;
  const caption = (req.nextUrl.searchParams.get('caption') ?? '').slice(0, 2000);
  const rawMs   = Number(req.nextUrl.searchParams.get('ms'));
  const durationMs = Number.isFinite(rawMs) && rawMs > 0 ? Math.round(rawMs) : undefined;

  const headers = {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-request-id': crypto.randomUUID(),
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };

  try {
    // 1. Presign. Storage derives the uploader from the session token and puts
    //    it in the key, so the key itself records who uploaded it.
    const signRes = await fetch(`${GW}/api/storage/upload-url`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({
        filename: `attachment.${extOf(mime)}`, mimeType: mime,
        size: bytes.byteLength, folder: CHAT_FOLDER,
      }),
    });
    const signed = await signRes.json().catch(() => ({}));
    const { uploadUrl, key } = signed?.data ?? {};
    if (!signRes.ok || !uploadUrl || !key) {
      return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'sign' }, { status: 502 });
    }

    // 2. PUT server-side. Content-Type must match what the URL was signed for
    //    or R2 rejects the signature.
    const put = await fetch(uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': mime } });
    if (!put.ok) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'put' }, { status: 502 });

    // 3. Post the message. Membership is checked there, as it is for every
    //    other write — an upload that succeeds into a conversation you do not
    //    belong to still produces no message.
    const msgRes = await fetch(
      `${GW}/api/identity/connection/conversations/${encodeURIComponent(id)}/messages`,
      {
        method: 'POST', headers, cache: 'no-store',
        body: JSON.stringify({
          body: caption, media_key: key, media_type: kind,
          media_mime: mime, ...(durationMs && { media_duration_ms: durationMs }),
        }),
      },
    );
    const msg = await msgRes.json().catch(() => ({}));
    if (!msgRes.ok) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'attach' }, { status: msgRes.status });

    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'network' }, { status: 502 });
  }
}
