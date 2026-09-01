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
import { useEffect, useRef, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import { Avatar } from '@/components/public/Avatar';

/** What a group photo may be. Same three as a profile photo, same 2MB ceiling. */
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

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
  isGroup, title, members, role, me, onClose, convId,
  onAddMember, onLeave, onDelete, onClear,
  blocked, onBlock, onUnblock, blockBusy, blockError, peerName,
}: {
  isGroup: boolean;
  /** Needed for the group photo, which is keyed by the conversation. */
  convId: string;
  title: string;
  members: string[];
  role?: string;
  /** Normalized, so "you" is marked on the row that is actually yours. */
  me: string;
  onClose: () => void;
  onAddMember: (username: string) => void;
  onLeave: () => void;
  /** Removes the conversation AND its history — it does not come back. */
  onDelete: () => void;
  /** Empties the transcript but keeps the conversation. */
  onClear: () => void;
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
  const [armedClear, setArmedClear] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  // Bumped after a change so the <img> re-requests. Without it the browser keeps
  // serving the cached bytes of the OLD photo from the same URL, and it looks
  // like the upload silently failed.
  const [photoVersion, setPhotoVersion] = useState(0);
  useBackButton(true, onClose);

  const groupPhotoUrl = `/api/bff/connection/conversations/${encodeURIComponent(convId)}/avatar`;

  const uploadPhoto = async (file: File) => {
    // Checked here as well as in the BFF and in storage. Not redundancy for its
    // own sake: it turns a failed round-trip into a sentence, and a 5MB photo is
    // never uploaded at all.
    if (!PHOTO_ACCEPT.split(',').includes(file.type)) { setPhotoMsg(a.photoWrongType); return; }
    if (file.size > PHOTO_MAX_BYTES) { setPhotoMsg(a.photoTooBig); return; }

    setPhotoBusy(true); setPhotoMsg('');
    try {
      const res = await fetch(groupPhotoUrl, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) { setPhotoMsg(a.photoFailed); return; }
      setPhotoVersion((v) => v + 1);
    } catch { setPhotoMsg(a.photoFailed); }
    finally { setPhotoBusy(false); }
  };

  const removePhoto = async () => {
    setPhotoBusy(true); setPhotoMsg('');
    try {
      const res = await fetch(groupPhotoUrl, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { setPhotoMsg(a.photoFailed); return; }
      setPhotoVersion((v) => v + 1);
    } catch { setPhotoMsg(a.photoFailed); }
    finally { setPhotoBusy(false); }
  };

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
          {/* The Avatar component, not a hand-drawn disc. This sheet used to
              build its own gradient circle with the first letter, so it showed
              an initial for a person whose photo was already on file. */}
          <Avatar
            username={(title || '?').replace(/^@/, '')}
            size={66}
            tryPhoto
            photoSrc={isGroup ? `${groupPhotoUrl}?v=${photoVersion}` : undefined}
            key={photoVersion}
          />
          <span style={{ fontSize: 17, fontWeight: 700, color: TEC_COLORS.text, textAlign: 'center' }}>
            <bdi dir="auto">{title}</bdi>
          </span>
          <span style={{ fontSize: 12.5, color: TEC_COLORS.subtext }}>
            {isGroup ? <bdi>{members.length} {a.membersLabel}</bdi> : a.directLabel}
          </span>

          {/* Only the owner, and only for a group. A direct chat shows the other
              person's own photo — theirs to set, not yours to replace. */}
          {isGroup && role === 'owner' && (
            <>
              <input
                ref={photoRef} type="file" accept={PHOTO_ACCEPT} hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // Cleared so picking the SAME file again still fires onChange.
                  e.target.value = '';
                  if (f) void uploadPhoto(f);
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => photoRef.current?.click()} disabled={photoBusy}
                  style={{
                    background: 'none', border: 'none', color: TEC_COLORS.gold,
                    fontSize: 12.5, fontWeight: 700, padding: '2px 4px',
                    cursor: photoBusy ? 'not-allowed' : 'pointer',
                  }}
                >{photoBusy ? a.sending : a.groupPhotoChange}</button>
                <button
                  onClick={() => { void removePhoto(); }} disabled={photoBusy}
                  style={{
                    background: 'none', border: 'none', color: TEC_COLORS.subtext,
                    fontSize: 12.5, padding: '2px 4px',
                    cursor: photoBusy ? 'not-allowed' : 'pointer',
                  }}
                >{a.groupPhotoRemove}</button>
              </div>
              {photoMsg && (
                <span style={{ fontSize: 11.5, color: TEC_COLORS.error }}>{photoMsg}</span>
              )}
            </>
          )}
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

          {/* Emptying the thread and removing it are different acts, and the
              first is the reversible-feeling one, so it comes first. */}
          <ActionRow
            icon="🧹" danger
            label={armedClear ? a.confirmClear : a.clearChat}
            onClick={() => { if (armedClear) { onClear(); onClose(); } else setArmedClear(true); }}
          />

          <ActionRow
            icon="🗑" danger
            label={armedDelete ? a.confirmDelete : a.deleteChat}
            onClick={() => { if (armedDelete) onDelete(); else setArmedDelete(true); }}
          />

          {/* Said once, plainly, rather than left to be discovered: deleting
              erases YOUR copy for good, and it is not a block — if they write
              again the conversation returns, empty. */}
          <p style={{
            margin: 0, padding: '2px 16px 12px', fontSize: 11.5,
            color: TEC_COLORS.subtext, lineHeight: 1.5,
          }}>{a.deleteChatHint}</p>

          {blockError && (
            <p style={{ color: TEC_COLORS.error, fontSize: 12, margin: 0, padding: '0 16px 10px' }}>{a.blockFailed}</p>
          )}
        </section>
      </div>
    </div>
  );
}
