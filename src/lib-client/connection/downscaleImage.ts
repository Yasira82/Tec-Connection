'use client';

// Shrink a photo in the browser before it is uploaded.
//
// A phone camera produces a 3–4MB, 4000px-wide JPEG. That file was being stored
// and then streamed back in full to fill a 240px tile in a transcript — so every
// person who opened the conversation waited on megabytes to draw a thumbnail.
// Resizing costs one canvas pass here and saves that download for everyone, on
// every load, forever.
//
// It also makes the upload itself finish: those bytes cross a serverless
// function on a phone connection.
//
// Everything about this is best-effort. If anything fails — an unusual format, a
// browser without `createImageBitmap`, a canvas that will not encode — the
// ORIGINAL file is returned. A photo that sends slowly beats a photo that does
// not send.

/** Long edge, in CSS pixels. Comfortably sharp when opened full-screen. */
export const MAX_EDGE = 1600;

/**
 * Long edge for a photo that is only ever a disc — a profile or group picture.
 *
 * 512 rather than 1600 because the largest an avatar is ever drawn is 66px, and
 * even at a 3x device pixel ratio that is 198px. Storing four times the pixels
 * anyone can see costs the upload, the storage and every download of it.
 */
export const AVATAR_MAX_EDGE = 512;

/** Below this, resizing costs more than it saves. */
const SKIP_UNDER_BYTES = 300 * 1024;

/**
 * How long to wait for the browser to decode the picture before giving up and
 * uploading it as it is. Generous — a big photo on a slow phone is genuinely
 * slow — but finite, which is the point.
 */
const DECODE_TIMEOUT_MS = 10_000;

const OUTPUT_TYPE = 'image/jpeg';
const QUALITY = 0.85;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // `imageOrientation: 'from-image'` applies the EXIF rotation. Without it a
  // photo taken in portrait arrives on its side — the classic bug, and one the
  // user sees immediately.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari has historically ignored the option and thrown; fall through.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      // A DEADLINE, because the two callbacks are not exhaustive.
      //
      // `onload` and `onerror` look like they cover every outcome, and they do
      // not: an environment that never actually fetches the object URL fires
      // NEITHER, and this promise then never settles. Nothing downstream has a
      // timeout either — so the upload would sit forever behind a spinner, with
      // no error, no log, and no way for the person to tell it had given up.
      //
      // Rejecting on the deadline hands control back to the caller's catch,
      // which returns the ORIGINAL file. A photo that uploads at full size beats
      // a photo that never uploads.
      const timer = setTimeout(() => reject(new Error('decode timed out')), DECODE_TIMEOUT_MS);
      const done = (fn: () => void) => { clearTimeout(timer); fn(); };
      img.onload = () => done(() => resolve(img));
      img.onerror = () => done(() => reject(new Error('decode failed')));
      img.src = url;
    });
  } finally {
    // Revoking immediately is safe: decoding is already done or has failed.
    URL.revokeObjectURL(url);
  }
}

/**
 * A smaller JPEG of `file`, or `file` itself when shrinking would not help or
 * could not be done.
 */
export async function downscaleImage(file: File, maxEdge: number = MAX_EDGE): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;
  if (typeof document === 'undefined') return file;

  try {
    const src = await loadBitmap(file);
    const w = 'width' in src ? src.width : 0;
    const h = 'height' in src ? src.height : 0;
    if (!w || !h) return file;

    const scale = Math.min(1, maxEdge / Math.max(w, h));
    // Already small enough in PIXELS: re-encoding would only lose quality.
    if (scale === 1) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if ('close' in src && typeof src.close === 'function') src.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OUTPUT_TYPE, QUALITY);
    });

    // Keep whichever is actually smaller. Re-encoding an already-efficient WebP
    // as JPEG can come out larger, and shipping the bigger one would make this
    // an anti-optimisation.
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
