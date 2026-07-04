'use client';

// TEC Connection — System of Record (Relationships). C-107.
// The user's economic relationship graph: connections (social + business),
// trust signals derived from real activity, reputation, and collaboration
// context. Connections are sovereign — the user controls their own graph.
import { usePiAuth } from '@yasser172/tec-auth';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { Connections } from './components/Connections';

const card = {
  background:   TEC_COLORS.surface,
  border:       `1px solid ${TEC_COLORS.border}`,
  borderRadius: 16,
  padding:      '20px 22px',
} as const;

function Pillar({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{ ...card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>{title}</h2>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: TEC_COLORS.gold,
          border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '2px 10px',
        }}>Soon</span>
      </div>
      <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: '10px 0 0', lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

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

        {/* Slice 1 — Follow / Connect (live, self-declared social graph) */}
        <Connections />

        {/* Next slices — trust signals + collaboration (still to build) */}
        <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          <Pillar
            emoji="🛡️"
            title="Trust"
            body="Trust built from real economic activity, not vanity metrics. Completed payments and collaborations become verifiable trust signals (eventual)."
          />
          <Pillar
            emoji="✨"
            title="Collaboration"
            body="Shared context for working together — the relationship baseline that powers discovery, recommendations, and joint ventures across the ecosystem."
          />
        </div>

        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '18px 0 0', lineHeight: 1.5 }}>
          Connection is the Economic Relationship Infrastructure (C-107). It owns the
          trust graph — never identity, payment, or asset truth, which stay with their
          owning services and are referenced by ID only.
        </p>
      </div>
    </main>
  );
}
