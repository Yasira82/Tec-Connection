'use client';

// What "delete" means, asked rather than assumed.
//
// The button used to be one word with one meaning: clear it for both sides.
// That is the more consequential of the two senses, and it was the only one on
// offer — so tidying your own view was impossible, and retracting something was
// the only thing the control could do.
//
// Both are here now, each labelled with what it actually does, because the
// difference is not obvious from the verb:
//
//   · for me       — your copy only. Nobody else sees a change, and nothing
//                    marks the place it was.
//   · for everyone — the words and the attachment are cleared on both sides and
//                    "this message was deleted" takes its place. Your own
//                    messages only; the option is simply absent otherwise,
//                    rather than shown and refused.
import { useEffect } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';

function Choice({ label, hint, onClick, danger = true }: {
  label: string; hint: string; onClick: () => void;
  /** Red by default — this sheet began life as two deletes. */
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer',
        padding: '13px 16px', background: 'none', border: 'none',
      }}
    >
      <span style={{
        display: 'block', fontSize: 14.5, fontWeight: 600,
        color: danger ? TEC_COLORS.error : TEC_COLORS.text,
      }}>{label}</span>
      <span style={{ display: 'block', fontSize: 11.5, color: TEC_COLORS.subtext, marginTop: 2, lineHeight: 1.45 }}>
        {hint}
      </span>
    </button>
  );
}

/** The six the service accepts. Anything else is refused there, so nothing else is offered here. */
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export function MessageActions({
  mine, deleted, onReply, onDelete, onReport, onClose,
  onReact, myReactions = [], canEdit, onEdit, onForward, canPin, pinned, onPin,
}: {
  /** Only the sender may clear a message for both sides. */
  mine: boolean;
  /** A tombstone can still be removed from your own copy. */
  deleted: boolean;
  /** Answer this specific message. Absent on a tombstone — there is nothing to quote. */
  onReply?: () => void;
  onDelete: (scope: 'me' | 'everyone') => void;
  /** Absent for your own message — reporting yourself is not a thing. */
  onReport?: () => void;
  onClose: () => void;
  /** React, or take one back. `on` is the END state, never a toggle. */
  onReact?: (emoji: string, on: boolean) => void;
  /** Which of the six this caller has already used, so the row shows it. */
  myReactions?: string[];
  /**
   * Whether the edit is still open. Computed by the caller from the send time —
   * offering an option the server will refuse is worse than not offering it.
   */
  canEdit?: boolean;
  onEdit?: () => void;
  onForward?: () => void;
  /** Group: owner/admin only. Direct: either person. */
  canPin?: boolean;
  /** Whether THIS message is the pinned one, so the label says pin or unpin. */
  pinned?: boolean;
  onPin?: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  useBackButton(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={a.deleteMessage}
      style={{
        position: 'fixed', inset: 0, zIndex: 950,
        background: 'rgba(3,5,12,0.72)', display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: TEC_COLORS.surface,
          borderStartStartRadius: 20, borderStartEndRadius: 20,
          border: `1px solid ${TEC_COLORS.border}`, borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 6px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: TEC_COLORS.border }} />
        </div>

        {/* The reactions, at the very top and as one tap.
            A reaction is the cheapest thing on this menu and the most used —
            burying it under four rows of text would make writing "ok" easier
            than tapping 👍, which is the opposite of the point. Tapping one you
            already gave takes it back. */}
        {onReact && !deleted && (
          <div style={{
            display: 'flex', gap: 4, padding: '4px 10px 12px',
            justifyContent: 'space-between', borderBottom: `1px solid ${TEC_COLORS.border}`,
          }}>
            {REACTIONS.map((e) => {
              const on = myReactions.includes(e);
              return (
                <button
                  key={e}
                  onClick={() => { onReact(e, !on); onClose(); }}
                  aria-label={e} aria-pressed={on}
                  style={{
                    flex: 1, minWidth: 0, padding: '8px 0', fontSize: 22, lineHeight: 1,
                    cursor: 'pointer', borderRadius: 12,
                    background: on ? `${TEC_COLORS.gold}22` : 'none',
                    border: `1px solid ${on ? `${TEC_COLORS.gold}66` : 'transparent'}`,
                  }}
                >{e}</button>
              );
            })}
          </div>
        )}

        {/* First, and not a destructive action: replying is the thing people
            open this menu for most, and it should not sit under two deletes. */}
        {onReply && !deleted && (
          <div style={{ borderBottom: `1px solid ${TEC_COLORS.border}` }}>
            <Choice danger={false} label={a.reply} hint={a.replyHint} onClick={() => { onReply(); onClose(); }} />
          </div>
        )}

        {/* Editing is offered only while the window is open. An option that is
            always shown and sometimes refused teaches people to distrust the
            menu. */}
        {onEdit && canEdit && !deleted && (
          <div style={{ borderBottom: `1px solid ${TEC_COLORS.border}` }}>
            <Choice danger={false} label={a.editMessage} hint={a.editMessageHint} onClick={() => { onEdit(); onClose(); }} />
          </div>
        )}

        {onForward && !deleted && (
          <div style={{ borderBottom: `1px solid ${TEC_COLORS.border}` }}>
            <Choice danger={false} label={a.forward} hint={a.forwardHint} onClick={() => { onForward(); onClose(); }} />
          </div>
        )}

        {onPin && canPin && !deleted && (
          <div style={{ borderBottom: `1px solid ${TEC_COLORS.border}` }}>
            <Choice
              danger={false}
              label={pinned ? a.unpinMessage : a.pinMessage}
              hint={pinned ? a.unpinMessageHint : a.pinMessageHint}
              onClick={() => { onPin(!pinned); onClose(); }}
            />
          </div>
        )}

        <Choice
          label={a.deleteForMe} hint={a.deleteForMeHint}
          onClick={() => { onDelete('me'); onClose(); }}
        />

        {/* Absent, not disabled: an option you can never take should not be on
            the menu explaining why. */}
        {mine && !deleted && (
          <div style={{ borderTop: `1px solid ${TEC_COLORS.border}` }}>
            <Choice
              label={a.deleteForEveryone} hint={a.deleteForEveryoneHint}
              onClick={() => { onDelete('everyone'); onClose(); }}
            />
          </div>
        )}

        {/* Reporting is not deleting, so it is not red and it is not grouped
            with the two that are. It only appears on someone else's message —
            reporting your own is not a thing. */}
        {!mine && !deleted && onReport && (
          <div style={{ borderTop: `1px solid ${TEC_COLORS.border}` }}>
            <button
              onClick={() => { onReport(); onClose(); }}
              style={{
                display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer',
                padding: '13px 16px', background: 'none', border: 'none',
              }}
            >
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: TEC_COLORS.text }}>
                {a.report}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: TEC_COLORS.subtext, marginTop: 2, lineHeight: 1.45 }}>
                {a.reportHint}
              </span>
            </button>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${TEC_COLORS.border}` }}>
          <button
            onClick={onClose}
            style={{
              display: 'block', width: '100%', padding: '13px 16px', textAlign: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14.5, fontWeight: 600, color: TEC_COLORS.text,
            }}
          >{a.cancel}</button>
        </div>
      </div>
    </div>
  );
}
