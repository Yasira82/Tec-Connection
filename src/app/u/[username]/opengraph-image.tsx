// The share card for a public profile (C-107).
//
// A link to /u/<handle> is the app's cheapest acquisition surface — it travels
// through WhatsApp, Telegram and X where the preview IS the message. It used to
// preview as nothing at all.
//
// Three constraints this file has to respect, two of them learned the hard way
// on this platform:
//   1. Satori (next/og) renders no stylesheet and resolves no CSS custom
//      properties, so every colour is a literal and every style is inline. The
//      avatar gradient is imported from the page's own Avatar so a person is the
//      same colour in the preview as on the page it links to.
//   2. Satori needs an explicit `display: flex` on any element with more than one
//      child; the default `display: block` throws at render time.
//   3. Verified is green evidence, Featured is a neutral label — the same rule
//      the pages follow, because a paid placement must not read as verification
//      in the one place a stranger sees first.
//
// An unknown or unpublished handle still renders a card — branded, with no
// fabricated name — because this route must never 500 on a stale link.
import { ImageResponse } from 'next/og';
import { avatarGradient } from '@/components/public/Avatar';
import { resolvePublicProfile } from '@/lib/connection/discovery';
import { getI18n } from '@/lib/i18n/server';

export const alt         = 'TEC Connection profile';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG    = '#050816';
const GOLD  = '#FBB44A';
const GREEN = '#22C55E';

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, { t: dict }] = await Promise.all([params, getI18n()]);
  const t = dict.public;
  const p = await resolvePublicProfile(username).catch(() => null);

  const cat      = p ? (t.cat[p.category as keyof typeof t.cat] ?? p.category) : '';
  const handle   = p ? `@${p.username}` : 'TEC Connection';
  const headline = p?.headline || (p ? cat : t.headline);

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 84px',
        background: BG, color: '#ffffff', fontFamily: 'system-ui, sans-serif',
        // The page's warm light source, flattened to what Satori supports.
        backgroundImage: `radial-gradient(1000px 500px at 22% -12%, rgba(251,180,74,0.20), transparent 70%)`,
      }}>
        <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, color: GOLD, fontWeight: 700 }}>
          TEC · CONNECTION
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 40 }}>
          <div style={{
            width: 156, height: 156, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: p ? avatarGradient(p.username) : 'linear-gradient(140deg, #FDCF7A, #E8962A)',
            color: '#0a0812', fontSize: 76, fontWeight: 900,
          }}>
            {(p?.username ?? 'T').charAt(0).toUpperCase()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 66, fontWeight: 900, letterSpacing: -2 }}>{handle}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              {p?.verified && (
                <div style={{
                  display: 'flex', padding: '6px 18px', borderRadius: 999,
                  fontSize: 24, fontWeight: 800, color: GREEN,
                  background: 'rgba(34,197,94,0.12)', border: `2px solid rgba(34,197,94,0.35)`,
                }}>✓ {t.verified}</div>
              )}
              {p && (
                <div style={{
                  display: 'flex', padding: '6px 18px', borderRadius: 10,
                  fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                  background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.08)',
                  textTransform: 'capitalize',
                }}>{cat}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 32, color: 'rgba(255,255,255,0.66)', marginTop: 42, lineHeight: 1.4 }}>
          {headline.length > 84 ? `${headline.slice(0, 84)}…` : headline}
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.4)', marginTop: 26 }}>
          {p ? `${p.followers} ${p.followers === 1 ? t.follower : t.followers} · ` : ''}connection.tecosystem.app
        </div>
      </div>
    ),
    size,
  );
}
