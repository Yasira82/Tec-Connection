'use client';

// TEC Connection (C-107) — Trust Graph. Trust is DERIVED from real economic
// activity (paid orders), not vanity metrics — and it is EVENTUAL, never
// presented as financial truth (the owning services are the source).
import { C, goldA } from '@/lib-client/palette';
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
      {/* Each row is a real relationship, so each row gets a NAME.
          It used to print the raw counterparty id — `afa10f…c983` — which
          identifies nobody, and a screen of hashes is why this tab read as a
          debug view. Replacing it with "Seller 1" was honest and useless.

          The id resolves to a Pi username server-side now (auth owns identity),
          and a named row is a LINK to that person's public profile — where the
          follow control already lives, so this does not grow a second one.

          The ordinal survives as the fallback: auth may be unreachable, or the
          counterparty may have no Pi username. An unnamed row is the degraded
          case, never an error. */}
      {side.edges.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {side.edges.slice(0, 5).map((e, i) => (
            <div key={e.user_id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              {e.username ? (
                <a
                  href={`/u/${encodeURIComponent(e.username)}`}
                  style={{
                    flex: 1, minWidth: 0, fontSize: 13.5, color: C.gold,
                    fontWeight: 600, textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >@{e.username}</a>
              ) : (
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text }}>
                  {label} {i + 1}
                </span>
              )}
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
            {/* What the number DOES. Buyers who have paid you are the signal
                Explorer ranks by (C-108 §10) — and the reason that ranking is
                worth stating is that it sits ABOVE the paid placement: money
                sorts within a trust tier and can never lift a listing out of
                one. A number with no consequence attached is a statistic; this
                is the consequence.

                Shown only to someone who HAS buyers. Telling a person with none
                that they could rank higher is an advert, not information. The
                thresholds mirror TRUST_TIERS in the backend — 1–4, then 5+. */}
            {trust.received.partners > 0 && (
              <div style={{
                marginTop: 2, padding: '10px 12px', borderRadius: 12,
                background: goldA(0.07), border: `1px solid ${goldA(0.18)}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, marginBottom: 3 }}>
                  {a.trustRankTitle}
                </div>
                <div style={{ fontSize: 12.5, color: C.subtext, lineHeight: 1.55 }}>
                  {trust.received.partners >= 5 ? a.trustRankTop : a.trustRankBuilding}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
