'use client';

// TEC Connection — System of Record (Relationships). C-107.
// The user's economic relationship graph: connections (social + business),
// trust signals derived from real activity, reputation, and collaboration
// context. Connections are sovereign — the user controls their own graph.
import { usePiAuth } from '@yasser172/tec-auth';
import { InviteCard } from '@/components/referral/InviteCard';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { Connections } from './components/Connections';
import { Discover } from './components/Discover';
import { NetworkInsights } from './components/NetworkInsights';
import { Trust } from './components/Trust';
import { Notifications } from './components/Notifications';
import { Collaboration } from './components/Collaboration';
import { ConnectionPro } from './components/ConnectionPro';

export default function ConnectionHome() {
  const { user, isLoading } = usePiAuth();
  const name = user?.piUsername ? `@${user.piUsername}` : 'there';

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, padding: '32px 22px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header>
          <div style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>TEC Connection · System of Record</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TEC_COLORS.gold, margin: '6px 0 0' }}>
            {isLoading ? 'Welcome' : `Welcome, ${name}`}
          </h1>
          <p style={{ fontSize: 14, color: TEC_COLORS.subtext, margin: '6px 0 0', lineHeight: 1.6 }}>
            Your relationship graph in the TEC ecosystem. Your connections are yours
            (C-107) — you control who you trust and who can see it.
          </p>
        </header>

        {/* Connection Pro — real Pi U2A payment (also the Pi Portal "Process a Transaction" step) */}
        <ConnectionPro />

        {/* Relationship notifications ("X followed you") */}
        <Notifications />

        {/* Slice 1 — Follow / Connect (live, self-declared social graph) */}
        <Connections />

        {/* Discover — opt-in public directory: find + follow people (Pro = Featured reach) */}
        <Discover />

        {/* Network Insights (Connection Pro) — who follows you + mutual + follow-back */}
        <NetworkInsights />

        {/* Slice 2 — Trust Graph (live, derived from paid orders / order.paid.v1) */}
        <Trust />

        {/* Collaboration — shared collections (live) */}
        <Collaboration />

        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '18px 0 0', lineHeight: 1.5 }}>
          Connection is the Economic Relationship Infrastructure (C-107). It owns the
          trust graph — never identity, payment, or asset truth, which stay with their
          owning services and are referenced by ID only.
        </p>
        <InviteCard />
      </div>
    </main>
  );
}
