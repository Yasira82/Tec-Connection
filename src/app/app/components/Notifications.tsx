'use client';

// TEC Connection (C-107) — relationship notifications ("X followed you"). A
// collapsible banner with an unread badge; durable + own-scope, polled (near-live).
import { useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useNotifications } from '@/lib-client/connection/useNotifications';

// The verb is passed in rather than closed over: this helper lives at module
// scope, outside any component, so it cannot read the locale context itself.
const label = (type: string, actor: string, followedYou: string) =>
  type === 'follow' ? `@${actor} ${followedYou}` : `@${actor} · ${type}`;

const fmt = (iso: string) => { try { return new Date(iso).toLocaleDateString(); } catch { return ''; } };

export function Notifications() {
  const { t } = useTranslation();
  const a = t.app;
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) void markAllRead();
  };

  return (
    <div style={{
      marginTop: 20, background: TEC_COLORS.surface, border: `1px solid ${unread > 0 ? `${TEC_COLORS.gold}66` : TEC_COLORS.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <button onClick={toggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'none', border: 'none', cursor: 'pointer', color: TEC_COLORS.text, textAlign: 'left',
      }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{a.notifications}</span>
        {unread > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 800, color: '#0a0800', background: TEC_COLORS.gold,
            borderRadius: 999, minWidth: 20, height: 20, display: 'grid', placeItems: 'center', padding: '0 6px',
          }}>{unread}</span>
        )}
        <span style={{ fontSize: 12, color: TEC_COLORS.subtext }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 12px' }}>
          {items.slice(0, 15).map((n, i) => (
            <div key={n.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? `1px solid ${TEC_COLORS.border}` : `1px solid ${TEC_COLORS.border}` }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: n.read ? 'transparent' : TEC_COLORS.gold, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <bdi>{label(n.type, n.actor, a.followedYou)}</bdi>
              </span>
              <span style={{ fontSize: 11, color: TEC_COLORS.subtext, flexShrink: 0 }}>{fmt(n.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
