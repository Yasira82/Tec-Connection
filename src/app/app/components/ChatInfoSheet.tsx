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
import { downscaleImage, AVATAR_MAX_EDGE } from '@/lib-client/connection/downscaleImage';
import { useJoinRequests } from '@/lib-client/connection/useGroupDiscovery';

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
  isGroup, title, members, role, me, onClose, convId, visibility, description,
  admins = [], ownerName, onRemoved,
  onAddMember, onLeave, onDelete, onClear,
  blocked, onBlock, onUnblock, blockBusy, blockError, peerName,
}: {
  isGroup: boolean;
  /** Needed for the group photo, which is keyed by the conversation. */
  convId: string;
  /** PUBLIC means the group is findable — not that its contents are readable. */
  visibility?: 'PUBLIC' | 'PRIVATE';
  description?: string | null;
  /** Who helps run the group. The owner is NOT in here — they are `ownerName`. */
  admins?: string[];
  ownerName?: string | null;
  /** So the parent can drop the row from its own copy of the member list. */
  onRemoved?: (username: string) => void;
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

  const isOwner = isGroup && role === 'owner';
  const isAdmin = isGroup && (role === 'owner' || role === 'admin');
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [roster, setRoster] = useState<string[]>(admins ?? []);
  useEffect(() => { setRoster(admins ?? []); }, [admins]);

  const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

  const setRole = async (username: string, makeAdmin: boolean) => {
    setRoleBusy(username);
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(convId)}/members/${encodeURIComponent(username)}/role`,
        {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: makeAdmin ? 'ADMIN' : 'MEMBER' }),
        },
      );
      if (!res.ok) return;
      // Updated locally rather than refetched: the sheet is open over the chat
      // and a reload would collapse it under the thumb that just tapped.
      setRoster((r) => (makeAdmin ? [...r, username] : r.filter((x) => norm(x) !== norm(username))));
    } catch { /* the badge simply does not change */ }
    finally { setRoleBusy(null); }
  };

  const removeFromGroup = async (username: string) => {
    setRoleBusy(username);
    try {
      await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(convId)}/members/${encodeURIComponent(username)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      onRemoved?.(username);
    } catch { /* the row stays; the next open shows the truth */ }
    finally { setRoleBusy(null); }
  };
  const { requests, decide } = useJoinRequests(isOwner ? convId : null, isOwner);
  const [listed, setListed] = useState(visibility === 'PUBLIC');
  const [about, setAbout] = useState(description ?? '');
  const [listBusy, setListBusy] = useState(false);
  const [listMsg, setListMsg] = useState('');

  const saveVisibility = async (next: boolean, desc: string) => {
    setListBusy(true); setListMsg('');
    try {
      const res = await fetch(
        `/api/bff/connection/conversations/${encodeURIComponent(convId)}/visibility`,
        {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: next ? 'PUBLIC' : 'PRIVATE', description: desc.trim() || null }),
        },
      );
      if (!res.ok) { setListMsg(a.groupRequestFailed); return; }
      setListed(next);
    } catch { setListMsg(a.groupRequestFailed); }
    finally { setListBusy(false); }
  };

  const uploadPhoto = async (file: File) => {
    // Type first, on the ORIGINAL: shrinking a format we will not accept is
    // wasted work, and the message should name the real problem.
    if (!PHOTO_ACCEPT.split(',').includes(file.type)) { setPhotoMsg(a.photoWrongType); return; }

    setPhotoBusy(true); setPhotoMsg('');
    try {
      // SHRINK, then check the size. A phone camera produces a 3-6MB photo and
      // the ceiling is 2MB — checking first would reject almost every real
      // picture with "too large" when the browser can simply make it smaller.
      // Best-effort: the original comes back if it cannot, and then the size
      // check below is what catches it, with a sentence the person can act on.
      const blob = await downscaleImage(file, AVATAR_MAX_EDGE);
      if (blob.size > PHOTO_MAX_BYTES) { setPhotoMsg(a.photoTooBig); return; }

      const res = await fetch(groupPhotoUrl, {
        method: 'POST', credentials: 'include',
        // The BLOB's type, not the file's: a re-encoded PNG comes back as JPEG,
        // and a Content-Type that disagrees with the bytes is rejected by the
        // presigned PUT with an opaque signature error.
        headers: { 'Content-Type': blob.type || file.type },
        body: blob,
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

        {/* Listing the group — owner only.
            Deliberately ABOVE the member list: whether strangers can find this
            group is a bigger decision than who is currently in it, and burying
            it under the roster is how a privacy switch gets flipped by
            accident. */}
        {isOwner && (
          <section style={{ borderTop: `1px solid ${TEC_COLORS.border}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEC_COLORS.text }}>
                  {listed ? a.groupListed : a.groupPrivate}
                </div>
                <div style={{ fontSize: 11.5, color: TEC_COLORS.subtext, marginTop: 3, lineHeight: 1.5 }}>
                  {listed ? a.groupListedHint : a.groupPrivateHint}
                </div>
              </div>
              <button
                onClick={() => { void saveVisibility(!listed, about); }}
                disabled={listBusy}
                aria-pressed={listed}
                style={{
                  width: 46, height: 27, borderRadius: 999, flexShrink: 0, padding: 2,
                  border: `1px solid ${listed ? TEC_COLORS.gold : TEC_COLORS.border}`,
                  background: listed ? `${TEC_COLORS.gold}33` : 'transparent',
                  cursor: listBusy ? 'not-allowed' : 'pointer',
                  display: 'flex', justifyContent: listed ? 'flex-end' : 'flex-start',
                }}
              >
                <span style={{
                  width: 21, height: 21, borderRadius: 999, display: 'block',
                  background: listed ? TEC_COLORS.gold : TEC_COLORS.subtext,
                }} />
              </button>
            </div>

            {/* The description is what a stranger reads before deciding to ask,
                so it only matters once the group is findable. */}
            {listed && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  style={sheetInput} value={about} onChange={(e) => setAbout(e.target.value)}
                  placeholder={a.groupDescriptionPlaceholder} maxLength={300} dir="auto"
                />
                <button
                  onClick={() => { void saveVisibility(true, about); }}
                  disabled={listBusy}
                  style={{
                    background: 'none', border: `1px solid ${TEC_COLORS.border}`,
                    color: TEC_COLORS.text, borderRadius: 999, padding: '0 16px',
                    fontSize: 13, cursor: listBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >{a.save}</button>
              </div>
            )}
            {listMsg && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: TEC_COLORS.error }}>{listMsg}</p>
            )}
          </section>
        )}

        {/* People asking to join. Shown whenever there are any, whether or not
            the group is currently listed: un-listing does not withdraw the
            requests already made, and leaving them undecidable would strand
            whoever sent them. */}
        {isOwner && requests.length > 0 && (
          <section style={{ borderTop: `1px solid ${TEC_COLORS.border}`, padding: '14px 16px' }}>
            <h4 style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
              textTransform: 'uppercase', color: TEC_COLORS.subtext,
            }}>{a.groupRequests} · {requests.length}</h4>

            {requests.map((r) => (
              <div key={r.username} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              }}>
                <Avatar username={r.username} size={32} tryPhoto />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13.5, color: TEC_COLORS.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <bdi>@{r.username}</bdi>
                </span>
                <button
                  onClick={() => { void decide(r.username, true); }}
                  style={{
                    background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
                    color: '#0a0800', border: 'none', borderRadius: 999,
                    padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  }}
                >{a.groupApprove}</button>
                <button
                  onClick={() => { void decide(r.username, false); }}
                  style={{
                    background: 'none', border: `1px solid ${TEC_COLORS.border}`,
                    color: TEC_COLORS.subtext, borderRadius: 999,
                    padding: '6px 12px', fontSize: 12.5, cursor: 'pointer',
                  }}
                >{a.groupReject}</button>
              </div>
            ))}
          </section>
        )}

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
                const isTheOwner = !!ownerName && norm(u) === norm(ownerName);
                const isAnAdmin = roster.some((x) => norm(x) === norm(u));
                // Who this caller may act on. Mirrors the service exactly —
                // showing a control the server will refuse is worse than not
                // showing it, because the refusal arrives as a silent failure.
                const canPromote = isOwner && !mine && !isTheOwner;
                const canRemove = !mine && !isTheOwner && (isOwner || (isAdmin && !isAnAdmin));

                return (
                  <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <Avatar username={u} size={32} tryPhoto />
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13.5, color: TEC_COLORS.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}><bdi>@{u}</bdi></span>

                    {/* The badge says what someone IS; the buttons say what you
                        may do about it. Keeping them separate means a member
                        with no controls still sees who runs the group. */}
                    {(isTheOwner || isAnAdmin) && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, flexShrink: 0,
                        textTransform: 'uppercase', borderRadius: 999, padding: '2px 8px',
                        color: isTheOwner ? TEC_COLORS.gold : TEC_COLORS.subtext,
                        background: isTheOwner ? `${TEC_COLORS.gold}14` : 'transparent',
                        border: `1px solid ${isTheOwner ? `${TEC_COLORS.gold}44` : TEC_COLORS.border}`,
                      }}>{isTheOwner ? a.roleOwner : a.roleAdmin}</span>
                    )}
                    {mine && (
                      <span style={{ fontSize: 11, color: TEC_COLORS.subtext, flexShrink: 0 }}>{a.you}</span>
                    )}

                    {canPromote && (
                      <button
                        onClick={() => { void setRole(u, !isAnAdmin); }}
                        disabled={roleBusy === u}
                        style={{
                          background: 'none', border: `1px solid ${TEC_COLORS.border}`,
                          color: TEC_COLORS.text, borderRadius: 999, padding: '4px 10px',
                          fontSize: 11.5, cursor: roleBusy === u ? 'not-allowed' : 'pointer',
                          flexShrink: 0, whiteSpace: 'nowrap',
                        }}
                      >{isAnAdmin ? a.demoteAdmin : a.makeAdmin}</button>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => { void removeFromGroup(u); }}
                        disabled={roleBusy === u}
                        aria-label={a.removeMember}
                        style={{
                          background: 'none', border: 'none', color: TEC_COLORS.error,
                          fontSize: 15, padding: '2px 6px', flexShrink: 0,
                          cursor: roleBusy === u ? 'not-allowed' : 'pointer',
                        }}
                      >✕</button>
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
