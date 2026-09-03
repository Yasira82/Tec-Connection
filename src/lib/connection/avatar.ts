import 'server-only';

// Profile photos (C-107), server side.
//
// The storage bucket is PRIVATE — see tec-core-backend #237. There is no URL a
// browser can load, so Connection fetches the bytes itself and serves them
// same-origin from /api/avatar/<handle>. Three consequences worth stating
// because each of them is a decision, not an accident:
//
//   · No CSP change. Images are `'self'`, which the app already allows. Making
//     the bucket public would have meant editing img-src in every consuming app.
//   · No credentialed URL ever reaches a browser, and no URL expires — a shared
//     profile link keeps working, which is the whole point of the share card.
//   · Removal is instant and total. Clearing `avatar_key` kills every copy,
//     because every byte passes through here. That is the only moderation
//     control that exists today, and it is worth keeping cheap.
//
// The object KEY never leaves the server: it is fetched from an internal
// endpoint and used immediately. Public API responses carry `has_avatar` only.
const GW = process.env.API_GATEWAY_URL ?? '';

const internalHeaders = () => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

/** The stored avatar key for a handle, or null. Server-only — never returned to a client. */
export async function resolveAvatarKey(username: string): Promise<string | null> {
  if (!GW || !username) return null;
  try {
    const res = await fetch(`${GW}/api/identity/connection/internal/avatar-key`, {
      method: 'POST', headers: internalHeaders(),
      body: JSON.stringify({ username }), cache: 'no-store',
    });
    if (!res.ok) return null;
    const key = (await res.json().catch(() => ({})))?.data?.key;
    return typeof key === 'string' && key ? key : null;
  } catch { return null; }
}

export interface AvatarBytes { body: ArrayBuffer; contentType: string }

/**
 * A cache validator for the CURRENT photo of a handle.
 *
 * Derived from the stored object key, which a change or a removal replaces — so
 * two different photos can never share one. It is a HASH rather than the key
 * itself because an ETag travels to the browser, and the key is the one thing
 * this module exists to keep on the server (see the note at the top).
 *
 * Truncated to 22 base64url characters: this is a cache tag, not a secret, and
 * the only collision that could matter is between two successive photos of the
 * SAME person at the SAME URL.
 */
export async function avatarETag(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const bytes = String.fromCharCode(...new Uint8Array(digest));
  const b64 = btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `"${b64.slice(0, 22)}"`;
}

/**
 * The image bytes for a handle, or null when there is no photo.
 *
 * Any failure — unreachable gateway, missing key, storage refusing the key —
 * yields null so the caller can fall back to the initial. A profile page must
 * never fail because a photo could not be loaded.
 */
export async function resolveAvatarBytes(username: string): Promise<AvatarBytes | null> {
  const key = await resolveAvatarKey(username);
  if (!key) return null;
  return fetchAvatarBytes(key);
}

/** The bytes behind a key already resolved. Split out so the route can answer a
 *  conditional request from the key ALONE, without pulling the image. */
export async function fetchAvatarBytes(key: string): Promise<AvatarBytes | null> {
  try {
    const res = await fetch(`${GW}/api/storage/internal/public-object`, {
      method: 'POST', headers: internalHeaders(),
      body: JSON.stringify({ key }), cache: 'no-store',
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    // Serve only what we asked for. The upload path restricts the type, but this
    // is the response that reaches a browser: anything that is not an image gets
    // dropped rather than passed through with a content type a browser might
    // decide to execute.
    if (!contentType.startsWith('image/')) return null;

    return { body: await res.arrayBuffer(), contentType };
  } catch { return null; }
}

// What a browser is allowed to upload as a profile photo.
//
// Stricter than tec-storage-service's own limits (10MB, gif included) on
// purpose: this is a small round avatar, and the narrower the accepted set the
// less there is to get wrong. GIF is excluded because an animated avatar in a
// directory listing is a distraction the page did not ask for; SVG is excluded
// because it is a script container, not an image.
export const AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_FOLDER = 'avatars';

export const isAllowedAvatar = (mimeType: string, size: number): boolean =>
  (AVATAR_MIME as readonly string[]).includes(mimeType) &&
  Number.isFinite(size) && size > 0 && size <= AVATAR_MAX_BYTES;
