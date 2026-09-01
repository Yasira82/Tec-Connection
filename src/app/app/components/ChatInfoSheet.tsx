'use client';

// Conversation info — as a sheet, not as a block wedged into the chat.
//
// It used to render inline, between the header and the transcript: an input, a
// row of @username pills, "Leave group" and "Delete conversation" all stacked
// loose, shoving the messages down the screen every time it opened. Three
// unrelated things at the same visual weight, in the middle of a conversation.
//
// The shape people already know is a sheet that covers the chat while you are
// looking at it and leaves the transcript alone: identity at the top, then
// members as a LIST (not chips — a chip is a tag, and these are people), then
// the destructive actions last, marked as destructive and separated from
// everything above them.
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

const sheetInput = {
  flex: 1, minWidth: 0, background: TEC_COLORS.bg, color: TEC_COLORS.text,
  border: `1px solid ${TEC_COLORS.border}`, borderRadius: 999,
  padding: '10px 14px', fontSize: 13.5, outline: 'none',
} as const;

/** A full-width action row. Destructive ones are red and live at the bottom. */
function ActionRow({ label, icon, danger, onClick, disabled }: {
  label: string; icon: string; danger?: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 14px', textAlign: 'start',
        background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? TEC_COLORS.error : TEC_COLORS.text,
        fontSize: 14, fontWeight: 600, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    </button>
  );
}

export function ChatInfoSheet({
  isGroup, title, members, role, me, onClose,
  onAddMember, onLeave, onDelete,
  blocked, onBlock, onUnblock, blockBusy, blockError, peerName,
}: {
  isGroup: boolean;
  title: string;
  members: string[];
  role?: string;
  /** Normalized, so "you" is marked on the row that is actually yours. */
  me: string;
  onClose: () => void;
  onAddMember: (username: string) => void;
  onLeave: () => void;
  onDelete: () => void;
  blocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  blockBusy: boolean;
  blockError: boolean;
  peerName: string;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const [invitee, setInvitee] = useState('');
  // Two taps rather than a modal — a mis-tap on a phone is easy, and these are
  // the only actions here that cannot be undone with one more tap.
  const [armedBlock, setArmedBlock] = useState(false);
  const [armedDelete, setArmedDelete] = useState(false);
  const [armedLeave, setArmedLeave] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const add = () => {
    const v = invitee.trim();
    if (!v) return;
    onAddMember(v);
    setInvitee('');
  };

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={isGroup ? a.groupInfo : a.contactInfo}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(3,5,12,0.72)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '82vh', overflowY: 'auto',
          background: TEC_COLORS.surface,
          borderStartStartRadius: 20, borderStartEndRadius: 20,
          border: `1px solid ${TEC_COLORS.border}`, borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        {/* the grab handle: says "this pulls down" without a word */}
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: TEC_COLORS.border }} />
        </div>

        {/* identity */}
        <div style={{ display: 'grid', placeItems: 'center', gap: 6, padding: '10px 16px 18px' }}>
          <span style={{
            width: 66, height: 66, borderRadius: 999, display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            color: '#0a0800', fontSize: 27, fontWeight: 800,
          }}>{(title || '?').replace(/^@/, '').charAt(0).toUpperCase()}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: TEC_COLORS.text, textAlign: 'center' }}>
            <bdi dir="auto">{title}</bdi>
          </span>
          <span style={{ fontSize: 12.5, color: TEC_COLORS.subtext }}>
            {isGroup ? <bdi>{members.length} {a.membersLabel}</bdi> : a.directLabel}
          </span>
        </div>

        {isGroup && (
          <section style={{ borderTop: `1px solid ${TEC_COLORS.border}`, padding: '14px 16px' }}>
            <h4 style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
              textTransform: 'uppercase', color: TEC_COLORS.subtext,
            }}>{a.members}</h4>

            {role === 'owner' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  style={sheetInput} value={invitee} onChange={(e) => setInvitee(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder={a.addMemberPlaceholder} maxLength={100}
                  autoCapitalize="none" autoCorrect="off"
                />
                <button
                  onClick={add}
                  style={{
                    background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
                    color: '#0a0800', border: 'none', borderRadius: 999, padding: '0 18px',
                    fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >{a.addMember}</button>
              </div>
            )}

            <div style={{ display: 'grid' }}>
              {members.map((u) => {
                const mine = u.trim().toLowerCase() === me;
                return (
                  <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
                      background: TEC_COLORS.surface2, border: `1px solid ${TEC_COLORS.border}`,
                      color: TEC_COLORS.gold, fontSize: 13, fontWeight: 800,
                    }}>{(u || '?').charAt(0).toUpperCase()}</span>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13.5, color: TEC_COLORS.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}><bdi>@{u}</bdi></span>
                    {mine && (
                      <span style={{ fontSize: 11, color: TEC_COLORS.subtext, flexShrink: 0 }}>{a.you}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Destructive actions, last and apart. Nothing above this line can
            cost you a conversation. */}
        <section style={{ borderTop: `1px solid ${TEC_COLORS.border}`, paddingTop: 4 }}>
          {!isGroup && peerName && (
            blocked ? (
              <>
                <p style={{ fontSize: 12.5, color: TEC_COLORS.subtext, margin: 0, padding: '10px 16px 0', lineHeight: 1.5 }}>
                  {a.blockedNotice}
                </p>
                <ActionRow icon="↩" label={a.unblock} disabled={blockBusy} onClick={onUnblock} />
              </>
            ) : (
              <ActionRow
                icon="⊘" danger disabled={blockBusy}
                label={armedBlock ? a.confirmBlock : a.block}
                onClick={() => { if (armedBlock) { onBlock(); setArmedBlock(false); } else setArmedBlock(true); }}
              />
            )
          )}

          {isGroup && (
            <ActionRow
              icon="⇠" danger
              label={armedLeave ? a.confirmLeave : a.leaveGroup}
              onClick={() => { if (armedLeave) onLeave(); else setArmedLeave(true); }}
            />
          )}

          <ActionRow
            icon="🗑" danger
            label={armedDelete ? a.confirmDelete : a.deleteChat}
            onClick={() => { if (armedDelete) onDelete(); else setArmedDelete(true); }}
          />

          {blockError && (
            <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: 0, padding: '0 16px 10px' }}>{a.blockFailed}</p>
          )}
        </section>
      </div>
    </div>
  );
}
