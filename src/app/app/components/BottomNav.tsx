'use client';

// App-shell bottom navigation — same quality bar as tec-assets: vector icons
// (not emoji), glass backdrop, active scale + underline, light haptic.
import { Icon, type ConnIconName } from './Icon';
import { useTranslation } from '@/lib/i18n';

export type ConnTab = 'home' | 'messages' | 'discover' | 'trust' | 'settings';

export function BottomNav({ active, onSelect, badges }: {
  active: ConnTab;
  onSelect: (t: ConnTab) => void;
  /** Unread counts per tab. A message nobody is told about has not arrived. */
  badges?: Partial<Record<ConnTab, number>>;
}) {
  const { t } = useTranslation();
  const ITEMS: { key: ConnTab; icon: ConnIconName; label: string }[] = [
    { key: 'home',     icon: 'home',     label: t.connection.nav.home     },
    { key: 'messages', icon: 'message',  label: t.app.messages           },
    { key: 'discover', icon: 'users',    label: t.connection.nav.discover },
    { key: 'trust',    icon: 'shield',   label: t.connection.nav.trust    },
    { key: 'settings', icon: 'settings', label: t.connection.nav.settings },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(5,8,22,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {ITEMS.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => { navigator.vibrate?.(8); onSelect(item.key); }}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              position: 'relative', flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5, padding: '10px 0 12px',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <div style={{ position: 'relative', transform: isActive ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s' }}>
              <Icon name={item.icon} size={21} color={isActive ? '#FBB44A' : '#3a3a4a'} strokeWidth={isActive ? 2.2 : 1.9} />
              {(badges?.[item.key] ?? 0) > 0 && (
                <span style={{
                  position: 'absolute', top: -5, insetInlineEnd: -8,
                  minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                  display: 'grid', placeItems: 'center',
                  fontSize: 9.5, fontWeight: 800, background: '#FBB44A', color: '#0a0800',
                }}>{Math.min(badges?.[item.key] ?? 0, 99)}</span>
              )}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: isActive ? '#FBB44A' : '#3a3a4a', transition: 'color 0.2s' }}>
              {item.label}
            </div>
            {isActive && (
              <div style={{ position: 'absolute', bottom: 0, width: 20, height: 2, borderRadius: 1, background: '#FBB44A' }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
