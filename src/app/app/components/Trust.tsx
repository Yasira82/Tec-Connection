'use client';

// TEC Connection (C-107) — Trust Graph. Trust is DERIVED from real economic
// activity (paid orders), not vanity metrics — and it is EVENTUAL, never
// presented as financial truth (the owning services are the source).
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTrust, type TrustSide } from '@/lib-client/connection/useTrust';

const card = {
  background:   TEC_COLORS.surface,
  border:       `1px solid ${TEC_COLORS.border}`,
  borderRadius: 16,
  padding:      '20px 22px',
} as const;

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

function Side({ title, hint, side }: { title: string; hint: string; side: TrustSide }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEC_COLORS.text }}>{title}</span>
        <span style={{ fontSize: 11, color: TEC_COLORS.subtext }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: TEC_COLORS.gold }}>{side.partners}
          <span style={{ fontSize: 11, fontWeight: 600, color: TEC_COLORS.subtext }}> partners</span></span>
        <span style={{ fontSize: 20, fontWeight: 900, color: TEC_COLORS.text }}>{side.orders}
          <span style={{ fontSize: 11, fontWeight: 600, color: TEC_COLORS.subtext }}> orders</span></span>
        <span style={{ fontSize: 20, fontWeight: 900, color: TEC_COLORS.text }}>π {side.volume}</span>
      </div>
      {side.edges.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {side.edges.slice(0, 5).map((e, i) => (
            <div key={e.user_id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: TEC_COLORS.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortId(e.user_id)}
              </span>
              <span style={{ fontSize: 12, color: TEC_COLORS.subtext, whiteSpace: 'nowrap' }}>{e.orders}× · π {e.volume}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Trust() {
  const { trust, loading, error } = useTrust();
  const empty = trust.given.partners === 0 && trust.received.partners === 0;

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>Trust</h2>
        <span style={{ fontSize: 12, color: TEC_COLORS.subtext }}>earned from real activity</span>
      </div>

      <div style={{ ...card, display: 'grid', gap: 16 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: 0 }}>Loading…</p>
        ) : error || empty ? (
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: 0, lineHeight: 1.6 }}>
            No trust signals yet. Trust builds from real economic activity — as you
            complete purchases and sales across TEC, verified trust edges appear here.
          </p>
        ) : (
          <>
            <Side title="Trust you've extended" hint="sellers you've paid" side={trust.given} />
            <div style={{ height: 1, background: TEC_COLORS.border }} />
            <Side title="Trust you've earned" hint="buyers who paid you" side={trust.received} />
          </>
        )}
        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: 0, lineHeight: 1.5 }}>
          Derived from paid orders (eventual). Connection never re-derives transaction
          truth — payment &amp; order truth stay with their owning services (C-107).
        </p>
      </div>
    </section>
  );
}
