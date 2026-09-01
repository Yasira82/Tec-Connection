import 'server-only';
import { kindOf } from './chat-media';

// Status photos (C-107), server side.
//
// Same shape as chat attachments, and for the same reason: a status is private
// to the author's audience, so every read goes through identity-service first —
//
//   GET /identity/connection/stories/:id/media-key
//
// which re-derives the follow graph and the block list before it will hand over
// the key. The key never reaches a browser; this module fetches the bytes and
// the route streams them same-origin. No presigned URL, so no bucket CORS.
const GW = process.env.API_GATEWAY_URL ?? '';

export const STORY_FOLDER = 'stories';

/** Photos only. A status is a glance — a voice note in one is a different feature. */
export const STORY_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Same 3MB ceiling as a chat photo: these bytes cross a serverless function. */
export const STORY_MAX_BYTES = 3 * 1024 * 1024;

export const MAX_CAPTION = 300;

export function isAllowedStoryImage(mime: string, size: number): boolean {
  const m = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(STORY_IMAGE_MIME as readonly string[]).includes(m)) return false;
  // The ACTUAL byte length, never a number the client claimed.
  return Number.isFinite(size) && size > 0 && size <= STORY_MAX_BYTES;
}

export interface MediaBytes { body: ArrayBuffer; contentType: string }

/**
 * The bytes of one status photo, or null.
 *
 * Any failure yields null so a status card renders without its picture rather
 * than failing the whole feed.
 */
export async function resolveStoryMedia(token: string, storyId: string): Promise<MediaBytes | null> {
  if (!GW || !token || !storyId) return null;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-request-id': crypto.randomUUID(),
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };
  try {
    const keyRes = await fetch(
      `${GW}/api/identity/connection/stories/${encodeURIComponent(storyId)}/media-key`,
      { method: 'GET', headers, cache: 'no-store' },
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
    // Serve only what was allowed on the way in — this is the response that
    // reaches a browser.
    if (kindOf(contentType) !== 'image') return null;

    return { body: await res.arrayBuffer(), contentType };
  } catch { return null; }
}
