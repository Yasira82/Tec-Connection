'use client';

// TEC Connection — System of Record (Relationships). C-107.
//
// ── The information architecture, and why it changed ─────────────────────────
// Each tab now has ONE job and says it ONCE. The previous version repeated the
// screen's name three times (page title → section heading → tab label), opened
// the Discover tab with the user's own profile FORM rather than with people, and
// ended every card with a paragraph explaining the product's principles. The
// result read as documentation with buttons in it.
//
// The rules applied here:
//   · The page header is the only title. Sections no longer repeat it.
//   · Discover is for finding people. Editing your own card is a Settings task,
//     so it moved there — a tab called Discover should not be half a form.
//   · Principles (verification is presented, Featured is reach only) are stated
//     once per screen, small, at the bottom — not after every card.
import { useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useMe } from '@/lib-client/hooks/useMe';
import { InviteCard } from '@/components/referral/InviteCard';
import { BottomNav, type ConnTab } from './components/BottomNav';
import { SettingsView } from './components/SettingsView';
import { Connections } from './components/Connections';
import { Discover } from './components/Discover';
import { NetworkInsights } from './components/NetworkInsights';
import { Trust } from './components/Trust';
import { Notifications } from './components/Notifications';
import { Collaboration } from './components/Collaboration';

export default function ConnectionHome() {
  const { user, isLoading } = usePiAuth();
  const me = useMe(); // server-resolved Pi username (Pi Browser hides tec_user from client JS — C-123 §3)
  const { t } = useTranslation();
  const [tab, setTab] = useState<ConnTab>('home');

  const piName = me.username ?? user?.piUsername ?? null;
  const name = piName ? `@${piName}` : '';

  // One title, one subtitle, per screen. The subtitle says what the tab is FOR
  // in a few words — it is not a place to explain the platform.
  const heading: Record<ConnTab, { title: string; sub: string }> = {
    home:     { title: isLoading || !name ? t.connection.welcome : name, sub: t.connection.nav.homeSub },
    discover: { title: t.connection.nav.discover, sub: t.connection.nav.discoverSub },
    trust:    { title: t.connection.nav.trust,    sub: t.connection.nav.trustSub },
    settings: { title: t.connection.nav.settings, sub: '' },
  };
  const { title, sub } = heading[tab];

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px calc(96px + env(safe-area-inset-bottom))' }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, color: TEC_COLORS.subtext, textTransform: 'uppercase', fontWeight: 700 }}>
            {t.connection.brand}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TEC_COLORS.gold, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {sub && (
            <p style={{ fontSize: 13.5, color: TEC_COLORS.subtext, margin: '5px 0 0', lineHeight: 1.5 }}>{sub}</p>
          )}
        </header>

        {/* HOME — what happened, and who you follow. Nothing to configure here. */}
        {tab === 'home' && (
          <>
            <Notifications />
            <Connections />
            <InviteCard />
          </>
        )}

        {/* DISCOVER — people. The profile editor lives in Settings. */}
        {tab === 'discover' && (
          <>
            <Discover />
            <NetworkInsights />
          </>
        )}

        {/* TRUST — what real activity says, plus shared collections. */}
        {tab === 'trust' && (
          <>
            <Trust />
            <Collaboration />
          </>
        )}

        {/* SETTINGS — your card, Pro, your language, your account. */}
        {tab === 'settings' && <SettingsView />}
      </div>

      <BottomNav active={tab} onSelect={setTab} />
    </main>
  );
}
