'use client';

// Full-screen photo viewer.
//
// Tapping a photo used to open its URL in a new tab, handing the browser's own
// image viewer a 4000px file: it renders at actual size, so what arrives is a
// corner of the picture at enormous magnification with no way to fit it. That is
// not a viewer, it is a raw file.
//
// This shows the whole photo, scaled to the screen, and closes on a tap. Nothing
// more — pinch-zoom is the browser's job and it works correctly once the image
// starts out fitted.
import { useEffect } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useTranslation();
  // Escape closes it on a desktop; on a phone the whole backdrop is the target.
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

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,5,12,0.96)',
        display: 'grid', placeItems: 'center',
        padding: 'env(safe-area-inset-top) 12px env(safe-area-inset-bottom)',
      }}
    >
      <img
        src={src}
        alt={alt}
        // `contain` is the whole point: the entire photo, inside the screen,
        // whatever its aspect ratio.
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
      <button
        onClick={onClose}
        // A screen reader announces the LABEL, and "✕" is not a word in any of
        // the twelve languages.
        aria-label={t.app.closeLabel}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', insetInlineEnd: 14,
          width: 38, height: 38, borderRadius: 999,
          background: 'rgba(255,255,255,0.10)', border: `1px solid ${TEC_COLORS.border}`,
          color: TEC_COLORS.text, fontSize: 17, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}
      >✕</button>
    </div>
  );
}
