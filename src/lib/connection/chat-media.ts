import 'server-only';

// Chat attachments (C-107), server side.
//
// This is the avatar pattern with one difference that changes everything: an
// avatar is PUBLIC, a photo inside a conversation is NOT. So where
// `resolveAvatarBytes` needs only a handle, every read here goes through
// identity-service first:
//
//   GET /identity/connection/conversations/:id/media/:messageId
//
// which checks that the caller is a member of that conversation AND that the
// message belongs to it, and only then returns the storage key. The key never
// reaches a browser; this module fetches the bytes and the route streams them
// same-origin. No presigned URL, so no bucket CORS — the lesson from the avatar
// upload, applied from the start this time.
const GW = process.env.API_GATEWAY_URL ?? '';

const internalHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

// What a browser may attach.
//
// Images: the same three as avatars. GIF is excluded because an autoplaying loop
// in a transcript is a decision, not a default; SVG because it is a script
// container, not an image.
//
// Audio: whatever MediaRecorder actually produces. Chromium (and therefore Pi
// Browser on Android) emits `audio/webm;codecs=opus`; Safari emits `audio/mp4`.
// Listing both means the recorder does not have to transcode.
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AUDIO_MIME = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'] as const;

// Vercel refuses a request body over 4.5MB, and these bytes pass through a
// serverless function on their way to R2. 3MB leaves room for the framing rather
// than sitting on the edge of a limit whose failure mode is an opaque 413.
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const CHAT_FOLDER = 'chat';

export type MediaKind = 'image' | 'audio';

/** The rendering kind for a mime type, or null when it is not allowed at all. */
export function kindOf(mime: string): MediaKind | null {
  const m = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if ((IMAGE_MIME as readonly string[]).includes(m)) return 'image';
  if ((AUDIO_MIME as readonly string[]).includes(m)) return 'audio';
  return null;
}

export function isAllowedAttachment(mime: string, size: number): boolean {
  const kind = kindOf(mime);
  if (!kind) return false;
  const cap = kind === 'image' ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
  return Number.isFinite(size) && size > 0 && size <= cap;
}

/** File extension for a stored object. Cosmetic — the mime is what is served. */
export function extOf(mime: string): string {
  const m = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  } as Record<string, string>)[m] ?? 'bin';
}

export interface MediaBytes { body: ArrayBuffer; contentType: string }

/**
 * The bytes of one message's attachment, or null.
 *
 * `token` is the caller's session — identity-service uses it to decide whether
 * this person may see the attachment at all. Any failure yields null so a
 * transcript never fails to render because one image could not be loaded.
 */
export async function resolveChatMedia(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<MediaBytes | null> {
  if (!GW || !token || !conversationId || !messageId) return null;
  try {
    const keyRes = await fetch(
      `${GW}/api/identity/connection/conversations/${encodeURIComponent(conversationId)}/media/${encodeURIComponent(messageId)}`,
      { method: 'GET', headers: internalHeaders(token), cache: 'no-store' },
    );
    if (!keyRes.ok) return null;
    const key = (await keyRes.json().catch(() => ({})))?.data?.key;
    if (typeof key !== 'string' || !key) return null;

    const res = await fetch(`${GW}/api/storage/internal/public-object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({ key }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    // Serve only what was allowed on the way in. This is the response that
    // reaches a browser: anything outside the accepted set is dropped rather
    // than passed through with a type a browser might decide to execute.
    if (!kindOf(contentType)) return null;

    return { body: await res.arrayBuffer(), contentType };
  } catch { return null; }
}

/**
 * The bytes of a GROUP's photo.
 *
 * Same two hops as an attachment — identity-service checks membership and hands
 * back the key, storage returns the bytes — because a group's picture is as
 * private as the group. It is keyed by the conversation rather than by a
 * handle, which is the only reason this cannot reuse the avatar route.
 *
 * Images only on the way out, whatever the key turns out to point at.
 */
export async function resolveGroupAvatar(
  token: string,
  conversationId: string,
): Promise<MediaBytes | null> {
  if (!GW || !token || !conversationId) return null;
  try {
    const keyRes = await fetch(
      `${GW}/api/identity/connection/conversations/${encodeURIComponent(conversationId)}/avatar`,
      { method: 'GET', headers: internalHeaders(token), cache: 'no-store' },
    );
    if (!keyRes.ok) return null;
    const key = (await keyRes.json().catch(() => ({})))?.data?.key;
    if (typeof key !== 'string' || !key) return null;

    const res = await fetch(`${GW}/api/storage/internal/public-object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({ key }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (kindOf(contentType) !== 'image') return null;

    return { body: await res.arrayBuffer(), contentType };
  } catch { return null; }
}
