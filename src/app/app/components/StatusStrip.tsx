'use client';

// Status — the ring row.
//
// A horizontal strip of the people whose statuses are live, yours first. A gold
// ring means there is something you have not seen; a dim one means you have.
// That is the entire signal, and it is the one people already read without
// being told.
//
// It sits above the chat list rather than in a tab of its own: a status is worth
// a glance on the way to a conversation, not a destination.
import { useRef, useState } from 'react';
import { C } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useStories, type StoryAuthor, type StoryItem } from '@/lib-client/connection/useStories';
import { Avatar as PersonAvatar } from '@/components/public/Avatar';
import { downscaleImage } from '@/lib-client/connection/downscaleImage';
import { StatusViewer } from './StatusViewer';
import { VISUALLY_HIDDEN } from '@/lib-client/visuallyHidden';
import { useMyName } from '@/lib-client/connection/useMyName';

function Ring({ name, unseen, onClick, label, caption }: {
  /** The HANDLE. It keys the photo, so it must never be a chosen name. */
  name: string;
  unseen: boolean; onClick: () => void; label: string;
  /** What to print under the ring. Defaults to the handle. */
  caption?: string;
}) {
  return (
    <button
      onClick={onClick} aria-label={label}
      style={{
        display: 'grid', gap: 5, justifyItems: 'center', width: 66, flexShrink: 0,
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      <span style={{
        width: 58, height: 58, borderRadius: 999, display: 'grid', placeItems: 'center',
        // The ring is a border on a wrapper, not on the avatar, so the gap
        // between them reads as a ring rather than a thick edge.
        padding: 3,
        border: `2px solid ${unseen ? C.gold : C.border}`,
      }}>
        {/* The real photo when there is one — the ring is a person, and a wall
            of initials beside a photo in Settings is what made the upload look
            like it had not worked. */}
        <PersonAvatar username={(name || '?').replace(/^@/, '')} size={52} tryPhoto />
      </span>
      <span style={{
        fontSize: 10.5, color: unseen ? C.text : C.subtext,
        maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}><bdi dir="auto">{caption ?? name}</bdi></span>
    </button>
  );
}

export function StatusStrip({ me, onReply }: {
  me: string;
  /** Reply to a status → a direct message to its author. Owned by the page,
      which owns conversations; the strip only finds statuses. */
  onReply?: (author: string, text: string, story: StoryItem) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const { authors, mine, loading, busy, error, post, markSeen, remove } = useStories(me);
  const myName = useMyName();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [viewing, setViewing] = useState<StoryAuthor | null>(null);
  const [composing, setComposing] = useState(false);
  const [caption, setCaption] = useState('');
  const meNorm = (me ?? '').trim().replace(/^@+/, '').toLowerCase();

  const others = authors.filter((x) => x.author !== meNorm);

  // Nothing live and nothing loading: one "add" control, no empty strip of
  // placeholders pretending there is something to look at.
  const pickPhoto = () => fileRef.current?.click();

  const onFile = (f: File) => {
    // Shrink first, exactly as a chat photo is: a 4MB camera file crossing a
    // serverless function on a phone connection is the difference between a
    // status posting and a status timing out.
    void downscaleImage(f)
      .then((blob) => post(caption, blob))
      .then((ok) => { if (ok) { setCaption(''); setComposing(false); } });
  };

  if (loading && authors.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <input
        ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={VISUALLY_HIDDEN} tabIndex={-1} aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';   // so picking the same file twice still fires
          if (f) onFile(f);
        }}
      />

      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
        // The strip scrolls; the page must not scroll sideways with it.
        scrollbarWidth: 'none',
      }}>
        {/* Yours: opens what you posted, or the composer when you have none. */}
        <Ring
          name={mine && mine.stories.length ? me : a.myStatus}
          // The caption is the only half that becomes a chosen name: `name`
          // still keys the photo, and a photo is stored against a handle.
          caption={mine && mine.stories.length ? (myName || me) : a.myStatus}
          unseen={!!mine && !mine.seen}
          label={mine && mine.stories.length ? a.myStatus : a.addStatus}
          onClick={() => (mine && mine.stories.length ? setViewing(mine) : setComposing(true))}
        />
        {others.map((x) => (
          <Ring
            key={x.author} name={x.author} unseen={!x.seen}
            label={x.author} onClick={() => setViewing(x)}
          />
        ))}
        {/* An explicit add, always reachable — even while your own ring is
            showing what you already posted. */}
        <button
          onClick={() => setComposing(true)} aria-label={a.addStatus}
          style={{
            width: 58, height: 58, borderRadius: 999, flexShrink: 0, alignSelf: 'start',
            background: 'none', border: `1px dashed ${C.border}`,
            color: C.gold, fontSize: 22, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >+</button>
      </div>

      {composing && (
        <div style={{
          marginTop: 8, padding: 12, borderRadius: 14,
          border: `1px solid ${C.border}`, background: C.surface,
          display: 'grid', gap: 8,
        }}>
          <p style={{ margin: 0, fontSize: 11.5, color: C.subtext, lineHeight: 1.5 }}>
            {a.statusHint}
          </p>
          <input
            autoFocus value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder={a.statusPlaceholder} maxLength={300} dir="auto"
            style={{
              background: C.bg, color: C.text, fontSize: 14,
              border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={pickPhoto} disabled={busy}
              style={{
                background: 'none', border: `1px solid ${C.border}`, color: C.text,
                borderRadius: 999, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
              }}
            >📷 {a.statusPhoto}</button>
            <button
              onClick={() => { void post(caption).then((ok) => { if (ok) { setCaption(''); setComposing(false); } }); }}
              disabled={busy || !caption.trim()}
              style={{
                background: caption.trim()
                  ? C.gold
                  : C.surface2,
                color: caption.trim() ? C.onGold : C.subtext,
                border: 'none', borderRadius: 999, padding: '8px 18px',
                fontSize: 13, fontWeight: 700, cursor: caption.trim() ? 'pointer' : 'not-allowed',
              }}
            >{a.statusPost}</button>
            <button
              onClick={() => { setComposing(false); setCaption(''); }}
              style={{
                background: 'none', border: 'none', color: C.subtext,
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
              }}
            >{a.cancel}</button>
          </div>
          {error === 'toobig' && <p style={{ color: C.error, fontSize: 12, margin: 0 }}>{a.attachTooBig}</p>}
          {error === 'failed' && <p style={{ color: C.error, fontSize: 12, margin: 0 }}>{a.statusFailed}</p>}
        </div>
      )}

      {viewing && (
        <StatusViewer
          group={viewing} isMine={viewing.author === meNorm}
          onSeen={markSeen} onDelete={remove}
          onReply={onReply ? (text, story) => onReply(viewing.author, text, story) : undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
