import { NextRequest, NextResponse } from 'next/server';
import {
  STORY_FOLDER, STORY_MAX_BYTES, MAX_CAPTION, isAllowedStoryImage,
} from '@/lib/connection/story-media';
import { extOf } from '@/lib/connection/chat-media';

// POST /api/bff/connection/stories/upload
//
// A status WITH a photo, server-side end to end: validate → presign → PUT to R2
// → post the status. The browser talks only to its own origin, which is what
// makes this work at all — a presigned PUT from a browser needs bucket CORS the
// bucket does not have, and a blocked cross-origin request is indistinguishable
// from a dead network.
//
// The caption rides as a query param because the body is the raw bytes.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GW = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mime  = (req.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const bytes = await req.arrayBuffer().catch(() => null);
  if (!bytes) return NextResponse.json({ error: 'INVALID_FILE' }, { status: 400 });

  // The size checked is the ACTUAL byte length, never a number the client
  // claimed — a client-declared size is a suggestion, not a limit.
  if (!isAllowedStoryImage(mime, bytes.byteLength)) {
    return NextResponse.json({
      error: 'INVALID_FILE',
      message: `Photos up to ${STORY_MAX_BYTES / 1024 / 1024}MB (JPEG/PNG/WebP).`,
    }, { status: 400 });
  }

  const caption = (req.nextUrl.searchParams.get('caption') ?? '').slice(0, MAX_CAPTION);

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
        filename: `status.${extOf(mime)}`, mimeType: mime,
        size: bytes.byteLength, folder: STORY_FOLDER,
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

    // 3. Post the status. The author is the session there, as it is for every
    //    other write — an upload that succeeds still produces no status if the
    //    author cannot be established.
    const res = await fetch(`${GW}/api/identity/connection/stories`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ caption, media_key: key, media_mime: mime }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'post' }, { status: res.status });

    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'network' }, { status: 502 });
  }
}
