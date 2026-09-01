import { NextRequest, NextResponse } from 'next/server';
import { resolveGroupAvatar, CHAT_FOLDER } from '@/lib/connection/chat-media';
import { callConnection } from '@/lib/bff/connectionGateway';
import { purgeObjects, takeMediaKeys } from '@/lib/connection/purge';
import { AVATAR_MAX_BYTES, isAllowedAvatar } from '@/lib/connection/avatar';

// A group's photo.
//
//   GET    → the bytes, streamed same-origin (what <img src> points at)
//   POST   → upload and attach, owner only (raw bytes in the body)
//   DELETE → remove it
//
// Every group used to draw a letter disc while every person showed a photo,
// which reads as the photo being broken rather than as a deliberate difference.
// The honest cause was that a group had no photo to show and no way to set one.
//
// The upload mirrors the profile-avatar path exactly, including the reason it
// looks like this: a presigned PUT from a BROWSER needs bucket CORS the bucket
// does not have, and a blocked cross-origin request is indistinguishable from a
// dead network. So the bytes come here and this route does the PUT.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GW = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  // 404 with no body for signed-out, non-member, and no-photo alike — the same
  // answer to every question, so the URL cannot be used to probe what exists.
  // It is also what makes `tryPhoto` safe: the component falls back on error.
  if (!token) return new NextResponse(null, { status: 404 });

  const media = await resolveGroupAvatar(token, id);
  if (!media) return new NextResponse(null, { status: 404 });

  return new NextResponse(media.body, {
    headers: {
      'Content-Type': media.contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      // PRIVATE: a shared cache holding a private group's picture would serve it
      // to whoever asked next. And short, not immutable — unlike a message
      // attachment this URL does not change when the photo does, so a long cache
      // would leave the old picture on screen after it was replaced.
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!GW) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id } = await ctx.params;
  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mimeType = (req.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const bytes = await req.arrayBuffer().catch(() => null);
  if (!bytes) return NextResponse.json({ error: 'INVALID_FILE' }, { status: 400 });

  // The ACTUAL byte length, never a number the client claimed.
  if (!isAllowedAvatar(mimeType, bytes.byteLength)) {
    return NextResponse.json({
      error: 'INVALID_FILE',
      message: `Use a JPEG, PNG or WebP image under ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)}MB.`,
    }, { status: 400 });
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-request-id': crypto.randomUUID(),
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };

  try {
    const signRes = await fetch(`${GW}/api/storage/upload-url`, {
      method: 'POST', headers, cache: 'no-store',
      // CHAT_FOLDER, not `avatars/`, and the reason is a hard constraint rather
      // than a preference: storage refuses to DELETE anything under `avatars/`
      // — a person's photo has no lifecycle that ends, so a delete primitive
      // over it would be capability with no use case. A group photo does end:
      // it is replaced, cleared, and dies with the group. Filed under avatars
      // it could never be purged, and every replacement would orphan an object
      // with no error to show for it.
      body: JSON.stringify({
        filename: `group.${ext}`, mimeType, size: bytes.byteLength, folder: CHAT_FOLDER,
      }),
    });
    const signed = await signRes.json().catch(() => ({}));
    const { uploadUrl, key } = signed?.data ?? {};
    if (!signRes.ok || !uploadUrl || !key) {
      return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'sign' }, { status: 502 });
    }

    // Content-Type must match what the URL was signed for or R2 rejects it.
    const put = await fetch(uploadUrl, {
      method: 'PUT', body: bytes, headers: { 'Content-Type': mimeType },
    });
    if (!put.ok) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'put' }, { status: 502 });

    // Attach. Ownership is checked THERE, not here — the service owns that rule,
    // and a copy of it in this route would be a second place for it to drift.
    const { status, data } = await callConnection(
      req, 'PUT', `/api/identity/connection/conversations/${encodeURIComponent(id)}/avatar`, { key },
    );
    if (status < 200 || status >= 300) return NextResponse.json(data, { status });

    // The photo it REPLACED. Without this, changing a group photo five times
    // leaves five images in storage and only the last one reachable.
    const { keys, body } = takeMediaKeys(data);
    if (keys.length) await purgeObjects(keys);

    return NextResponse.json({ ok: true, ...body });
  } catch {
    return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'network' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, data } = await callConnection(
    req, 'DELETE', `/api/identity/connection/conversations/${encodeURIComponent(id)}/avatar`,
  );
  if (status < 200 || status >= 300) return NextResponse.json(data, { status });

  const { keys, body } = takeMediaKeys(data);
  if (keys.length) await purgeObjects(keys);
  return NextResponse.json(body, { status });
}
