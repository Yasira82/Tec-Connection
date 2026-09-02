import { NextRequest, NextResponse } from 'next/server';
import { avatarETag, fetchAvatarBytes, resolveAvatarKey } from '@/lib/connection/avatar';

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
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;

  // The KEY first, the bytes second. It is the key that says WHICH photo is
  // current, so a browser holding the right one is answered without the image
  // ever being pulled out of storage.
  const key = await resolveAvatarKey(username);
  if (!key) {
    // A removal has to be able to reach a browser that is holding the old photo.
    // Never store "there is no photo" — it is the answer most likely to change.
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const etag = await avatarETag(key);

  // The photo is REVALIDATED, not held for an hour.
  //
  // This used to be `max-age=3600, s-maxage=86400` on the reasoning that a
  // change mints a new key and the page requests `?v=<n>`. Only the upload
  // control does that. Every other surface — Settings, Discover, the message
  // list, the shared profile card — asks for the bare URL through `tryPhoto`,
  // which is the whole point of that flag: those surfaces do not know a version
  // exists. So a photo the owner had DELETED kept being painted from cache for
  // an hour, on the same screen as a card offering to add one.
  //
  // `max-age=0, must-revalidate` + an ETag keeps the bytes in the cache and
  // spends one conditional request to ask whether they are still the right
  // bytes. The usual answer is a 304 with no body.
  const cacheControl = 'public, max-age=0, must-revalidate';

  // `If-None-Match` may carry a list, and a shared cache may weaken the tag.
  const inm = req.headers.get('if-none-match');
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, 'Cache-Control': cacheControl } });
  }

  const img = await fetchAvatarBytes(key);
  if (!img) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  return new NextResponse(img.body, {
    headers: {
      'Content-Type': img.contentType,
      ETag: etag,
      'Cache-Control': cacheControl,
      // The bytes came from user upload. Never let a browser sniff its way to a
      // different content type than the one we validated.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
