'use client';

// TEC Connection (C-107) — Trust Graph. Trust is DERIVED from real economic
// activity (paid orders), not vanity metrics — and it is EVENTUAL, never
// presented as financial truth (the owning services are the source).
import { C } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useTrust, type TrustSide } from '@/lib-client/connection/useTrust';

const card = {
  background:   C.surface,
  border:       `1px solid ${C.border}`,
  borderRadius: 16,
  padding:      '20px 22px',
} as const;

function Side({ title, hint, label, partnersLbl, ordersLbl, side }: { title: string; hint: string; label: string; partnersLbl: string; ordersLbl: string; side: TrustSide }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
        <span style={{ fontSize: 11, color: C.subtext }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>{side.partners}
          <span style={{ fontSize: 11, fontWeight: 600, color: C.subtext }}> {partnersLbl}</span></span>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{side.orders}
          <span style={{ fontSize: 11, fontWeight: 600, color: C.subtext }}> {ordersLbl}</span></span>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.text }}>π {side.volume}</span>
      </div>
      {/* The per-partner rows used to be labelled with the raw counterparty id —
          `afa10f…c983`. That is a commerce user id: it identifies nobody to the
          person reading it, and a screen full of hashes is why this tab looked
          like a debug view. The rows stay (each is a real relationship) but are
          labelled by position until the id can be resolved to a Pi username,
          which needs a lookup Connection does not have today. A meaningless
          label is worse than an honest ordinal. */}
      {side.edges.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {side.edges.slice(0, 5).map((e, i) => (
            <div key={e.user_id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text }}>
                {label} {i + 1}
              </span>
              <span style={{ fontSize: 12.5, color: C.subtext, whiteSpace: 'nowrap' }}>
                {e.orders}× · π {e.volume}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Trust() {
  const { trust, loading, error } = useTrust();
  const { t } = useTranslation();
  const a = t.app;
  const empty = trust.given.partners === 0 && trust.received.partners === 0;

  return (
    <section>
      <div style={{ ...card, display: 'grid', gap: 16 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: C.subtext, margin: 0 }}>{a.loading}</p>
        ) : error || empty ? (
          <p style={{ fontSize: 13, color: C.subtext, margin: 0, lineHeight: 1.6 }}>
            {a.trustEmpty}
          </p>
        ) : (
          <>
            <Side title={a.youPaid} hint={a.sellers} label={a.seller} partnersLbl={a.partners} ordersLbl={a.orders} side={trust.given} />
            <div style={{ height: 1, background: C.border }} />
            <Side title={a.paidYou} hint={a.buyers} label={a.buyer} partnersLbl={a.partners} ordersLbl={a.orders} side={trust.received} />
          </>
        )}
      </div>
    </section>
  );
}
