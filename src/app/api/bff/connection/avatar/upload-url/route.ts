import { NextRequest, NextResponse } from 'next/server';
import { AVATAR_FOLDER, AVATAR_MAX_BYTES, AVATAR_MIME, isAllowedAvatar } from '@/lib/connection/avatar';

// POST /api/bff/connection/avatar/upload-url
//
// Step 1 of 3 in the upload: mint a presigned R2 PUT URL. The browser then PUTs
// the file straight to storage (step 2) and tells us the key (step 3).
//
// The identity of the uploader is NEVER sent from here. tec-storage-service
// derives it from the session token and embeds it in the object key, which is
// what makes ownership provable later (C-107 / P6). A client-supplied user id
// would be the whole vulnerability.
//
// The type and size limits are enforced HERE as well as in storage. Not
// belt-and-braces for its own sake: storage's limits are deliberately wider
// (10MB, any image type) because it serves KYC documents and asset media too.
// The avatar rules are Connection's, so Connection states them.
const GW = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const token = req.cookies.get('tec_access_token')?.value ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mimeType = String(body?.mimeType ?? '');
  const size     = Number(body?.size ?? 0);

  if (!isAllowedAvatar(mimeType, size)) {
    return NextResponse.json(
      {
        error: 'INVALID_FILE',
        message: `Use a JPEG, PNG or WebP image under ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)}MB.`,
        allowed: AVATAR_MIME,
      },
      { status: 400 },
    );
  }

  // The extension is derived from the VALIDATED mime type, never from the
  // client's filename — a filename is attacker-controlled text that ends up in
  // the object key.
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

  try {
    const res = await fetch(`${GW}/api/storage/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        'x-request-id': crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({ filename: `avatar.${ext}`, mimeType, size, folder: AVATAR_FOLDER }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: 'UPLOAD_URL_FAILED' }, { status: 502 });

    const { uploadUrl, key } = data?.data ?? {};
    if (!uploadUrl || !key) return NextResponse.json({ error: 'UPLOAD_URL_FAILED' }, { status: 502 });

    return NextResponse.json({ uploadUrl, key });
  } catch {
    return NextResponse.json({ error: 'UPLOAD_URL_FAILED' }, { status: 502 });
  }
}
