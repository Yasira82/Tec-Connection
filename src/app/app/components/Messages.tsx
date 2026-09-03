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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { C, goldA, inkA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useThread, sendToConversation, type Summary, type Msg } from '@/lib-client/connection/useMessages';
import { VoiceRecorder } from './VoiceRecorder';
import { useBlocks } from '@/lib-client/connection/useBlocks';
import { useTyping } from '@/lib-client/connection/useTyping';
import { NewChat } from './NewChat';
import { Lightbox } from './Lightbox';
import { MediaImage } from './MediaImage';
import { ChatInfoSheet } from './ChatInfoSheet';
import { GroupDiscovery } from './GroupDiscovery';
import { MessageActions } from './MessageActions';
import { ChatSearch } from './ChatSearch';
import { ForwardPicker } from './ForwardPicker';
import { StatusStrip } from './StatusStrip';
import { ReportSheet } from './ReportSheet';
import { Avatar as PersonAvatar } from '@/components/public/Avatar';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import { VoiceNote } from './VoiceNote';
import { downscaleImage } from '@/lib-client/connection/downscaleImage';
import { useLongPress } from '@/lib-client/connection/useLongPress';

/** The service normalizes every username; the session hook does not. */
const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

const input = {
  flex: 1, minWidth: 0, background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 999, padding: '11px 16px', fontSize: 14,
  outline: 'none',
} as const;

const goldBtn = {
  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
  color: C.onGold, border: 'none', borderRadius: 999, padding: '11px 18px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

const quietBtn = {
  background: 'none', border: `1px solid ${C.border}`, color: C.subtext,
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
 * How long a message stays editable — the SAME fifteen minutes the service
 * enforces.
 *
 * Duplicated deliberately, and it is the one duplication in this file worth
 * having: the alternative is offering Edit on every message and letting the
 * server refuse half of them, which is how a menu stops being trusted. If the
 * two ever disagree the server still wins, so the failure is a missing option,
 * never a message edited outside the window.
 */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const withinEditWindow = (at: string): boolean => {
  const t = new Date(at).getTime();
  return Number.isFinite(t) && Date.now() - t <= EDIT_WINDOW_MS;
};

/**
 * The same shape the service parses mentions with. Kept in step deliberately:
 * if this matched more than the service does, the screen would highlight a
 * handle nobody was ever notified about — a promise the backend never made.
 */
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_]{2,40})/g;

/**
 * A message body with the handles in it marked.
 *
 * Only handles the SERVER listed in `mentions` are marked. That list is already
 * filtered against the member list, so `@someone-not-here` stays plain text —
 * which is the honest rendering: nothing reached them.
 *
 * Everything stays inside one `<bdi dir="auto">` so a mixed Arabic/Latin line
 * still lays out by its own script; the spans are inline and do not break it.
 */
export function mentionSpans(
  text: string,
  mentions?: string[],
): { text: string; handle?: string }[] {
  const known = new Set((mentions ?? []).map((h) => h.toLowerCase()));
  if (known.size === 0 || !text) return [{ text }];

  const out: { text: string; handle?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const handle = (m[2] ?? '').toLowerCase();
    if (!known.has(handle)) continue;
    // `m.index` points at the character BEFORE the @ (the group-1 boundary,
    // which is empty at the start of the string), so the @ itself is that far
    // along PLUS the boundary's own length. Forgetting the second term eats the
    // character in front of every mention.
    const at = (m.index ?? 0) + (m[1]?.length ?? 0);
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: `@${m[2]}`, handle });
    last = at + 1 + (m[2]?.length ?? 0);
  }
  if (last === 0) return [{ text }];
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/**
 * One message bubble, with press-and-hold.
 *
 * A component rather than props spread inline, because the gesture needs a hook
 * and a hook needs a component — and the bubble is rendered inside a `.map`.
 *
 * The callout suppression is half of a pair. `onContextMenu` (in the hook) stops
 * the browser raising its own menu; these two CSS rules stop the text selection
 * that Android starts on the same gesture. Neither works without the other:
 * with only the handler you get a blue selection under our sheet, and with only
 * the CSS you get Android's "copy / select all" on top of it.
 *
 * Making the text unselectable is the reason the sheet has a Copy row. Selecting
 * part of a message is the thing this trades away, and copying all of it is what
 * people actually do.
 */
