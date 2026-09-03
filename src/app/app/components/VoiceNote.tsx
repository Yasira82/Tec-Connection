'use client';

// A voice note, drawn in the app's own language.
//
// `<audio controls>` renders the BROWSER's control strip: a light grey bar with
// its own typeface and its own idea of layout, sitting inside a dark gold-tinted
// bubble. It also differs on every platform, so the same conversation does not
// look like the same app twice.
//
// This is the same element with `controls` off, driven by a play button and a
// progress bar that use the platform's colours. `preload="none"` is kept: a
// transcript with ten voice notes must not fetch ten audio files to render.
import { useEffect, useRef, useState } from 'react';
import { C } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';

const mmss = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function VoiceNote({ src, durationMs, mine }: { src: string; durationMs?: number | null; mine: boolean }) {
  const { t } = useTranslation();
  const a = t.app;
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  // The recorded length is known from the message itself, so a duration shows
  // before a single byte of audio is fetched.
  const [total, setTotal] = useState(durationMs ? durationMs / 1000 : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setAt(el.currentTime);
    const onEnd = () => { setPlaying(false); setAt(0); };
    const onMeta = () => { if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('pause', () => setPlaying(false));
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      // A refused play() (autoplay policy, a missing file) must not leave the
      // button showing "pause" over silence.
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const pct = total > 0 ? Math.min(100, (at / total) * 100) : 0;
  const accent = mine ? C.gold : C.subtext;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 190, padding: '2px 0' }}>
      <audio ref={ref} src={src} preload="none" />
      <button
        onClick={toggle} aria-label={playing ? a.pauseVoice : a.playVoice}
        style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
          background: `${accent}22`, border: `1px solid ${accent}66`, color: accent,
          fontSize: 13, display: 'grid', placeItems: 'center',
        }}
      >
        <span aria-hidden dir="ltr">{playing ? '❚❚' : '▶'}</span>
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', height: 4, borderRadius: 999,
          background: C.border, overflow: 'hidden',
        }}>
          <span style={{
            display: 'block', height: '100%', width: `${pct}%`,
            background: accent, transition: 'width 0.15s linear',
          }} />
        </span>
        <span style={{ display: 'block', fontSize: 10.5, color: C.subtext, marginTop: 4 }}>
          {/* Digits and a colon are bidi-neutral: in an RTL paragraph the pair
              would otherwise swap and read as the remaining time first. */}
          <bdi>{a.voiceNote} · {mmss(playing || at > 0 ? at : total)}</bdi>
        </span>
      </span>
    </div>
  );
}
