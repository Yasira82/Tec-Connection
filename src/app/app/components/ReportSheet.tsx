'use client';

// Report — one sheet, three surfaces (a person, a message, a status).
//
// Two things it says out loud, because a reporting flow that leaves them unsaid
// misleads the person using it:
//
//   · Reporting does NOT remove anything. A person who taps "report" and then
//     watches the content stay put concludes the button is broken. It is not —
//     a human reviews it, and nothing here is auto-hidden because "auto-hide
//     after N reports" would hand any coordinated group a removal tool.
//
//   · Blocking is what stops contact NOW. It is offered in the same sheet,
//     because the thing that actually helps someone in the moment is not the
//     report.
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

export type ReportKind = 'user' | 'message' | 'story';

const REASONS = ['spam', 'scam', 'harassment', 'sexual', 'violence', 'other'] as const;
type Reason = (typeof REASONS)[number];

export function ReportSheet({ kind, target, author, onClose, onBlock }: {
  kind: ReportKind;
  /** The username, message id, or status id. */
  target: string;
  /** Shown so the reporter can see who this is about. Not sent — the service
      resolves the author from the target itself. */
  author?: string;
  onClose: () => void;
  /** Offered alongside; the thing that actually ends contact now. */
  onBlock?: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const submit = async () => {
    if (!reason) return;
    setState('sending');
    try {
      const res = await fetch('/api/bff/connection/reports', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, target, reason, note: note.trim() || undefined }),
      });
      setState(res.ok ? 'done' : 'failed');
    } catch { setState('failed'); }
  };

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={a.report}
      style={{
        position: 'fixed', inset: 0, zIndex: 960,
        background: 'rgba(3,5,12,0.72)', display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '86vh', overflowY: 'auto',
          background: TEC_COLORS.surface,
          borderStartStartRadius: 20, borderStartEndRadius: 20,
          border: `1px solid ${TEC_COLORS.border}`, borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 6px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: TEC_COLORS.border }} />
        </div>

        {state === 'done' ? (
          // Not "removed", not "we will act". What actually happened, and what
          // the person can still do themselves.
          <div style={{ padding: '18px 18px 6px', display: 'grid', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEC_COLORS.text }}>{a.reportSent}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: TEC_COLORS.subtext, lineHeight: 1.6 }}>
              {a.reportSentHint}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {onBlock && (
                <button
                  onClick={() => { onBlock(); onClose(); }}
                  style={{
                    background: `${TEC_COLORS.error}14`, border: `1px solid ${TEC_COLORS.error}66`,
                    color: TEC_COLORS.error, borderRadius: 999, padding: '9px 18px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >{a.block}</button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.text,
                  borderRadius: 999, padding: '9px 18px', fontSize: 13, cursor: 'pointer',
                }}
              >{a.closeLabel}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 18px 6px', display: 'grid', gap: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEC_COLORS.text }}>{a.report}</h4>
              {author && (
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: TEC_COLORS.subtext }}>
                  <bdi>@{author}</bdi>
                </p>
              )}
            </div>

            {/* Said BEFORE the report is filed, not after. */}
            <p style={{
              margin: 0, padding: '9px 12px', borderRadius: 10, lineHeight: 1.6,
              background: `${TEC_COLORS.gold}12`, border: `1px solid ${TEC_COLORS.gold}33`,
              fontSize: 11.5, color: TEC_COLORS.text,
            }}>{a.reportNotice}</p>

            <div style={{ display: 'grid', gap: 6 }}>
              {REASONS.map((r) => (
                <button
                  key={r} onClick={() => setReason(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    textAlign: 'start', cursor: 'pointer',
                    padding: '11px 14px', borderRadius: 12, fontSize: 13.5,
                    background: reason === r ? `${TEC_COLORS.gold}14` : 'none',
                    border: `1px solid ${reason === r ? TEC_COLORS.gold : TEC_COLORS.border}`,
                    color: TEC_COLORS.text, fontWeight: reason === r ? 700 : 500,
                  }}
                >
                  <span aria-hidden style={{
                    width: 16, height: 16, borderRadius: 999, flexShrink: 0,
                    border: `2px solid ${reason === r ? TEC_COLORS.gold : TEC_COLORS.border}`,
                    background: reason === r ? TEC_COLORS.gold : 'transparent',
                  }} />
                  <span>{a[`reason_${r}` as keyof typeof a] as string}</span>
                </button>
              ))}
            </div>

            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={a.reportNotePlaceholder} maxLength={500} dir="auto"
              style={{
                background: TEC_COLORS.bg, color: TEC_COLORS.text, fontSize: 13.5,
                border: `1px solid ${TEC_COLORS.border}`, borderRadius: 12,
                padding: '10px 14px', outline: 'none',
              }}
            />

            {state === 'failed' && (
              <p style={{ margin: 0, color: TEC_COLORS.error, fontSize: 12 }}>{a.reportFailed}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={submit} disabled={!reason || state === 'sending'}
                style={{
                  background: reason
                    ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`
                    : TEC_COLORS.surface2,
                  color: reason ? '#0a0800' : TEC_COLORS.subtext,
                  border: 'none', borderRadius: 999, padding: '10px 22px',
                  fontSize: 13.5, fontWeight: 700, cursor: reason ? 'pointer' : 'not-allowed',
                }}
              >{state === 'sending' ? a.sending : a.reportSubmit}</button>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: TEC_COLORS.subtext,
                  padding: '10px 14px', fontSize: 13.5, cursor: 'pointer',
                }}
              >{a.cancel}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
