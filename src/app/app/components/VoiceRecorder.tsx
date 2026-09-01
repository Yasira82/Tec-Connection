'use client';

// Voice notes, via MediaRecorder.
//
// ── The honest caveat, stated where the code is ──────────────────────────────
// Pi Browser is a webview, and a webview may not grant microphone access at all.
// This has NOT been verified there. So the button is not drawn unless the APIs
// exist, and a refused permission produces a sentence rather than a dead
// control: the failure mode for the whole audience, if it fails, is "no mic
// button" — not "a button that does nothing".
//
// The mime type is whatever the browser will actually produce. Chromium (and so
// Pi Browser on Android) gives `audio/webm;codecs=opus`; Safari gives
// `audio/mp4`. Both are accepted server-side, so nothing has to transcode — and
// transcoding audio in a phone webview is not something to attempt.
import { useEffect, useRef, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

const CANDIDATE_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** Longest recording accepted server-side. Past this it is a recording, not a message. */
const MAX_MS = 5 * 60 * 1000;

export function VoiceRecorder({ busy, onRecorded, onUnavailable }: {
  busy: boolean;
  onRecorded: (blob: Blob, durationMs: number) => void;
  /**
   * Reported UPWARD so the composer can show it on its own line. Rendering the
   * message inside the button row squeezed the text input down to nothing —
   * a broken control and a broken layout at the same time.
   */
  onUnavailable?: (reason: 'denied' | 'unsupported') => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [denied, setDenied] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature-detect on the client only — `MediaRecorder` does not exist during
  // the server render, and assuming it does would fail hydration.
  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && typeof window.MediaRecorder !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia;
    setSupported(ok);
    if (!ok) onUnavailable?.('unsupported');
  }, [onUnavailable]);

  const cleanup = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    recRef.current?.stream.getTracks().forEach((tr) => tr.stop());
    recRef.current = null;
    setRecording(false);
    setElapsed(0);
  };

  // Releasing the microphone when the thread closes mid-recording is not
  // optional: a live track leaves the phone's recording indicator on.
  useEffect(() => cleanup, []);

  const start = async () => {
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = CANDIDATE_TYPES.find((t2) => MediaRecorder.isTypeSupported?.(t2));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const ms = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        cleanup();
        if (blob.size > 0 && ms > 300) onRecorded(blob, ms);   // ignore a stray tap
      };
      recRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      tickRef.current = setInterval(() => {
        const ms = Date.now() - startedRef.current;
        setElapsed(ms);
        if (ms >= MAX_MS) rec.stop();   // the server would refuse it anyway
      }, 250);
    } catch {
      // Denied, or no device. The button is REMOVED rather than left sitting
      // there to be pressed again: a permission a webview refuses once will
      // refuse every time, and a control that cannot work should not remain on
      // screen inviting the attempt.
      setDenied(true);
      onUnavailable?.('denied');
      cleanup();
    }
  };

  // No control at all rather than one that cannot work. The explanation is the
  // composer's to render, on its own line.
  if (!supported || denied) return null;

  if (recording) {
    return (
      <button
        onClick={() => recRef.current?.stop()} aria-label={a.stopRecording}
        style={{
          height: 38, borderRadius: 999, flexShrink: 0, padding: '0 12px',
          background: `${TEC_COLORS.error}22`, border: `1px solid ${TEC_COLORS.error}66`,
          color: TEC_COLORS.error, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 2, background: TEC_COLORS.error }} />
        <bdi>{Math.floor(elapsed / 60000)}:{String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}</bdi>
      </button>
    );
  }

  return (
    <button
      onClick={() => { void start(); }} disabled={busy} aria-label={a.recordVoice}
      style={{
        width: 38, height: 38, borderRadius: 999, flexShrink: 0,
        background: 'none', border: `1px solid ${TEC_COLORS.border}`,
        color: TEC_COLORS.subtext, fontSize: 16, cursor: busy ? 'not-allowed' : 'pointer',
        display: 'grid', placeItems: 'center',
      }}
    >🎤</button>
  );
}
