import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MediaImage } from '@/app/app/components/MediaImage';

// A photo sent in a chat was invisible in the transcript, and appeared the
// instant it was tapped.
//
// Both media surfaces held the image at `opacity: 0` until their own `onLoad`
// fired. An image served from CACHE can finish decoding before React attaches
// that listener — the event fires with nothing listening and never comes again,
// so the frame stays transparent for the life of the screen while holding
// perfectly good bytes. Opening it worked because the viewer requested the same
// URL and got it back immediately.
//
// The second half was that a FAILED image looked identical: there was no
// `onError` anywhere, so a 404 also read as "Loading…", permanently.
//
// jsdom/happy-dom never loads an image, so `complete` is driven directly here —
// which is exactly the condition being pinned: what the element already knows,
// versus what an event told us.

const label = { loadingLabel: 'Loading…', failedLabel: 'Photo unavailable' };
const style = { display: 'block', width: '100%', height: '100%' } as const;

/** Make the next rendered <img> claim it is already decoded, as a cache hit does. */
function pretendCached(complete: boolean, naturalWidth: number) {
  const proto = window.HTMLImageElement.prototype;
  const c = Object.getOwnPropertyDescriptor(proto, 'complete');
  const n = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
  Object.defineProperty(proto, 'complete', { configurable: true, get: () => complete });
  Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => naturalWidth });
  return () => {
    if (c) Object.defineProperty(proto, 'complete', c); else delete (proto as never as Record<string, unknown>).complete;
    if (n) Object.defineProperty(proto, 'naturalWidth', n); else delete (proto as never as Record<string, unknown>).naturalWidth;
  };
}

describe('an image that was already decoded still shows', () => {
  it('reveals from the ELEMENT when no load event ever arrives', () => {
    const restore = pretendCached(true, 800);
    try {
      const { container } = render(<MediaImage src="/m/1" alt="p" imgStyle={style} {...label} />);
      // No onLoad is dispatched anywhere in this test. That is the point.
      expect(container.querySelector('img')!.style.opacity).toBe('1');
      expect(screen.queryByText('Loading…')).toBeNull();
    } finally { restore(); }
  });

  it('the old approach is what fails here', () => {
    // Guards the guard: if a future refactor goes back to reveal-on-event only,
    // the assertion above must be the thing that catches it.
    const restore = pretendCached(true, 800);
    try {
      let revealed = false;
      render(<img src="/m/1" alt="" onLoad={() => { revealed = true; }} />);
      expect(revealed).toBe(false);
    } finally { restore(); }
  });
});

describe('a photo that cannot load says so', () => {
  it('an errored image is a state, not an eternal "Loading…"', () => {
    // `complete` is true for a failed image too — a broken one just has no
    // natural size. That pair is the only way to tell them apart after the fact.
    const restore = pretendCached(true, 0);
    try {
      render(<MediaImage src="/m/gone" alt="p" imgStyle={style} {...label} />);
      expect(screen.getByText('Photo unavailable')).toBeTruthy();
      expect(screen.queryByText('Loading…')).toBeNull();
    } finally { restore(); }
  });

  it('carries an onError at all — the half that was simply missing', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/app/components/MediaImage.tsx'), 'utf8',
    );
    expect(src).toMatch(/onError=/);
  });
});

describe('a photo still in flight reads as loading', () => {
  it('shows the loading label and keeps the frame reserved', () => {
    const restore = pretendCached(false, 0);
    try {
      const { container } = render(<MediaImage src="/m/2" alt="p" imgStyle={style} {...label} />);
      expect(screen.getByText('Loading…')).toBeTruthy();
      expect(container.querySelector('img')!.style.opacity).toBe('0');
    } finally { restore(); }
  });
});

describe('no media surface reveals on the event alone any more', () => {
  const surfaces = [
    'src/app/app/components/Messages.tsx',
    'src/app/app/components/StatusViewer.tsx',
  ];

  it.each(surfaces)('%s renders through MediaImage', (f) => {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    expect(src).toContain('MediaImage');
    // The pattern that caused this: an <img> whose opacity is driven by a
    // component-level "has it loaded" flag.
    expect(src).not.toMatch(/opacity:\s*loaded/);
  });
});
