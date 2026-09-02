'use client';

// An image that reveals itself when it is actually there — and says so when it
// is not.
//
// Both media surfaces used to hold the picture at `opacity: 0` until their own
// `onLoad` fired. Two ways that leaves a permanently blank frame under a
// "Loading…" label:
//
//   · The image was ALREADY decoded. A photo served from cache — reopening a
//     chat, scrolling back, a second render of the same message — can finish
//     before React attaches the listener, so the load event fired when nothing
//     was listening and never comes again. The bytes are in the element; the
//     element is transparent. Tapping it opened the viewer, which requested the
//     same URL and showed it instantly, because it had been there all along.
//   · The image FAILED. There was no `onError` at all, so a 404 or a dropped
//     connection also read as "Loading…", forever.
//
// So the state is read from the ELEMENT (`complete` + `naturalWidth`) as well as
// from the events, and a failure is a state of its own rather than an absence.
import { useEffect, useRef, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';

type State = 'loading' | 'ready' | 'failed';

export function MediaImage({
  src, alt, imgStyle, loading = 'lazy', loadingLabel, failedLabel, onReady,
}: {
  src: string;
  alt: string;
  imgStyle: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  loadingLabel: string;
  failedLabel: string;
  /** For a parent that positions or measures once the picture is up. */
  onReady?: () => void;
}) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState<State>('loading');

  // Runs on mount AND on every `src` change, which is what makes this correct
  // for a viewer that steps between photos: the next one may also be cached.
  //
  // `complete` alone is not enough — it is true for a FAILED image too, and a
  // broken image has no natural size. That pair is the only reliable way to ask
  // an element what happened before we were listening.
  useEffect(() => {
    const el = ref.current;
    if (el?.complete) {
      setState(el.naturalWidth > 0 ? 'ready' : 'failed');
      return;
    }
    setState('loading');
  }, [src]);

  useEffect(() => { if (state === 'ready') onReady?.(); }, [state, onReady]);

  return (
    <>
      {state !== 'ready' && (
        <span style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: TEC_COLORS.subtext, fontSize: 11, textAlign: 'center', padding: 8,
        }}>{state === 'failed' ? failedLabel : loadingLabel}</span>
      )}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={(e) => setState(e.currentTarget.naturalWidth > 0 ? 'ready' : 'failed')}
        onError={() => setState('failed')}
        style={{ ...imgStyle, opacity: state === 'ready' ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </>
  );
}
