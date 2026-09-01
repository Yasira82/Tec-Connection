import { describe, it, expect, vi, afterEach } from 'vitest';
import { downscaleImage, MAX_EDGE, AVATAR_MAX_EDGE } from '@/lib-client/connection/downscaleImage';

// Shrinking before upload.
//
// The behaviour worth pinning is the FALLBACK, not the happy path. Every branch
// here returns the original file rather than throwing, and that is deliberate:
// a photo that sends slowly beats a photo that does not send. A future change
// that made one of these throw would break uploading a photo on exactly the
// browsers that already struggle with it, and nothing in the UI would say why.
//
// jsdom has no canvas and no `createImageBitmap`, so it exercises the fallback
// path honestly — which is the path this file is about.

const file = (bytes: number, type = 'image/jpeg') =>
  new File([new Uint8Array(bytes)], 'photo.jpg', { type });

describe('downscaleImage', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns a non-image untouched', async () => {
    const f = file(4 * 1024 * 1024, 'application/pdf');
    expect(await downscaleImage(f)).toBe(f);
  });

  it('leaves a small photo alone — re-encoding would only lose quality', async () => {
    const f = file(120 * 1024);
    expect(await downscaleImage(f)).toBe(f);
  });

  it('gives up on a decode that never finishes, and returns the ORIGINAL', async () => {
    // This test found a real hang. `onload` and `onerror` look exhaustive and
    // are not: an environment that never fetches the object URL fires NEITHER,
    // so the promise never settled — and nothing downstream had a timeout, so
    // the upload sat behind a spinner forever with no error and no log.
    //
    // Fake timers rather than a longer test timeout, so what is asserted is
    // "the DEADLINE is what ended it", not "it finished eventually".
    vi.useFakeTimers();
    try {
      const f = file(4 * 1024 * 1024);
      const pending = downscaleImage(f);
      await vi.advanceTimersByTimeAsync(11_000);
      await expect(pending).resolves.toBe(f);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never rejects on a large file — a throw would read as "photo did not save"', async () => {
    vi.useFakeTimers();
    try {
      const pending = downscaleImage(file(9 * 1024 * 1024));
      await vi.advanceTimersByTimeAsync(11_000);
      await expect(pending).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a smaller edge for avatars than for full-screen photos', async () => {
    // An avatar is drawn at 66px; even at 3x that is 198px. Storing four times
    // the pixels anyone can see costs the upload, the storage, and every
    // download of it.
    expect(AVATAR_MAX_EDGE).toBeLessThan(MAX_EDGE);
    expect(AVATAR_MAX_EDGE).toBeGreaterThanOrEqual(256);
  });
});
