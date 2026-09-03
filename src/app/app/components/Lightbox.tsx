'use client';

// Full-screen photo viewer, with zoom.
//
// Tapping a photo used to open its URL in a new tab, handing the browser's own
// image viewer a 4000px file: it renders at actual size, so what arrives is a
// corner of the picture at enormous magnification with no way to fit it. This
// shows the whole photo, scaled to the screen.
//
// ── Why the zoom is written by hand ─────────────────────────────────────────
// The app's viewport is `maximum-scale=1` (src/app/layout.tsx), which is right
// for a chat — a stray pinch must not leave someone stranded at 3× on a
// composer they can no longer see. But it also means the browser will not zoom
// a photo either, so pinching here did nothing at all.
//
// Rather than unpick the app-wide rule for one screen, the gestures live in
// this component: two fingers scale, one finger pans while zoomed, double-tap
// toggles. Nothing else on the page is affected, and closing the viewer returns
// the page at exactly the scale it had.
import { useCallback, useEffect, useRef, useState } from 'react';
import { C, bgA, inkA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';

const MIN = 1;
const MAX = 4;
/** What a double-tap jumps to. Enough to read text in a photo, not so much that you are lost. */
const DOUBLE_TAP = 2.5;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const distance = (t: TouchList) => {
  const [a, b] = [t[0], t[1]];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useTranslation();
  // The phone's Back closes the viewer instead of leaving the app.
  useBackButton(true, onClose);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Gesture state lives in refs: it changes on every touchmove, and re-rendering
  // per frame to store it would make the drag stutter on a phone.
  const pinchStart = useRef(0);
  const scaleStart = useRef(1);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while a full-screen overlay is up —
    // otherwise dismissing it returns you somewhere you did not leave.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = distance(e.touches as unknown as TouchList);
      scaleStart.current = scale;
      panStart.current = null;
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (scale > MIN && touch) {
        panStart.current = { x: touch.clientX, y: touch.clientY, tx, ty };
      }
      // Double-tap: two taps inside 300ms. Zoomed in, it zooms back out — so
      // there is always a way back without hunting for a control.
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (scale > MIN) reset(); else setScale(DOUBLE_TAP);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current > 0) {
      const next = clamp(scaleStart.current * (distance(e.touches as unknown as TouchList) / pinchStart.current), MIN, MAX);
      setScale(next);
      // Zooming back to 1 re-centres, so the photo can never be left fitted but
      // pushed half off the screen.
      if (next === MIN) { setTx(0); setTy(0); }
      return;
    }
    const touch = e.touches[0];
    if (e.touches.length === 1 && panStart.current && touch) {
      setTx(panStart.current.tx + (touch.clientX - panStart.current.x));
      setTy(panStart.current.ty + (touch.clientY - panStart.current.y));
    }
  };

  const onTouchEnd = () => { pinchStart.current = 0; panStart.current = null; };

  return (
    <div
      // Tapping the backdrop closes — but ONLY at 1×. While zoomed, a tap is
      // part of looking at the photo, and closing on it would make the viewer
      // impossible to use with one hand.
      onClick={() => { if (scale === MIN) onClose(); }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: bgA(0.96),
        display: 'grid', placeItems: 'center', overflow: 'hidden',
        padding: 'env(safe-area-inset-top) 12px env(safe-area-inset-bottom)',
        // The browser must not claim the gesture before this component sees it.
        touchAction: 'none',
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        // `contain` is the starting point: the entire photo, inside the screen,
        // whatever its aspect ratio. The transform builds on top of that.
        style={{
          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block',
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: 'center',
          // Smooth on a double-tap; instant while a finger is on the glass,
          // where a transition reads as lag.
          transition: panStart.current || pinchStart.current ? 'none' : 'transform 0.18s ease-out',
          willChange: 'transform',
        }}
      />

      {/* A visible way back, for anyone whose double-tap does not land and on a
          desktop where there is no pinch at all. */}
      {scale > MIN && (
        <button
          onClick={(e) => { e.stopPropagation(); reset(); }}
          style={{
            position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 18px)',
            insetInlineStart: '50%', transform: 'translateX(-50%)',
            background: inkA(0.1), border: `1px solid ${C.border}`,
            color: C.text, borderRadius: 999, padding: '8px 18px',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}
        >{t.app.resetZoom}</button>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        // A screen reader announces the LABEL, and "✕" is not a word in any of
        // the twelve languages.
        aria-label={t.app.closeLabel}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', insetInlineEnd: 14,
          width: 38, height: 38, borderRadius: 999,
          background: inkA(0.1), border: `1px solid ${C.border}`,
          color: C.text, fontSize: 17, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}
      >✕</button>
    </div>
  );
}
