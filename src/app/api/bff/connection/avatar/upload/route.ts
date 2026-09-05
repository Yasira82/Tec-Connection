import { NextRequest, NextResponse } from 'next/server';
import { AVATAR_FOLDER, AVATAR_MAX_BYTES, isAllowedAvatar } from '@/lib/connection/avatar';
import { resolveMyProfile, saveMyProfile } from '@/lib/connection/discovery';

// POST /api/bff/connection/avatar/upload — the whole upload, server-side.
//
// ── Why this replaced the browser→R2 direct PUT ──────────────────────────────
// A presigned URL lets a BROWSER write to R2 only if the bucket carries a CORS
// policy allowing PUT from this origin. It does not, so every upload failed with
// an opaque "Network error" — the browser blocks the request before it is sent,
// and a blocked cross-origin request is indistinguishable from a dead network.
//
// The same lesson is already written in this platform's own storage service:
//
//   r2.service.ts — "Direct server-side read of the object bytes (no presigned
//   URL) … avoids presigned-GET signature/CORS/param fragility; the Hub server
//   streams the bytes same-origin."
//
// That note is about downloads. Uploads have the identical constraint, and the
// direct-PUT design walked into it anyway.
//
// So the bytes come here instead. The browser POSTs to its own origin (no CORS
// involved at all), and this route — which has no browser security model — does
// the presign and the PUT to R2 itself.
//
// The cost is real and bounded: a 2MB image now passes through a serverless
// function. Vercel's request body limit is 4.5MB, so the 2MB cap has headroom.
// If the bucket ever gets a CORS policy, direct upload can come back as a fast
// path — but it must not be the ONLY path, because it fails silently when the
// policy is missing.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GW = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mimeType = (req.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const bytes    = await req.arrayBuffer().catch(() => null);
  if (!bytes) return NextResponse.json({ error: 'INVALID_FILE' }, { status: 400 });

  // The declared type is the request's own Content-Type and the size is the
  // actual byte length — not a number the client claimed. The old flow trusted
  // a client-supplied `size` because the browser did the upload; here the real
  // length is in hand, so it is the one that is checked.
  if (!isAllowedAvatar(mimeType, bytes.byteLength)) {
    return NextResponse.json(
      {
        error: 'INVALID_FILE',
        message: `Use a JPEG, PNG or WebP image under ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)}MB.`,
      },
      { status: 400 },
    );
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const headers = {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-request-id': crypto.randomUUID(),
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };

  try {
    // 1. Presign. The uploader's identity is never sent — storage derives it
    //    from the session token and embeds it in the key, which is what makes
    //    ownership provable when the key is attached (tec-core-backend #237).
    const signRes = await fetch(`${GW}/api/storage/upload-url`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({
        filename: `avatar.${ext}`, mimeType, size: bytes.byteLength, folder: AVATAR_FOLDER,
      }),
    });
    const signed = await signRes.json().catch(() => ({}));
    const { uploadUrl, key } = signed?.data ?? {};
    if (!signRes.ok || !uploadUrl || !key) {
      // The UPSTREAM status travels with the step. A refused presign is a 401
      // (session), a 403 (internal key) or a 500 (bucket) — three different
      // problems that look identical from the phone, and this upload has been
      // reported working on one account and not another.
      return NextResponse.json(
        { error: 'UPLOAD_FAILED', step: `sign:${signRes.status}` }, { status: 502 },
      );
    }

    // 2. PUT the bytes server-side. Content-Type must match what the URL was
    //    signed for or R2 rejects the signature.
    const put = await fetch(uploadUrl, {
      method: 'PUT', body: bytes, headers: { 'Content-Type': mimeType },
    });
    if (!put.ok) {
      return NextResponse.json({ error: 'UPLOAD_FAILED', step: `put:${put.status}` }, { status: 502 });
    }

    // 3. Attach the key to the profile. Read-modify-write, because the backend
    //    profile PUT is a full replace — sending the key alone would erase the
    //    headline and unlist the person. See ../route.ts.
    const current = await resolveMyProfile(token);
    if (!current) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'profile' }, { status: 502 });

    const profile = await saveMyProfile(token, {
      headline:   current.headline,
      category:   current.category,
      published:  current.published,
      avatar_key: key,
    });
    if (!profile) return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'attach' }, { status: 502 });

    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ error: 'UPLOAD_FAILED', step: 'network' }, { status: 502 });
  }
}
