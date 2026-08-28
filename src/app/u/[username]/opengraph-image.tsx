// The share card for a public profile (C-107).
//
// A link to /u/<handle> is the app's cheapest acquisition surface — it travels
// through WhatsApp, Telegram and X where a preview is the whole message. It used
// to preview as nothing at all.
//
// Two constraints this file has to respect, both learned the hard way on this
// platform:
//   1. Satori (next/og) resolves NO CSS custom properties, so every colour here
//      must be a literal value. TEC_COLORS is a plain 6-digit hex object, which
//      is exactly why it is safe to import — see the tec-ui contract test.
//   2. Satori needs an explicit `display: flex` on any element with more than one
//      child; the default `display: block` throws at render time.
//
// An unknown or unpublished handle still renders a card — a branded, honest one
// with no fabricated name — because the image route must never 500 on a bad link.
import { ImageResponse } from 'next/og';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { resolvePublicProfile } from '@/lib/connection/discovery';

export const alt         = 'TEC Connection profile';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await resolvePublicProfile(username).catch(() => null);

  const handle   = p ? `@${p.username}` : 'TEC Connection';
  const headline = p?.headline || (p ? `${p.category} on the Pi economy` : 'The people of the Pi economy');

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: 80,
        background: TEC_COLORS.bg, color: TEC_COLORS.text,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: TEC_COLORS.gold, textTransform: 'uppercase' }}>
          TEC Connection
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 44 }}>
          <div style={{
            width: 150, height: 150, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: TEC_COLORS.surface, border: `4px solid ${TEC_COLORS.gold}`,
            color: TEC_COLORS.gold, fontSize: 72, fontWeight: 900,
          }}>
            {(p?.username ?? 'T').charAt(0).toUpperCase()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 68, fontWeight: 900, color: TEC_COLORS.text }}>{handle}</div>
            {p?.verified && (
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: TEC_COLORS.gold, marginTop: 8 }}>
                ✅ Verified
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 34, color: TEC_COLORS.subtext, marginTop: 40, lineHeight: 1.4 }}>
          {headline.length > 90 ? `${headline.slice(0, 90)}…` : headline}
        </div>

        {p && (
          <div style={{ display: 'flex', fontSize: 30, color: TEC_COLORS.gold, marginTop: 26 }}>
            {p.followers} follower{p.followers === 1 ? '' : 's'} · connection.tecosystem.app
          </div>
        )}
      </div>
    ),
    size,
  );
}
