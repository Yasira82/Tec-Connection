'use client';

// Status — the full-screen viewer.
//
// One author's live statuses, in order, with the segmented bar at the top that
// says how many there are and where you are. Tap the right half to advance, the
// left half to go back, the ✕ to leave.
//
// Deliberately NOT auto-advancing on a timer. A timer looks right in a demo and
// is wrong on a phone: it takes a caption away mid-sentence, it fights a slow
// photo, and it gives someone reading a second language no way to keep up. The
// progress bar shows position, not a countdown.
import { useCallback, useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { storyMediaUrl, type StoryAuthor } from '@/lib-client/connection/useStories';

const relative = (iso: string, a: Record<string, string>) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return a.justNow ?? '';
  if (mins < 60) return (a.minutesAgo ?? '{n}m').replace('{n}', String(mins));
  return (a.hoursAgo ?? '{n}h').replace('{n}', String(Math.floor(mins / 60)));
};

export function StatusViewer({ group, isMine, onSeen, onDelete, onClose }: {
  group: StoryAuthor;
  isMine: boolean;
  onSeen: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  // Open on the first unseen one — going back through what you already read to
  // reach the new thing is the whole reason people abandon a status feed.
  const firstUnseen = group.stories.findIndex((s) => !s.seen);
  const [i, setI] = useState(firstUnseen >= 0 ? firstUnseen : 0);
  const [armedDelete, setArmedDelete] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const current = group.stories[i];

  const next = useCallback(() => {
    setArmedDelete(false); setLoaded(false);
    setI((n) => {
      if (n + 1 >= group.stories.length) { onClose(); return n; }
      return n + 1;
    });
  }, [group.stories.length, onClose]);

  const prev = useCallback(() => {
    setArmedDelete(false); setLoaded(false);
    setI((n) => Math.max(0, n - 1));
  }, []);

  // Marking seen on DISPLAY, not on close: a status you looked at and left is a
  // status you saw, and waiting until close would lose it if the app is killed.
  useEffect(() => { if (current && !current.seen) onSeen(current.id); }, [current, onSeen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [next, prev, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={group.author}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        // OPAQUE, not a scrim. At 98% the gold chat list behind still read
        // through clearly, and a status is meant to be the only thing on the
        // screen — a half-visible page underneath makes it look like a bug.
        background: TEC_COLORS.bg,
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* segmented progress — one bar per status, filled up to where you are */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 6px' }}>
        {group.stories.map((s, n) => (
          <span key={s.id} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: n <= i ? TEC_COLORS.gold : `${TEC_COLORS.border}`,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 10px' }}>
        <span style={{
          width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
          color: '#0a0800', fontSize: 13, fontWeight: 800,
        }}>{(group.author || '?').charAt(0).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: TEC_COLORS.text }}>
            <bdi>@{group.author}</bdi>
          </span>
          <span style={{ fontSize: 11, color: TEC_COLORS.subtext }}>
            <bdi>{relative(current.at, a)}</bdi>
            {/* Your own view count, and nobody else's. */}
            {isMine && typeof current.views === 'number' && (
              <> · <bdi>{current.views} {a.statusViews}</bdi></>
            )}
          </span>
        </span>
        <button
          onClick={onClose} aria-label={a.closeLabel}
          style={{
            width: 34, height: 34, borderRadius: 999, flexShrink: 0,
            background: 'rgba(255,255,255,0.10)', border: `1px solid ${TEC_COLORS.border}`,
            color: TEC_COLORS.text, fontSize: 15, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >✕</button>
      </div>

      {/* the status itself */}
      <div style={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', padding: '0 12px', minHeight: 0 }}>
        {current.hasMedia ? (
          <>
            {!loaded && (
              <span style={{ position: 'absolute', color: TEC_COLORS.subtext, fontSize: 12 }}>{a.loading}</span>
            )}
            <img
              src={storyMediaUrl(current.id)} alt={current.caption || a.photo}
              onLoad={() => setLoaded(true)}
              style={{
                maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s',
              }}
            />
          </>
        ) : (
          // Text-only: the words ARE the status, so they get the whole screen.
          <p style={{
            margin: 0, fontSize: 22, lineHeight: 1.5, fontWeight: 600,
            color: TEC_COLORS.text, textAlign: 'center', wordBreak: 'break-word',
          }} dir="auto">{current.caption}</p>
        )}

        {/* Tap targets, invisible and over the top: the right half advances,
            the left half goes back. They sit ABOVE the photo, which is why the
            photo is not itself clickable. */}
        <button
          onClick={prev} aria-label={a.statusPrevious}
          style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }}
        />
        <button
          onClick={next} aria-label={a.statusNext}
          style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: '65%', background: 'none', border: 'none', cursor: 'pointer' }}
        />
      </div>

      {/* A caption UNDER a photo. On a text-only status it is already the body
          above, so it is not repeated. */}
      {current.hasMedia && current.caption && (
        <p style={{
          margin: 0, padding: '12px 16px', fontSize: 14.5, lineHeight: 1.5,
          color: TEC_COLORS.text, textAlign: 'center', wordBreak: 'break-word',
        }} dir="auto">{current.caption}</p>
      )}

      {isMine && (
        <div style={{ padding: '6px 16px 14px', textAlign: 'center' }}>
          <button
            onClick={async () => {
              if (!armedDelete) { setArmedDelete(true); return; }
              if (await onDelete(current.id)) onClose();
            }}
            style={{
              background: armedDelete ? `${TEC_COLORS.error}1F` : 'none',
              border: `1px solid ${armedDelete ? TEC_COLORS.error : TEC_COLORS.border}`,
              color: TEC_COLORS.error, borderRadius: 999, padding: '8px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >{armedDelete ? a.confirmDelete : a.statusDelete}</button>
        </div>
      )}
    </div>
  );
}
