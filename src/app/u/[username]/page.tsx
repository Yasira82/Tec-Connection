// TEC Connection (C-107) — the PUBLIC shareable profile. Reachable outside a TEC
// session (a Pi-community surface): a Pi user can share connection.tecosystem.app/u/<handle>
// anywhere. Server component — reads the published profile directly via the server
// helper (own-scope not needed; public + opt-in only). Verification is presented from
// Zone/kyc; ⭐ Featured is Connection Pro (reach only). 404 when unknown/unpublished.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { resolvePublicProfile } from '@/lib/connection/discovery';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await resolvePublicProfile(username);
  if (!p) notFound();

  const card = {
    background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}33`,
    borderRadius: 18, padding: 26, textAlign: 'center' as const,
  };

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, padding: '48px 22px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 }}>
          TEC Connection · Public profile
        </div>

        <div style={card}>
          <div style={{
            width: 64, height: 64, borderRadius: 999, margin: '0 auto 14px', display: 'grid', placeItems: 'center',
            background: TEC_COLORS.bg, border: `1px solid ${TEC_COLORS.gold}55`, color: TEC_COLORS.gold, fontSize: 28, fontWeight: 900,
          }}>{p.username.charAt(0).toUpperCase()}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: TEC_COLORS.text }}>@{p.username}</span>
            {p.verified && <span style={{ fontSize: 11, fontWeight: 800, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '2px 9px' }}>✅ Verified</span>}
            {p.featured && <span title="Featured (Connection Pro)" style={{ fontSize: 13, color: TEC_COLORS.gold }}>⭐</span>}
          </div>

          <div style={{ fontSize: 12, color: TEC_COLORS.gold, marginTop: 6, textTransform: 'capitalize' }}>{p.category}</div>
          {p.headline && <p style={{ fontSize: 14, color: TEC_COLORS.subtext, marginTop: 12, lineHeight: 1.5 }}>{p.headline}</p>}

          <div style={{ marginTop: 18, fontSize: 22, fontWeight: 900, color: TEC_COLORS.gold }}>
            {p.followers}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TEC_COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              follower{p.followers === 1 ? '' : 's'}
            </span>
          </div>

          <Link href="/app" style={{
            display: 'inline-block', marginTop: 22, padding: '11px 22px', borderRadius: 12,
            background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            color: '#0a0800', fontWeight: 800, fontSize: 14, textDecoration: 'none',
          }}>Connect on TEC</Link>
        </div>

        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
          Verification is presented from Zone / KYC — never minted by Connection. ⭐ Featured is a
          Connection Pro placement (reach only). Trust is earned, never bought.
        </p>
      </div>
    </main>
  );
}
