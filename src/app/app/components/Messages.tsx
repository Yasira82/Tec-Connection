'use client';

// TEC Connection (C-107) — Messages. Two views in one component: the thread LIST,
// and one OPEN thread. They are never both on screen, because on a phone a
// split view means each half is too narrow to use.
//
// Everything a person reads here was written by someone else, so every piece of
// it is rendered as `<bdi dir="auto">`: a message, a group name and a handle each
// lay out by their OWN script rather than the interface's. Without that, an
// English message inside an Arabic interface reverses its punctuation, and a
// Latin handle renders as `yas55eR82@`.
import { useEffect, useRef, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useConversations, useThread, type Summary } from '@/lib-client/connection/useMessages';

const card = {
  background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`,
  borderRadius: 16, padding: '20px 22px',
} as const;

const input = {
  flex: 1, minWidth: 0, background: TEC_COLORS.bg, color: TEC_COLORS.text,
  border: `1px solid ${TEC_COLORS.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14,
} as const;

const goldBtn = {
  background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
  color: '#0a0800', border: 'none', borderRadius: 10, padding: '10px 16px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

const quietBtn = {
  background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.subtext,
  borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

/** Local clock format — the browser already knows the reader's conventions. */
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function Avatar({ name }: { name: string }) {
  return (
    <span style={{
      width: 34, height: 34, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
      background: TEC_COLORS.bg, border: `1px solid ${TEC_COLORS.border}`,
      color: TEC_COLORS.gold, fontSize: 14, fontWeight: 800,
    }}>{(name || '?').charAt(0).toUpperCase()}</span>
  );
}

// ── one open thread ─────────────────────────────────────────────────────────
function ThreadView({ id, me, onBack }: { id: string; me: string; onBack: () => void }) {
  const { t } = useTranslation();
  const a = t.app;
  const { thread, busy, error, send, addMember, leave } = useThread(id);
  const [draft, setDraft] = useState('');
  const [invitee, setInvitee] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  // Follow the conversation down as it grows. `block: 'nearest'` scrolls the
  // message list, not the page — scrolling the page would move the composer off
  // screen on a phone every time a message arrived.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread?.messages.length]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const ok = await send(text);
    if (!ok) setDraft(text);   // put the words back rather than losing them
  };

  const title = thread?.kind === 'GROUP' ? (thread.title ?? '') : `@${thread?.peer ?? ''}`;

  return (
    <div style={card}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: TEC_COLORS.subtext, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 10 }}>
        {a.backToMessages}
      </button>

      {!thread ? (
        <p style={{ color: TEC_COLORS.subtext, fontSize: 13, margin: 0 }}>
          {error === 'notfound' ? a.threadUnavailable : a.loading}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${TEC_COLORS.border}` }}>
            <Avatar name={thread.kind === 'GROUP' ? (thread.title ?? 'G') : (thread.peer ?? '?')} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <bdi dir="auto">{title}</bdi>
              </span>
              <span style={{ fontSize: 11, color: TEC_COLORS.subtext }}>
                {thread.kind === 'GROUP'
                  ? <bdi>{thread.members.length} {a.membersLabel}</bdi>
                  : a.directLabel}
              </span>
            </span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {thread.messages.length === 0 ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13, margin: 0 }}>{a.startConversation}</p>
            ) : thread.messages.map((m) => {
              const mine = m.by === me;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: 10.5, color: TEC_COLORS.subtext, marginBottom: 3 }}>
                    <bdi>{mine ? a.you : `@${m.by}`}</bdi> · {timeOf(m.at)}
                  </span>
                  <span style={{
                    maxWidth: '85%', padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.5,
                    background: mine ? `${TEC_COLORS.gold}22` : TEC_COLORS.bg,
                    border: `1px solid ${mine ? `${TEC_COLORS.gold}55` : TEC_COLORS.border}`,
                    color: TEC_COLORS.text, wordBreak: 'break-word',
                  }}>
                    {/* Written by another person: it lays out by its own script. */}
                    <bdi dir="auto">{m.body}</bdi>
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: `1px solid ${TEC_COLORS.border}` }}>
            <input
              style={input} value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={a.messagePlaceholder} maxLength={2000} dir="auto"
            />
            <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>{a.send}</button>
          </div>

          {error === 'refused' && <p style={{ color: TEC_COLORS.error, fontSize: 12, marginTop: 8 }}>{a.messageRefused}</p>}
          {error === 'failed' && <p style={{ color: TEC_COLORS.error, fontSize: 12, marginTop: 8 }}>{a.messageFailed}</p>}

          {thread.kind === 'GROUP' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${TEC_COLORS.border}` }}>
              {thread.role === 'owner' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    style={input} value={invitee} onChange={(e) => setInvitee(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { addMember(invitee); setInvitee(''); } }}
                    placeholder={a.addMemberPlaceholder} maxLength={100} autoCapitalize="none"
                  />
                  <button style={goldBtn} onClick={() => { addMember(invitee); setInvitee(''); }}>{a.addMember}</button>
                </div>
              )}
              <button style={quietBtn} onClick={async () => { if (await leave()) onBack(); }}>{a.leaveGroup}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── the list ────────────────────────────────────────────────────────────────
function Row({ c, onOpen, a }: { c: Summary; onOpen: () => void; a: Record<string, string> }) {
  const name = c.kind === 'GROUP' ? (c.title ?? '') : `@${c.peer ?? ''}`;
  return (
    <button onClick={onOpen} style={{
      width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
    }}>
      <Avatar name={c.kind === 'GROUP' ? (c.title ?? 'G') : (c.peer ?? '?')} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <bdi dir="auto">{name}</bdi>
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: TEC_COLORS.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.last ? <bdi dir="auto">{c.last.body}</bdi>
                  : c.kind === 'GROUP' ? <bdi>{c.members} {a.membersLabel}</bdi> : a.directLabel}
        </span>
      </span>
      {c.unread > 0 && (
        <span style={{
          minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
          background: TEC_COLORS.gold, color: '#0a0800',
        }}>{c.unread}</span>
      )}
    </button>
  );
}