function Bubble({ children, style, onLongPress }: {
  children: ReactNode;
  style: React.CSSProperties;
  onLongPress: () => void;
}) {
  const press = useLongPress(onLongPress);
  return (
    <div
      {...press}
      style={{
        ...style,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >{children}</div>
  );
}

/**
 * Put a message on the clipboard.
 *
 * Best-effort and silent on refusal: Pi Browser does not always grant clipboard
 * access, and the fallback — a hidden textarea plus `execCommand` — is the only
 * thing that works in a webview that refuses the modern API. Deprecated, and
 * still the difference between Copy working and Copy doing nothing.
 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* fall through to the webview path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch { /* nothing more to try */ }
}

function Body({ text, mentions, me }: { text: string; mentions?: string[]; me: string }) {
  const parts: ReactNode[] = mentionSpans(text, mentions).map((p, i) => (
    p.handle
      ? (
        <span
          key={`mn-${i}`}
          style={{
            color: C.gold, fontWeight: 700,
            ...(p.handle === me && { background: goldA(0.133), borderRadius: 4, padding: '0 3px' }),
          }}
        >{p.text}</span>
      )
      : p.text
  ));
  return <bdi dir="auto">{parts}</bdi>;
}

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
function Chat({ id, me, conversations, onBack }: {
  id: string; me: string;
  /** For the forward picker: the only destinations that exist are these. */
  conversations: Summary[];
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const {
    thread, busy, error, send, sendMedia, deleteMessage, hide, clear, addMember, leave,
    loadOlder, loadingOlder, hasMore, setMuted, readMark,
    react, editMessage, forwardMessage, setPinned, setPosting,
  } = useThread(id);
  // The message being answered. Held here rather than in the composer so the
  // bubble it points at can be highlighted while it is being answered.
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  // The message being rewritten. Mutually exclusive with a reply: the composer
  // is one box, and it cannot be both answering something and replacing it.
  const [editing, setEditing] = useState<Msg | null>(null);
  const [forwarding, setForwarding] = useState<Msg | null>(null);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const { isBlocked, block, unblock, busy: blockBusy, error: blockError } = useBlocks();
  // Which message has its Delete showing. One at a time — a delete button on
  // every bubble is a row of hazards down the side of the transcript.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  // Reveal state used to live here, as a Set of message ids. It moved INTO the
  // tile (MediaImage): a transcript-level Set is only written by a load event,
  // and a photo that arrives from cache never fires one — so the id never
  // entered the Set and the tile stayed transparent for the life of the screen.
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

  // Entering the editor puts the existing words in the box — an edit that
  // starts from an empty field is a retype, not a correction.
  useEffect(() => {
    if (!editing) return;
    setDraft(editing.body);
    setReplyTo(null);
  }, [editing]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;

    // Editing takes the whole submit path over. Falling through to `send` would
    // post the correction as a NEW message and leave the typo above it.
    if (editing) {
      const target = editing;
      setDraft('');
      setEditing(null);
      const okEdit = await editMessage(target.id, text);
      if (!okEdit) { setDraft(text); setEditing(target); }
      return;
    }

    const quoting = replyTo?.id;
    setDraft('');
    // Cleared BEFORE the round trip so the banner does not linger over a sent
    // message — and restored with the text if it fails, because losing the
    // quote silently would send the retry as an unrelated message.
    setReplyTo(null);
    const okSent = await send(text, quoting);
    if (!okSent) {
      setDraft(text);   // put the words back rather than losing them
      if (replyTo) setReplyTo(replyTo);
    }
  };

  const isGroup = thread?.kind === 'GROUP';
  const peerName = thread?.peer ?? '';
  const title = isGroup ? (thread?.title ?? '') : `@${peerName}`;
  // A blocked thread stays READABLE — a block ends contact, it does not delete
  // the history you already have.
  const peerBlocked = !isGroup && !!peerName && isBlocked(peerName);
  // An announcement group the caller may not write in. The service refuses the
  // write regardless; this is so nobody types a message first and finds out
  // afterwards.
  const readOnly = isGroup
    && thread?.posting === 'ADMINS'
    && thread?.role !== 'owner'
    && thread?.role !== 'admin';
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

  /**
   * The id of the first message the reader had not seen — the line goes ABOVE
   * it.
   *
   * Computed from the frozen watermark, so it stays put while the thread is
   * open instead of chasing "read" downward. Only messages from SOMEONE ELSE
   * count: your own message is not news to you, and a thread whose last line is
   * yours would otherwise open with a "new messages" line under it.
   *
   * `null` when nothing qualifies — a thread already caught up, or a first
   * visit with no watermark at all, where every message would be "new" and the
   * line would sit at the very top saying nothing.
   */
  /**
   * Who the half-typed `@…` at the END of the draft could mean.
   *
   * Only at the end, and only in a group. Tracking the caret mid-text would
   * mean keeping a selection index in sync with every edit, paste and
   * autocorrect on a phone keyboard — and getting that slightly wrong replaces
   * the wrong span of the person's sentence. Typing a handle happens at the end
   * essentially always; the rare mid-sentence case still works, it just types
   * the handle out in full.
   *
   * A mention only reaches someone in the conversation (the service filters
   * against the member list), so the picker offers exactly that set — never a
   * handle the message could not deliver to.
   */
  const mentionPick = useMemo(() => {
    if (!isGroup) return null;
    const m = /(?:^|\s)@([a-zA-Z0-9_]{0,40})$/.exec(draft);
    if (!m) return null;
    const frag = (m[1] ?? '').toLowerCase();
    const hits = (thread?.members ?? [])
      .filter((u) => norm(u) !== meNorm && norm(u).startsWith(frag))
      .slice(0, 6);
    return hits.length ? { start: draft.length - frag.length, hits } : null;
  }, [draft, isGroup, thread?.members, meNorm]);

  const firstUnreadId = useMemo(() => {
    if (!readMark) return null;
    const mark = new Date(readMark).getTime();
    if (!Number.isFinite(mark)) return null;
    const hit = rows.find(({ m, mine }) => !mine && new Date(m.at).getTime() > mark);
    return hit?.m.id ?? null;
  }, [rows, readMark]);

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
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onBack} aria-label={a.messages} style={{
          background: 'none', border: 'none', color: C.gold, cursor: 'pointer',
          fontSize: 26, lineHeight: 1, padding: '0 4px',
        }}>›</button>
        <Avatar name={isGroup ? (thread?.title ?? 'G') : (thread?.peer ?? '?')} size={40} group={!!isGroup} convId={id} />
        <button
          onClick={() => setShowInfo(true)}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'start', cursor: 'pointer' }}
        >
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <bdi dir="auto">{title}</bdi>
          </span>
          <span style={{ fontSize: 11.5, color: typing.length ? C.success : C.subtext }}>
            {typing.length
              ? <bdi dir="auto">{isGroup ? `@${typing[0]} ${a.typingNow}` : a.typingNow}</bdi>
              : isGroup ? <bdi>{thread?.members.length} {a.membersLabel}</bdi> : a.directLabel}
          </span>
        </button>
        <button onClick={() => setSearching(true)} aria-label={a.searchMessages} style={{
          background: 'none', border: 'none', color: C.subtext, cursor: 'pointer', fontSize: 17, padding: '0 4px',
        }}>🔍</button>
        <button onClick={() => setShowInfo(true)} aria-label={isGroup ? a.groupInfo : a.contactInfo} style={{
          background: 'none', border: 'none', color: C.subtext, cursor: 'pointer', fontSize: 20, padding: '0 4px',
        }}>⋯</button>
      </div>

      {/* The pinned message, under the header and above everything else — which
          is the only place it means anything. Tapping it goes to the message;
          the ✕ is offered only to whoever is allowed to take it down, so a
          member cannot be shown a control that will refuse them. */}
      {thread?.pinned && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          margin: '10px 0 0', padding: '8px 12px', borderRadius: 10,
          background: goldA(0.071),
          borderInlineStart: `3px solid ${C.gold}`,
        }}>
          <button
            onClick={() => {
              document.getElementById(`msg-${thread.pinned!.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'start', cursor: 'pointer' }}
          >
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.gold }}>
              📌 {a.pinnedMessage}
            </span>
            <span style={{
              display: 'block', fontSize: 12.5, color: C.text, marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} dir="auto">
              {thread.pinned.body || (thread.pinned.media === 'audio' ? a.voiceNote : a.photo)}
            </span>
          </button>
          {(!isGroup || thread.role === 'owner' || thread.role === 'admin') && (
            <button
              onClick={() => { void setPinned(null); }} aria-label={a.unpinMessage}
              style={{
                width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                background: 'none', border: 'none', color: C.subtext,
                fontSize: 13, cursor: 'pointer', display: 'grid', placeItems: 'center',
              }}
            >✕</button>
          )}
        </div>
      )}

      {/* a group of one is the reason a message "never arrives" */}
      {alone && (
        <div style={{
          margin: '12px 0 0', padding: '10px 14px', borderRadius: 12,
          background: goldA(0.078), border: `1px solid ${goldA(0.267)}`,
          fontSize: 12.5, color: C.text, lineHeight: 1.5,
        }}>{a.onlyYouInGroup}</div>
      )}

      {/* transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* A button rather than an infinite scroll.
            Auto-loading at the top fights the reader: on a phone, reaching the
            top usually means overscrolling, and content appearing there jumps
            the view away from what they were reading. A tap loads when they
            actually meant to. */}
        {hasMore && (
          <button
            onClick={() => { void loadOlder(); }}
            disabled={loadingOlder}
            style={{
              alignSelf: 'center', margin: '2px 0 10px', padding: '6px 16px',
              background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 999, color: C.subtext, fontSize: 12,
              cursor: loadingOlder ? 'not-allowed' : 'pointer',
            }}
          >{loadingOlder ? a.loading : a.loadOlder}</button>
        )}
        {!thread ? (
          <p style={{ color: C.subtext, fontSize: 13 }}>{error === 'notfound' ? a.threadUnavailable : a.loading}</p>
        ) : rows.length === 0 ? (
          <p style={{ color: C.subtext, fontSize: 13, textAlign: 'center', marginTop: 24 }}>{a.noMessagesYet}</p>
        ) : rows.map(({ m, mine, newDay, showSender }) => (
          // The anchor a quote scrolls back to.
          <div key={m.id} id={`msg-${m.id}`}>
            {/* Where you stopped last time. A full-width rule rather than a
                pill: a day separator says "a date", this says "everything
                below is new", and the two must not read as the same mark. */}
            {m.id === firstUnreadId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 2px 10px' }}>
                <span style={{ flex: 1, height: 1, background: goldA(0.333) }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, whiteSpace: 'nowrap' }}>
                  {a.unreadDivider}
                </span>
                <span style={{ flex: 1, height: 1, background: goldA(0.333) }} />
              </div>
            )}
            {newDay && (
              <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
                <span style={{
                  fontSize: 11, color: C.subtext, background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 12px',
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
                  background: 'none', border: 'none', color: C.gold,
                  fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 4px',
                  flexShrink: 0,
                  // Always on the side AWAY from the edge the bubble hugs, so
                  // it never sits between the message and the screen edge.
                  order: mine ? 0 : 2,
                }}
              >⋯</button>
              <Bubble
                onLongPress={() => setMenuFor(m.id)}
                style={{
                maxWidth: '78%', padding: '8px 12px 6px',
                background: mine ? goldA(0.122) : C.surface2,
                // Named YOU, in a group of forty, three hours ago. The whole
                // bubble is marked rather than only the handle inside it —
                // scrolling back to find one gold word is exactly the work the
                // mention was supposed to save. Never on your own message: you
                // know what you wrote.
                border: `1px solid ${
                  !mine && (m.mentions ?? []).includes(meNorm) ? goldA(0.533)
                    : mine ? goldA(0.267) : C.border
                }`,
                borderRadius: 16,
                // The squared corner marks the speaker, the way a tail does.
                borderEndEndRadius: mine ? 5 : 16,
                borderEndStartRadius: mine ? 16 : 5,
              }}>
                {showSender && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold, marginBottom: 3 }}>
                    <bdi>@{m.by}</bdi>
                  </div>
                )}
                {m.deleted ? (
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: C.subtext, fontStyle: 'italic' }}>
                    {a.messageDeleted}
                  </div>
                ) : (<>
                {/* Where it came from, before anything it says. Named as the
                    person who WROTE it — the chain of who passed it on is not
                    the interesting fact, and the service only keeps the origin. */}
                {m.forwardedFrom && (
                  <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, fontStyle: 'italic' }}>
                    ↪ {a.forwardedFrom} <bdi>@{m.forwardedFrom}</bdi>
                  </div>
                )}
                {/* What this message answers. Above the body, quieter than it,
                    and tappable — a quote you cannot follow back is decoration. */}
                {m.replyTo && (
                  <button
                    onClick={() => {
                      const el = document.getElementById(`msg-${m.replyTo!.id}`);
                      // Only if it is actually loaded. Scrolling to nothing, or
                      // silently doing nothing, both read as broken — so the
                      // control simply does not move when the original is above
                      // what has been fetched.
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer',
                      background: inkA(0.05), border: 'none',
                      borderInlineStart: `3px solid ${C.gold}`,
                      borderRadius: 8, padding: '6px 10px', marginBottom: 6,
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.gold }}>
                      {m.replyTo.by ? <bdi>@{m.replyTo.by}</bdi> : a.messageDeleted}
                    </span>
                    <span style={{
                      display: 'block', fontSize: 12.5, color: C.subtext, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontStyle: m.replyTo.deleted || m.replyTo.hidden ? 'italic' : 'normal',
                    }} dir="auto">
                      {m.replyTo.deleted ? a.messageDeleted
                        : m.replyTo.hidden ? a.quoteHidden
                        : m.replyTo.body || (m.replyTo.media === 'audio' ? a.voiceNote : a.photo)}
                    </span>
                  </button>
                )}
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
                      backgroundColor: C.surface2,
                    }}
                  >
                    <MediaImage
                      src={mediaUrl(id, m.id)}
                      alt={a.photo}
                      loadingLabel={a.loading}
                      failedLabel={a.photoUnavailable}
                      imgStyle={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
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
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, color: C.text, wordBreak: 'break-word' }}>
                    <Body text={m.body} mentions={m.mentions} me={meNorm} />
                  </div>
                )}
                {/* The reactions, INSIDE the bubble and under the words.
                    Outside it they would shift the transcript's layout every
                    time one landed; a row that appears and disappears inside a
                    bubble only moves that bubble. Tapping one you gave takes it
                    back — the same gesture, both directions. */}
                {(m.reactions ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {(m.reactions ?? []).map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => { void react(m.id, r.emoji, !r.mine); }}
                        aria-pressed={r.mine}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '2px 7px', borderRadius: 999, cursor: 'pointer',
                          fontSize: 12, lineHeight: 1.6,
                          background: r.mine ? goldA(0.133) : inkA(0.06),
                          border: `1px solid ${r.mine ? goldA(0.4) : 'transparent'}`,
                          color: C.text,
                        }}
                      >
                        <span>{r.emoji}</span>
                        {/* The count only once there is more than one. "👍 1"
                            is noise; "👍" already says one person did. */}
                        {r.count > 1 && <span style={{ fontSize: 10.5, fontWeight: 700 }}>{r.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
                </>)}
                <div style={{ fontSize: 10, color: C.subtext, textAlign: 'end', marginTop: 2, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {/* Said, not hidden. A message whose words changed after
                      people read them must say so, or the edit is a quiet
                      rewrite of what everyone remembers. */}
                  {m.editedAt && <span style={{ fontStyle: 'italic' }}>{a.edited}</span>}
                  {/* "12:52 AM" is mostly bidi-neutral, so an RTL paragraph moves
                      the meridiem to the front: "AM 12:52". */}
                  <bdi>{clock(m.at)}</bdi>
                  {/* Ticks on YOUR OWN messages in a DIRECT thread only. In a
                      group "read" is per member and one tick cannot say "three
                      of five", so nothing is claimed there. */}
                  {mine && !m.deleted && !isGroup && (
                    <span
                      title={seenBy(m.at, thread?.peerReadAt) ? a.seen : a.delivered}
                      style={{ color: seenBy(m.at, thread?.peerReadAt) ? C.success : C.subtext }}
                    >{seenBy(m.at, thread?.peerReadAt) ? '✓✓' : '✓'}</span>
                  )}
                </div>
              </Bubble>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error === 'refused' && <p style={{ color: C.error, fontSize: 12, margin: '0 0 6px' }}>{a.messageRefused}</p>}
      {error === 'failed' && <p style={{ color: C.error, fontSize: 12, margin: '0 0 6px' }}>{a.messageFailed}</p>}
      {error === 'toobig' && <p style={{ color: C.error, fontSize: 12, margin: '0 0 6px' }}>{a.attachTooBig}</p>}
      {error === 'attach' && <p style={{ color: C.error, fontSize: 12, margin: '0 0 6px' }}>{a.attachFailed}</p>}
      {micIssue === 'denied' && (
        <p style={{ color: C.subtext, fontSize: 11.5, margin: '0 0 6px', lineHeight: 1.5 }}>{a.micBlockedHere}</p>
      )}

      {/* composer — replaced by the reason when the thread is blocked, rather
          than left in place to fail on send. */}
      {peerBlocked ? (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ flex: 1, fontSize: 12.5, color: C.subtext, margin: 0, lineHeight: 1.5 }}>{a.blockedNotice}</p>
          <button style={quietBtn} disabled={blockBusy} onClick={() => { void unblock(peerName); }}>{a.unblock}</button>
        </div>
      ) : readOnly ? (
        // An announcement group, seen by someone who may not post.
        //
        // The composer is REPLACED, not disabled. A greyed-out box with a
        // keyboard that will not open is a bug as far as anyone using it is
        // concerned; a sentence saying only admins can post here is the answer
        // to the question they were about to ask.
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12.5, color: C.subtext, margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
            📣 {a.announcementOnly}
          </p>
        </div>
      ) : (<>
      {/* What is being answered, above the composer.
          Shown while typing rather than only after sending, because a reply
          you cannot see you are writing is a reply you attach to the wrong
          message. The ✕ is deliberately large enough to hit — dropping the
          quote is the correction someone reaches for most. */}
      {/* Editing, above the composer and unmistakably not a reply.
          The two look alike and mean opposite things — one adds a message, the
          other replaces one — so this one is labelled and the ✕ restores the
          composer to an ordinary empty box. */}
      {editing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
          padding: '8px 12px', borderRadius: 10,
          background: goldA(0.078),
          borderInlineStart: `3px solid ${C.gold}`,
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.gold }}>
              {a.editingMessage}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: C.subtext, marginTop: 1, lineHeight: 1.4 }}>
              {a.editMessageHint}
            </span>
          </span>
          <button
            onClick={() => { setEditing(null); setDraft(''); }} aria-label={a.cancel}
            style={{
              width: 30, height: 30, borderRadius: 999, flexShrink: 0,
              background: 'none', border: 'none', color: C.subtext,
              fontSize: 15, cursor: 'pointer', display: 'grid', placeItems: 'center',
            }}
          >✕</button>
        </div>
      )}
      {replyTo && !editing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
          padding: '8px 12px', borderRadius: 10,
          background: inkA(0.05),
          borderInlineStart: `3px solid ${C.gold}`,
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.gold }}>
              {a.replyingTo} <bdi>@{replyTo.by}</bdi>
            </span>
            <span style={{
              display: 'block', fontSize: 12.5, color: C.subtext, marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} dir="auto">
              {replyTo.body || (replyTo.media?.type === 'audio' ? a.voiceNote : a.photo)}
            </span>
          </span>
          <button
            onClick={() => setReplyTo(null)} aria-label={a.cancel}
            style={{
              width: 30, height: 30, borderRadius: 999, flexShrink: 0,
              background: 'none', border: 'none', color: C.subtext,
              fontSize: 15, cursor: 'pointer', display: 'grid', placeItems: 'center',
            }}
          >✕</button>
        </div>
      )}
      {/* The @ picker. Above the composer, so the keyboard does not cover it. */}
      {mentionPick && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10,
          paddingBottom: 2, WebkitOverflowScrolling: 'touch',
        }}>
          {mentionPick.hits.map((u) => (
            <button
              key={u}
              onClick={() => setDraft(`${draft.slice(0, mentionPick.start)}${u} `)}
              style={{
                flexShrink: 0, background: goldA(0.078),
                border: `1px solid ${goldA(0.267)}`, borderRadius: 999,
                padding: '6px 14px', fontSize: 12.5, fontWeight: 700,
                color: C.gold, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            ><bdi>@{u}</bdi></button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
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
            background: 'none', border: `1px solid ${C.border}`,
            color: C.subtext, fontSize: 17, cursor: busy ? 'not-allowed' : 'pointer',
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
            background: draft.trim() ? `linear-gradient(135deg, ${C.gold}, ${C.goldDark})` : C.surface2,
            color: draft.trim() ? C.onGold : C.subtext,
            fontSize: 18, cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center',
          }}
        >
          {/* A paper plane mirrors with the writing direction. */}
          <span style={{ transform: 'scaleX(1)', display: 'block' }} dir="ltr">➤</span>
        </button>
      </div>
      </>)}

      {viewing && <Lightbox src={viewing} alt={a.photo} onClose={() => setViewing(null)} />}

      {searching && (
        <ChatSearch
          conversationId={id}
          onClose={() => setSearching(false)}
          // Returns whether it could actually go there. A result older than what
          // has been loaded has no element to scroll to, and jumping to nothing
          // — or silently doing nothing — both read as broken, so the panel
          // simply stays open on that row.
          onOpen={(hit) => {
            const el = document.getElementById(`msg-${hit.id}`);
            if (!el) return false;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
          }}
        />
      )}

      {forwarding && (
        <ForwardPicker
          conversations={conversations} exceptId={id}
          onPick={(to) => forwardMessage(forwarding.id, to)}
          onClose={() => setForwarding(null)}
        />
      )}

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
            onReply={() => { setReplyTo(target.m); setMenuFor(null); }}
            onDelete={(scope) => { void deleteMessage(menuFor, scope); }}
            onReport={() => setReporting({ id: target.m.id, by: target.m.by })}
            onClose={() => setMenuFor(null)}
            onReact={(emoji, on) => { void react(target.m.id, emoji, on); }}
            myReactions={(target.m.reactions ?? []).filter((r) => r.mine).map((r) => r.emoji)}
            // Computed here, from the send time, using the same window the
            // service enforces. Offering an option the server will refuse is
            // how a menu teaches people to distrust it.
            canEdit={target.mine && !!target.m.body && withinEditWindow(target.m.at)}
            onEdit={() => setEditing(target.m)}
            onForward={() => setForwarding(target.m)}
            canPin={!isGroup || thread?.role === 'owner' || thread?.role === 'admin'}
            pinned={thread?.pinned?.id === target.m.id}
            onPin={(next) => { void setPinned(next ? target.m.id : null); }}
            // Absent on an attachment: there is nothing to put on the clipboard,
            // and an option that copies "" is worse than no option.
            onCopy={target.m.body ? () => { void copyText(target.m.body); } : undefined}
          />
        );
      })()}

      {showInfo && thread && (
        <ChatInfoSheet
          isGroup={!!isGroup}
          convId={id}
          visibility={thread?.visibility}
          description={thread?.description}
          admins={thread?.admins ?? []}
          ownerName={thread?.owner ?? null}
          title={title}
          members={thread.members}
          role={thread.role}
          me={meNorm}
          peerName={peerName}
          onClose={() => setShowInfo(false)}
          onAddMember={(u) => { void addMember(u); }}
          onLeave={async () => { if (await leave()) onBack(); }}
          onClear={() => { void clear(); }}
          muted={!!thread.muted}
          onToggleMute={async (next) => { await setMuted(next); }}
          posting={thread.posting}
          // Offered ONLY to a group's owner. The service refuses anyone else,
          // and a switch that always refuses is worse than no switch.
          onSetPosting={isGroup && thread.role === 'owner'
            ? async (next) => { await setPosting(next); }
            : undefined}
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
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <bdi dir="auto">{name}</bdi>
          </span>
          {/* Muted, and it has to be visible HERE. A muted thread still shows a
              count, so without this mark the only difference between "quiet
              because nobody wrote" and "quiet because you silenced it" is
              memory — and the usual next step is deciding the app is broken. */}
          {c.muted && (
            <span title={a.muted} style={{ fontSize: 12, color: C.subtext, flexShrink: 0 }}>🔕</span>
          )}
          {c.last && <span style={{ fontSize: 11, color: C.subtext, flexShrink: 0 }}><bdi>{clock(c.last.at)}</bdi></span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.last ? <bdi dir="auto">{c.last.body}</bdi>
                    : isGroup ? <bdi>{c.members} {a.membersLabel}</bdi> : a.directLabel}
          </span>
          {c.unread > 0 && (
            // A muted thread keeps its count — you still want to know how much
            // you missed — but loses the amber. The colour is a summons; the
            // number is information, and muting is a request for the second
            // without the first.
            <span style={{
              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
              background: c.muted ? C.surface2 : C.gold,
              color: c.muted ? C.subtext : C.onGold,
              ...(c.muted && { border: `1px solid ${C.border}` }),
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
  createGroup: (title: string, members?: string[]) => Promise<{ id: string } | { code: string }>;
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
  const [discovering, setDiscovering] = useState(false);

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
    const res = await createGroup(v);
    if ('id' in res) { setGroupTitle(''); setComposing(null); setOpenId(res.id); return; }
    // A name collision is not a failure to explain in hex — it is a thing the
    // person can fix in two seconds, if they are told which thing it is. The
    // title is deliberately KEPT so they can edit it rather than retype it.
    setPickError(
      res.code === 'GROUP_NAME_TAKEN_OWN' ? a.groupNameTakenOwn
      : res.code === 'GROUP_NAME_TAKEN_PUBLIC' ? a.groupNameTakenPublic
      : a.openFailed.replace('{code}', res.code || '—'),
    );
  };

  if (openId) return <Chat id={openId} me={me} conversations={conversations} onBack={() => setOpenId(null)} />;

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

      {/* Finding a group you were never invited to. Its own quiet row rather
          than a third button beside the two above: creating and joining are
          different intentions, and three equal-weight buttons make neither
          obvious. */}
      <button
        onClick={() => setDiscovering(true)}
        style={{
          width: '100%', marginBottom: 8, padding: '10px 14px',
          background: 'none', border: `1px dashed ${C.border}`,
          borderRadius: 14, color: C.subtext, fontSize: 13,
          cursor: 'pointer', textAlign: 'center',
        }}
      >🔎 {a.discoverGroups}</button>

      {/* No reload on close: asking to join is a REQUEST, so nothing has been
          added to this list. The conversation appears when the owner approves,
          which the normal poll picks up. */}
      {discovering && <GroupDiscovery onClose={() => setDiscovering(false)} />}

      {pickError && <p style={{ color: C.error, fontSize: 12.5, margin: '0 0 6px' }}>{pickError}</p>}

      <div style={{ marginTop: 8 }}>
        {loading ? (
          <p style={{ color: C.subtext, fontSize: 13 }}>{a.loading}</p>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: 0 }}>{a.noConversations}</p>
            <p style={{ color: C.subtext, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{a.startConversation}</p>
          </div>
        ) : conversations.map((c, i) => (
          <div key={c.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
            <Row c={c} a={a} onOpen={() => setOpenId(c.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
