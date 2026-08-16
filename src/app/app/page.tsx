'use client';

// TEC Connection — System of Record (Relationships). C-107.
// App shell: a Home / Discover / Trust / Settings bottom-nav experience (not a long
// scroll), so Connection feels like a real app. The user's economic relationship
// graph — connections, trust signals, reputation — is sovereign (the user controls it).
import { useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { InviteCard } from '@/components/referral/InviteCard';
import { BottomNav, type ConnTab } from './components/BottomNav';
import { SettingsView } from './components/SettingsView';
import { Connections } from './components/Connections';
import { Discover } from './components/Discover';
import { NetworkInsights } from './components/NetworkInsights';
import { Trust } from './components/Trust';
import { Notifications } from './components/Notifications';
import { Collaboration } from './components/Collaboration';
import { ConnectionPro } from './components/ConnectionPro';

export default function ConnectionHome() {
  const { user, isLoading } = usePiAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<ConnTab>('home');

  const name = user?.piUsername ? `@${user.piUsername}` : '';
  const title =
    tab === 'discover' ? t.connection.nav.discover
    : tab === 'trust'  ? t.connection.nav.trust
    : tab === 'settings' ? t.connection.nav.settings
    : (isLoading || !name ? t.connection.welcome : t.connection.welcomeName.replace('{name}', name));

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 22px calc(96px + env(safe-area-inset-bottom))' }}>
        <header>
          <div style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>{t.connection.brand}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TEC_COLORS.gold, margin: '6px 0 0' }}>{title}</h1>
          {tab === 'home' && (
            <p style={{ fontSize: 14, color: TEC_COLORS.subtext, margin: '6px 0 0', lineHeight: 1.6 }}>
              {t.connection.subtitle}
            </p>
          )}
        </header>

        {tab === 'home' && (
          <>
            {/* Connection Pro — real Pi U2A payment (also the Pi Portal "Process a Transaction" step) */}
            <ConnectionPro />
            {/* Relationship notifications ("X followed you") */}
            <Notifications />
            {/* Slice 1 — Follow / Connect (live, self-declared social graph) */}
            <Connections />
            <InviteCard />
          </>
        )}

        {tab === 'discover' && (
          <>
            {/* Discover — opt-in public directory: find + follow people (Pro = Featured reach) */}
            <Discover />
            {/* Network Insights (Connection Pro) — who follows you + mutual + follow-back */}
            <NetworkInsights />
          </>
        )}

        {tab === 'trust' && (
          <>
            {/* Trust Graph (live, derived from paid orders / order.paid.v1) */}
            <Trust />
            {/* Collaboration — shared collections (live) */}
            <Collaboration />
          </>
        )}

        {tab === 'settings' && <SettingsView />}
      </div>

      <BottomNav active={tab} onSelect={setTab} />
    </main>
  );
}