export function Messages({ me }: { me: string }) {
  const { t } = useTranslation();
  const a = t.app;
  const { conversations, loading, openDirect, createGroup } = useConversations();
  const [openId, setOpenId] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [composingGroup, setComposingGroup] = useState(false);

  const startDirect = async () => {
    const u = to.trim();
    if (!u) return;
    setTo('');
    const id = await openDirect(u);
    if (id) setOpenId(id);
  };

  const startGroup = async () => {
    const title = groupTitle.trim();
    if (!title) return;
    setGroupTitle('');
    setComposingGroup(false);
    const id = await createGroup(title);
    if (id) setOpenId(id);
  };

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>💬</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>{a.messages}</h2>
        <span style={{ fontSize: 12, color: TEC_COLORS.subtext }}>{a.messagesSub}</span>
      </div>

      {openId ? (
        <ThreadView id={openId} me={me} onBack={() => setOpenId(null)} />
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input} value={to} onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') startDirect(); }}
              placeholder={a.newMessage} maxLength={100} autoCapitalize="none" autoCorrect="off"
            />
            <button style={goldBtn} onClick={startDirect}>{a.send}</button>
          </div>

          {composingGroup ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                style={input} value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') startGroup(); }}
                placeholder={a.groupTitlePlaceholder} maxLength={120} dir="auto"
              />
              <button style={goldBtn} onClick={startGroup}>{a.createGroup}</button>
            </div>
          ) : (
            <button style={{ ...quietBtn, marginTop: 10 }} onClick={() => setComposingGroup(true)}>
              + {a.newGroup}
            </button>
          )}

          <div style={{ marginTop: 14 }}>
            {loading ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>{a.loading}</p>
            ) : conversations.length === 0 ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>{a.noConversations}</p>
            ) : conversations.map((c, i) => (
              <div key={c.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
                <Row c={c} a={a} onOpen={() => setOpenId(c.id)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
