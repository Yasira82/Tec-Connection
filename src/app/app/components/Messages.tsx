'use client';

// TEC Connection (C-107) — Messages, rebuilt as a chat surface rather than a card.
//
// The first version put the thread inside the same bordered card every other
// section uses, under a page header that already said "Messages · Your
// conversations". That reads as a form with text in it, not as a conversation.
// The shape people already know — WhatsApp, Telegram — is: a list of chats, and
// a chat that OWNS the screen (its own header, a scrolling transcript, a
// composer pinned to the bottom). That is what this is.
//
// Two things here are correctness, not decoration:
//
//   · `isMine` compares NORMALIZED usernames. The session hook returns the Pi
//     username as typed (`yas55eR82`); the service stores and returns it
//     lowercased. A `===` between them is always false, so every message you
//     sent was drawn as if a stranger had sent it — labelled with your own
//     handle instead of "You", on the wrong side of the screen.
//
//   · a group with one member says so. Sending into a group you are alone in
//     looks identical to sending into a real conversation, and the message
//     "not arriving" is the only symptom.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useThread, sendToConversation, type Summary, type Msg } from '@/lib-client/connection/useMessages';
import { VoiceRecorder } from './VoiceRecorder';
import { useBlocks } from '@/lib-client/connection/useBlocks';
import { useTyping } from '@/lib-client/connection/useTyping';
import { NewChat } from './NewChat';
import { Lightbox } from './Lightbox';
import { ChatInfoSheet } from './ChatInfoSheet';
import { MessageActions } from './MessageActions';
import { StatusStrip } from './StatusStrip';
import { ReportSheet } from './ReportSheet';
import { Avatar as PersonAvatar } from '@/components/public/Avatar';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import { VoiceNote } from './VoiceNote';
import { downscaleImage } from '@/lib-client/connection/downscaleImage';

/** The service normalizes every username; the session hook does not. */
const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

const input = {
  flex: 1, minWidth: 0, background: TEC_COLORS.bg, color: TEC_COLORS.text,
  border: `1px solid ${TEC_COLORS.border}`, borderRadius: 999, padding: '11px 16px', fontSize: 14,
  outline: 'none',
} as const;

