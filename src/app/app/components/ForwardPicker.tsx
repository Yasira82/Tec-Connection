'use client';

// Where to send this message next.
//
// A list of the conversations you are already in — nothing else. Forwarding is
// the one action that deliberately moves words across a privacy boundary, and
// the safest surface for it is one that cannot express a destination you do not
// belong to. The service re-checks membership of both sides anyway; this just
// means the mistake is unavailable rather than refused.
//
// One tap sends, and the sheet says so before it closes. A silent close after a
// forward reads as "nothing happened" and gets tapped again — which sends the
// message twice, into a conversation the person is not looking at.
import { useState } from 'react';
import { C, bgA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import type { Summary } from '@/lib-client/connection/useMessages';

export function ForwardPicker({ conversations, exceptId, onPick, onClose }: {
  conversations: Summary[];
  /** The thread the message is already in. Not offered — the service refuses it. */
  exceptId: string;
  onPick: (id: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useBackButton(true, onClose);

  const rows = conversations.filter((c) => c.id !== exceptId);

  const send = async (c: Summary) => {
    setBusy(c.id); setFailed(false);
    const ok = await onPick(c.id);
    setBusy(null);
    if (ok) {
      setSent(c.id);
      // Long enough to read the confirmation, short enough not to feel stuck.
      setTimeout(onClose, 900);
    } else {
      setFailed(true);
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={a.forward}
      style={{
        position: 'fixed', inset: 0, zIndex: 955,
        background: bgA(0.72), display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '70vh', overflowY: 'auto',
          background: C.surface,
          borderStartStartRadius: 20, borderStartEndRadius: 20,
          border: `1px solid ${C.border}`, borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 6px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: C.border }} />
        </div>
        <h3 style={{ margin: 0, padding: '4px 16px 10px', fontSize: 15, fontWeight: 800, color: C.text }}>
          {a.forwardTo}
        </h3>

        {failed && (
          <p style={{ margin: 0, padding: '0 16px 10px', fontSize: 12.5, color: C.error }}>
            {a.forwardFailed}
          </p>
        )}

        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '0 16px 16px', fontSize: 13, color: C.subtext, lineHeight: 1.5 }}>
            {a.forwardNowhere}
          </p>
        ) : rows.map((c) => (
          <button
            key={c.id}
            onClick={() => { void send(c); }}
            disabled={busy !== null || sent !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 16px', textAlign: 'start',
              background: 'none', border: 'none', borderTop: `1px solid ${C.border}`,
              cursor: busy || sent ? 'default' : 'pointer',
              opacity: busy && busy !== c.id ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <bdi dir="auto">{c.kind === 'GROUP' ? (c.title ?? '') : `@${c.peer ?? ''}`}</bdi>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: sent === c.id ? C.success : C.gold, flexShrink: 0 }}>
              {sent === c.id ? a.forwardSent : busy === c.id ? '…' : a.send}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