const goldBtn = {
  background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
  color: '#0a0800', border: 'none', borderRadius: 999, padding: '11px 18px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

const quietBtn = {
  background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.subtext,
  borderRadius: 999, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/** Same-origin URL for an attachment. The session cookie is what makes it resolve. */
const mediaUrl = (conversationId: string, messageId: string) =>
  `/api/bff/connection/conversations/${encodeURIComponent(conversationId)}/media/${encodeURIComponent(messageId)}`;

/**
 * Has the other person read a message sent at `at`?
 *
 * Their read marker moves to "now" when they open the thread, so anything older
 * has been in front of them. It is the same data the unread badge counts — a
 * receipt is just the other side of it.
 */
const seenBy = (at: string, peerReadAt?: string | null): boolean => {
  if (!peerReadAt) return false;
  const sent = new Date(at).getTime();
  const read = new Date(peerReadAt).getTime();
  return Number.isFinite(sent) && Number.isFinite(read) && read >= sent;
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toDateString();
};

/**
 * A person in the chat surfaces.
 *
 * `group` keeps the old letter disc: a group has a title, not a face, and there
 * is no avatar route for one. A PERSON gets their real photo — messaging knows
 * only a handle, so it asks the avatar route and falls back to the initial when
 * that 404s. Without this a profile photo appeared in Settings and nowhere else.
 */
function Avatar({ name, size = 44, group = false, convId }: {
  name: string; size?: number; group?: boolean;
  /** A group's photo is keyed by the CONVERSATION, not by a handle. */
  convId?: string;
}) {
  // A group used to get a letter disc, always. The stated reason was that a
  // group has a title rather than a face — but the real one was that a group had
  // no photo to show and no way to set one, so every group read as a person
  // whose picture had failed to load. Now it has both, and the same component
  // renders it: same tinted disc underneath, same initial fallback, same clean
  // 404 when there is no photo.
  const src = group && convId ? `/api/bff/connection/conversations/${encodeURIComponent(convId)}/avatar` : undefined;
  return (
    <span style={{ flexShrink: 0, display: 'block' }}>
      <PersonAvatar
        username={(name || '?').replace(/^@/, '')}
        size={size}
        tryPhoto={!group || !!convId}
        photoSrc={src}
      />
    </span>
  );
}

// ── the open chat ───────────────────────────────────────────────────────────
function Chat({ id, me, onBack }: { id: string; me: string; onBack: () => void }) {
  const { t } = useTranslation();
  const a = t.app;
  const { thread, busy, error, send, sendMedia, deleteMessage, hide, clear, addMember, leave } = useThread(id);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const { isBlocked, block, unblock, busy: blockBusy, error: blockError } = useBlocks();
  // Which message has its Delete showing. One at a time — a delete button on
  // every bubble is a row of hazards down the side of the transcript.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  // Which photos have finished decoding. A tile with nothing in it reads as
  // broken; a tile with a shimmer reads as "coming".
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [micIssue, setMicIssue] = useState<'denied' | 'unsupported' | null>(null);
  const [reporting, setReporting] = useState<{ id: string; by: string } | null>(null);
  const { typing, ping } = useTyping(id, thread?.members ?? []);
  const endRef = useRef<HTMLDivElement | null>(null);
  const meNorm = norm(me);
  // An open chat is a layer even though it is not an overlay — Back belongs to
  // it before it belongs to the page.
  useBackButton(true, onBack);

  // `block: 'nearest'` scrolls the transcript, not the page — scrolling the page
  // would push the composer off screen every time a message arrived.
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [thread?.messages.length]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const okSent = await send(text);
    if (!okSent) setDraft(text);   // put the words back rather than losing them
  };

  const isGroup = thread?.kind === 'GROUP';
  const peerName = thread?.peer ?? '';
  const title = isGroup ? (thread?.title ?? '') : `@${peerName}`;
  // A blocked thread stays READABLE — a block ends contact, it does not delete
  // the history you already have.
  const peerBlocked = !isGroup && !!peerName && isBlocked(peerName);
  const alone = isGroup && (thread?.members.length ?? 0) <= 1;

  // Day separators are computed once per render of the transcript rather than
  // per message, so the comparison is with the PREVIOUS message, not with today.
  const rows = useMemo(() => {
    const out: { m: Msg; mine: boolean; newDay: boolean; showSender: boolean }[] = [];
    (thread?.messages ?? []).forEach((m, i) => {
      const prev = thread?.messages[i - 1];
      const mine = norm(m.by) === meNorm;
      out.push({
        m, mine,
        newDay: !prev || dayKey(prev.at) !== dayKey(m.at),
        // In a 1:1 the sender is never in doubt, so naming them is noise — the
        // side of the screen already says who wrote it.
        showSender: !!isGroup && !mine && (!prev || norm(prev.by) !== norm(m.by)),
      });
    });
    return out;
  }, [thread?.messages, meNorm, isGroup]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      // Matches the page wrapper's own padding (28px top, 96px bottom + safe
      // area). Guessing at this is what slid the composer under the nav bar.
      height: 'calc(100vh - 124px - env(safe-area-inset-bottom))',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px 14px',
        borderBottom: `1px solid ${TEC_COLORS.border}`,
      }}>
        <button onClick={onBack} aria-label={a.messages} style={{
          background: 'none', border: 'none', color: TEC_COLORS.gold, cursor: 'pointer',
          fontSize: 26, lineHeight: 1, padding: '0 4px',
        }}>›</button>
        <Avatar name={isGroup ? (thread?.title ?? 'G') : (thread?.peer ?? '?')} size={40} group={!!isGroup} convId={id} />
        <button
          onClick={() => setShowInfo(true)}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'start', cursor: 'pointer' }}
        >
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <bdi dir="auto">{title}</bdi>
          </span>
          <span style={{ fontSize: 11.5, color: typing.length ? TEC_COLORS.success : TEC_COLORS.subtext }}>
            {typing.length
              ? <bdi dir="auto">{isGroup ? `@${typing[0]} ${a.typingNow}` : a.typingNow}</bdi>
              : isGroup ? <bdi>{thread?.members.length} {a.membersLabel}</bdi> : a.directLabel}
          </span>
        </button>
        <button onClick={() => setShowInfo(true)} aria-label={isGroup ? a.groupInfo : a.contactInfo} style={{
          background: 'none', border: 'none', color: TEC_COLORS.subtext, cursor: 'pointer', fontSize: 20, padding: '0 4px',
        }}>⋯</button>
      </div>

      {/* a group of one is the reason a message "never arrives" */}
      {alone && (
        <div style={{
          margin: '12px 0 0', padding: '10px 14px', borderRadius: 12,
          background: `${TEC_COLORS.gold}14`, border: `1px solid ${TEC_COLORS.gold}44`,
          fontSize: 12.5, color: TEC_COLORS.text, lineHeight: 1.5,
        }}>{a.onlyYouInGroup}</div>
      )}

      {/* transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!thread ? (
          <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>{error === 'notfound' ? a.threadUnavailable : a.loading}</p>
        ) : rows.length === 0 ? (
          <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center', marginTop: 24 }}>{a.noMessagesYet}</p>
        ) : rows.map(({ m, mine, newDay, showSender }) => (
          <div key={m.id}>
            {newDay && (
              <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
                <span style={{
                  fontSize: 11, color: TEC_COLORS.subtext, background: TEC_COLORS.surface,
                  border: `1px solid ${TEC_COLORS.border}`, borderRadius: 999, padding: '3px 12px',
                }}>{dayLabel(m.at, a)}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: showSender ? 8 : 2 }}>
              {/* The affordance sits OUTSIDE the bubble, and now on EVERY row:
                  removing a message from your own copy applies to one you did
                  not send, so restricting it to your own would have hidden
                  half of what it is for. It opens a sheet rather than firing —
                  "delete" has two meanings here and the tap has to say which. */}
              <button
                onClick={() => setMenuFor(m.id)} aria-label={a.deleteMessage}
                style={{
                  // Gold, at full strength. It was `subtext` at 45% opacity —
                  // three dots the same colour as the background, which is why
                  // nobody could find the way to delete a message. Every other
                  // tappable mark in this app is the amber.
                  background: 'none', border: 'none', color: TEC_COLORS.gold,
                  fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 4px',
                  flexShrink: 0,
                  // Always on the side AWAY from the edge the bubble hugs, so
                  // it never sits between the message and the screen edge.
                  order: mine ? 0 : 2,
                }}
              >⋯</button>
              <div style={{
                maxWidth: '78%', padding: '8px 12px 6px',
                background: mine ? `${TEC_COLORS.gold}1F` : TEC_COLORS.surface2,
                border: `1px solid ${mine ? `${TEC_COLORS.gold}44` : TEC_COLORS.border}`,
                borderRadius: 16,
                // The squared corner marks the speaker, the way a tail does.
                borderEndEndRadius: mine ? 5 : 16,
                borderEndStartRadius: mine ? 16 : 5,
              }}>
                {showSender && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: TEC_COLORS.gold, marginBottom: 3 }}>
                    <bdi>@{m.by}</bdi>
                  </div>
                )}
                {m.deleted ? (
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: TEC_COLORS.subtext, fontStyle: 'italic' }}>
                    {a.messageDeleted}
                  </div>
                ) : (<>
                {m.media?.type === 'image' && (
                  // Opens the in-app viewer, NOT the URL. A new tab hands the
                  // browser's own viewer a full-size file, which it renders at
                  // actual pixels — a corner of the photo, hugely magnified.
                  <button
                    onClick={() => setViewing(mediaUrl(id, m.id))}
                    aria-label={a.photo}
                    style={{
                      display: 'block', padding: 0, border: 'none', background: 'none',
                      cursor: 'pointer', marginBottom: m.body ? 6 : 0,
                      // The box is reserved BEFORE the bytes arrive, so the
                      // transcript does not jump as each photo lands.
                      width: 240, maxWidth: '100%', height: 180,
                      borderRadius: 10, overflow: 'hidden', position: 'relative',
                      backgroundColor: TEC_COLORS.surface2,
                    }}
                  >
                    {!loaded.has(m.id) && (
                      <span style={{
                        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                        color: TEC_COLORS.subtext, fontSize: 11,
                      }}>{a.loading}</span>
                    )}
                    <img
                      src={mediaUrl(id, m.id)} alt={a.photo} loading="lazy" decoding="async"
                      onLoad={() => setLoaded((sset) => new Set(sset).add(m.id))}
                      style={{
                        display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                        opacity: loaded.has(m.id) ? 1 : 0, transition: 'opacity 0.2s',
                      }}
                    />
                  </button>
                )}
                {m.media?.type === 'audio' && (
                  <div style={{ marginBottom: m.body ? 6 : 0 }}>
                    <VoiceNote src={mediaUrl(id, m.id)} durationMs={m.media.durationMs} mine={mine} />
                  </div>
                )}
                {/* Written by another person: it lays out by its own script. */}
                {m.body && (
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, color: TEC_COLORS.text, wordBreak: 'break-word' }}>
                    <bdi dir="auto">{m.body}</bdi>
                  </div>
                )}
                </>)}
                <div style={{ fontSize: 10, color: TEC_COLORS.subtext, textAlign: 'end', marginTop: 2, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {/* "12:52 AM" is mostly bidi-neutral, so an RTL paragraph moves
                      the meridiem to the front: "AM 12:52". */}
                  <bdi>{clock(m.at)}</bdi>
                  {/* Ticks on YOUR OWN messages in a DIRECT thread only. In a
                      group "read" is per member and one tick cannot say "three
                      of five", so nothing is claimed there. */}
                  {mine && !m.deleted && !isGroup && (
                    <span
                      title={seenBy(m.at, thread?.peerReadAt) ? a.seen : a.delivered}
                      style={{ color: seenBy(m.at, thread?.peerReadAt) ? TEC_COLORS.success : TEC_COLORS.subtext }}
                    >{seenBy(m.at, thread?.peerReadAt) ? '✓✓' : '✓'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error === 'refused' && <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: '0 0 6px' }}>{a.messageRefused}</p>}
      {error === 'failed' && <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: '0 0 6px' }}>{a.messageFailed}</p>}
      {error === 'toobig' && <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: '0 0 6px' }}>{a.attachTooBig}</p>}
      {error === 'attach' && <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: '0 0 6px' }}>{a.attachFailed}</p>}
      {micIssue === 'denied' && (
        <p style={{ color: TEC_COLORS.subtext, fontSize: 11.5, margin: '0 0 6px', lineHeight: 1.5 }}>{a.micBlockedHere}</p>
      )}

      {/* composer — replaced by the reason when the thread is blocked, rather
          than left in place to fail on send. */}
      {peerBlocked ? (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${TEC_COLORS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ flex: 1, fontSize: 12.5, color: TEC_COLORS.subtext, margin: 0, lineHeight: 1.5 }}>{a.blockedNotice}</p>
          <button style={quietBtn} disabled={blockBusy} onClick={() => { void unblock(peerName); }}>{a.unblock}</button>
        </div>
      ) : (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${TEC_COLORS.border}` }}>
        {/* `capture` is deliberately absent: without it Android offers BOTH the
            camera and the gallery, which is what people expect from a paperclip. */}
        <input
          ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';   // so picking the same file twice still fires
            if (!f) return;
            // Shrink first. A 4MB camera photo was being stored and streamed
            // back in full to fill a 240px tile — every reader paid for that,
            // on every load. Falls back to the original if it cannot.
            void downscaleImage(f)
              .then((blob) => sendMedia(blob, draft, undefined))
              .then((ok) => { if (ok) setDraft(''); });
          }}
        />
        <button
          onClick={() => fileRef.current?.click()} disabled={busy} aria-label={a.attachPhoto}
          style={{
            width: 38, height: 38, borderRadius: 999, flexShrink: 0,
            background: 'none', border: `1px solid ${TEC_COLORS.border}`,
            color: TEC_COLORS.subtext, fontSize: 17, cursor: busy ? 'not-allowed' : 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >📎</button>

        <VoiceRecorder
          busy={busy}
          onRecorded={(blob, ms) => { void sendMedia(blob, '', ms); }}
          onUnavailable={setMicIssue}
        />

        <input
          style={input} value={draft}
          onChange={(e) => { setDraft(e.target.value); ping(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={a.messagePlaceholder} maxLength={2000} dir="auto"
        />
        <button
          onClick={submit} disabled={busy || !draft.trim()} aria-label={a.send}
          style={{
            width: 44, height: 44, borderRadius: 999, flexShrink: 0, border: 'none',
            background: draft.trim() ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : TEC_COLORS.surface2,
            color: draft.trim() ? '#0a0800' : TEC_COLORS.subtext,
            fontSize: 18, cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center',
          }}
        >
          {/* A paper plane mirrors with the writing direction. */}
          <span style={{ transform: 'scaleX(1)', display: 'block' }} dir="ltr">➤</span>
        </button>
      </div>
      )}

      {viewing && <Lightbox src={viewing} alt={a.photo} onClose={() => setViewing(null)} />}

      {reporting && (
        <ReportSheet
          kind="message" target={reporting.id} author={reporting.by}
          onClose={() => setReporting(null)}
          // Offered right there, because a report is reviewed later and a block
          // takes effect now.
          onBlock={!isGroup && peerName ? () => { void block(peerName); } : undefined}
        />
      )}

      {menuFor && (() => {
        const target = rows.find((r) => r.m.id === menuFor);
        if (!target) return null;
        return (
          <MessageActions
            mine={target.mine} deleted={!!target.m.deleted}
            onDelete={(scope) => { void deleteMessage(menuFor, scope); }}
            onReport={() => setReporting({ id: target.m.id, by: target.m.by })}
            onClose={() => setMenuFor(null)}
          />
        );
      })()}

      {showInfo && thread && (
        <ChatInfoSheet
          isGroup={!!isGroup}
          convId={id}
          title={title}
          members={thread.members}
          role={thread.role}
          me={meNorm}
          peerName={peerName}
          onClose={() => setShowInfo(false)}
          onAddMember={(u) => { void addMember(u); }}
          onLeave={async () => { if (await leave()) onBack(); }}
          onClear={() => { void clear(); }}
          onDelete={async () => { if (await hide(true)) onBack(); }}
          blocked={peerBlocked}
          onBlock={() => { void block(peerName); }}
          onUnblock={() => { void unblock(peerName); }}
          blockBusy={blockBusy}
          blockError={!!blockError}
        />
      )}
    </div>
  );
}

function dayLabel(iso: string, a: Record<string, string>): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return a.today ?? '';
  if (d.toDateString() === yest.toDateString()) return a.yesterday ?? '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── the chat list ───────────────────────────────────────────────────────────
function Row({ c, onOpen, a }: { c: Summary; onOpen: () => void; a: Record<string, string> }) {
  const isGroup = c.kind === 'GROUP';
  const name = isGroup ? (c.title ?? '') : `@${c.peer ?? ''}`;
  return (
    <button onClick={onOpen} style={{
      width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 2px', background: 'none', border: 'none', cursor: 'pointer',
    }}>
      <Avatar name={isGroup ? (c.title ?? 'G') : (c.peer ?? '?')} group={isGroup} convId={c.id} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <bdi dir="auto">{name}</bdi>
          </span>
          {c.last && <span style={{ fontSize: 11, color: TEC_COLORS.subtext, flexShrink: 0 }}><bdi>{clock(c.last.at)}</bdi></span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: TEC_COLORS.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.last ? <bdi dir="auto">{c.last.body}</bdi>
                    : isGroup ? <bdi>{c.members} {a.membersLabel}</bdi> : a.directLabel}
          </span>
          {c.unread > 0 && (
            <span style={{
              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
              background: TEC_COLORS.gold, color: '#0a0800',
            }}>{c.unread}</span>
          )}
        </span>
      </span>
    </button>
  );
}

interface Props {
  me: string;
  conversations: Summary[];
  loading: boolean;
  openDirect: (username: string) => Promise<{ id: string } | { code: number }>;
  createGroup: (title: string, members?: string[]) => Promise<string | null>;
  /** The open thread, owned by the page so Discover can open one (and so the
      page knows to hide its header while a chat owns the screen). */
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

export function Messages({ me, conversations, loading, openDirect, createGroup, openId, setOpenId }: Props) {
  const { t } = useTranslation();
  const a = t.app;
  const [composing, setComposing] = useState<null | 'direct' | 'group'>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);

  // Picking a person is the ONLY path that closes the picker. A failure keeps it
  // open with the reason on screen — closing it on failure is what silently
  // discarded the typed name.
  const pick = async (username: string) => {
    setPickError(null);
    const res = await openDirect(username);
    if ('id' in res) { setComposing(null); setOpenId(res.id); return; }
    setPickError(a.openFailed.replace('{code}', String(res.code || '—')));
  };

  const startGroup = async () => {
    const v = groupTitle.trim();
    if (!v) return;
    const id = await createGroup(v);
    if (id) { setGroupTitle(''); setComposing(null); setOpenId(id); }
    else setPickError(a.openFailed.replace('{code}', '—'));
  };

  if (openId) return <Chat id={openId} me={me} onBack={() => setOpenId(null)} />;

  if (composing === 'direct') {
    return <NewChat onPick={pick} onCancel={() => { setComposing(null); setPickError(null); }} error={pickError} />;
  }


  return (
    <section>
      {/* Status sits ABOVE the chat list, not in a tab of its own: it is worth
          a glance on the way to a conversation, not a destination. */}
      <StatusStrip
        me={me}
        // A reply to a status is a DIRECT MESSAGE to its author, quoting what it
        // was a reply to. Statuses get no comment list of their own: that would
        // be a second, public place to talk, and this app moderates one.
        onReply={async (author, text, story) => {
          const res = await openDirect(author);
          if (!('id' in res)) return false;
          const quoted = story.caption
            ? `↪ ${story.caption.slice(0, 80)}${story.caption.length > 80 ? '…' : ''}\n${text}`
            : `↪ ${a.statusReplyToPhoto}\n${text}`;
          return sendToConversation(res.id, quoted);
        }}
      />
      {/* No section heading. The page header above already reads
          "Messages · Your conversations"; repeating it was the exact defect the
          previous IA pass removed from every other tab. */}
      {composing === 'group' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input
            autoFocus style={input} value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') startGroup(); }}
            placeholder={a.groupTitlePlaceholder} maxLength={120} dir="auto"
          />
          <button style={goldBtn} onClick={startGroup}>{a.createGroup}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button style={{ ...goldBtn, flex: 1 }} onClick={() => { setPickError(null); setComposing('direct'); }}>
            ✉ {a.newChat}
          </button>
          <button style={quietBtn} onClick={() => { setGroupTitle(''); setComposing('group'); }}>
            + {a.newGroup}
          </button>
        </div>
      )}

      {pickError && <p style={{ color: TEC_COLORS.error, fontSize: 12.5, margin: '0 0 6px' }}>{pickError}</p>}

      <div style={{ marginTop: 8 }}>
        {loading ? (
          <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>{a.loading}</p>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ color: TEC_COLORS.text, fontSize: 14, fontWeight: 600, margin: 0 }}>{a.noConversations}</p>
            <p style={{ color: TEC_COLORS.subtext, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{a.startConversation}</p>
          </div>
        ) : conversations.map((c, i) => (
          <div key={c.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
            <Row c={c} a={a} onOpen={() => setOpenId(c.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
