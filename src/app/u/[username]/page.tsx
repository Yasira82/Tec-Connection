// TEC Connection (C-107) — the PUBLIC shareable profile.
//
// This page is the app's cheapest acquisition surface: a Pi user pastes
// connection.tecosystem.app/u/<handle> into a group chat and everyone who taps it
// lands here with no session — often in a country whose language is not English.
// So it has to stand on its own: say who this is, in the reader's language, say
// why the badge means something, and give one obvious way in.
//
// Verification is PRESENTED from Zone / KYC and never minted here; Featured is a
// Connection Pro placement worth reach only. 404 when the handle is unknown or
// unpublished — a preview must never imply a profile exists.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolvePublicProfile } from '@/lib/connection/discovery';
import { Avatar } from '@/components/public/Avatar';
import { FollowCta } from '@/components/public/FollowCta';
import { ShareProfile } from '@/components/public/ShareProfile';
import { LanguagePicker } from '@/components/public/LanguagePicker';
import { getI18n } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

// A shared profile link was previously blind: pasted into WhatsApp, Telegram or X
// it previewed as the generic app title with no name, no headline and no image.
// For the app that is meant to be the ecosystem's front door, the shared link IS
// the acquisition surface — so it carries the person's own identity, described in
// the reader's language. The matching card image is ./opengraph-image.tsx.
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const [{ username }, { t }] = await Promise.all([params, getI18n()]);
  const p = await resolvePublicProfile(username);
  if (!p) return { title: `${t.public.notFound} · TEC Connection` };

  const cat = t.public.cat[p.category as keyof typeof t.public.cat] ?? p.category;
  const title       = `@${p.username} · TEC Connection`;
  // The count only reaches the share preview when its owner allows it. This
  // string is what WhatsApp and Telegram render, so a leak here travels further
  // than the page itself.
  const description = p.headline
    ? p.headline
    : p.followers !== null
      ? `@${p.username} — ${cat}. ${p.followers} ${p.followers === 1 ? t.public.follower : t.public.followers}.`
      : `@${p.username} — ${cat}.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter:   { card: 'summary_large_image', title, description },
  };
}

const fmtSince = (iso: string | undefined, locale: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Formatted in the visitor's locale, with English as the fallback if the
  // runtime has no data for it — never a raw ISO string on a public page.
  try { return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }); }
  catch { return d.toLocaleDateString('en', { month: 'long', year: 'numeric' }); }
};

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, { locale, t: dict }] = await Promise.all([params, getI18n()]);
  const t = dict.public;

  const p = await resolvePublicProfile(username);
  if (!p) notFound();

  const since = fmtSince(p.since, locale);
  const cat   = t.cat[p.category as keyof typeof t.cat] ?? p.category;

  return (
    <main className="pub-glow" style={{
      minHeight: '100vh', color: '#fff',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)', overflowX: 'hidden',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        padding: 'calc(34px + env(safe-area-inset-top)) 22px calc(56px + env(safe-area-inset-bottom))',
      }}>

        <Link href="/discover" className="pub-eyebrow" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← {t.back}
        </Link>

        <section className="pub-panel pub-in" style={{ marginTop: 18, padding: '34px 26px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Avatar username={p.username} size={84} hasPhoto={p.hasAvatar} />
          </div>

          {/* <bdi>: a Latin handle inside an RTL page would otherwise render as
              "nour_market@" — the '@' is a bidi-neutral character and resolves
              against the surrounding direction. */}
          <h1 style={{
            fontSize: 'clamp(24px, 7vw, 30px)', fontWeight: 900, letterSpacing: '-0.02em',
            color: '#fff', margin: '18px 0 0',
          }}><bdi>@{p.username}</bdi></h1>

          <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {p.verified && (
              <span className="pub-badge-verified" title={t.verifiedHint}>✓ {t.verified}</span>
            )}
            {p.featured && (
              <span className="pub-badge-featured" title={t.featuredHint}>{t.featured}</span>
            )}
            <span className="pub-badge-featured" style={{ textTransform: 'capitalize' }}>{cat}</span>
          </div>

          {p.headline && (
            <p dir="auto" style={{
              fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.68)',
              margin: '18px auto 0', maxWidth: 340,
            }}>{p.headline}</p>
          )}

          {/* Followers is the only number this page can state, and it comes from a
              real count of real edges — so it is stated, and nothing else is.
              Unless its owner turned it off (C-107 §14.5), in which case the
              block is absent rather than showing a zero: a zero is a claim
              about this person that nobody made. */}
          {p.followers !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 8,
            margin: '24px 0 0', padding: '12px 22px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tec-border)',
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--tec-gold)' }}>{p.followers}</span>
            <span style={{ fontSize: 12.5, fontWeight: 650, color: 'rgba(255,255,255,0.5)' }}>
              {p.followers === 1 ? t.follower : t.followers}
            </span>
          </div>
          )}

          {since && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.34)', marginTop: 12 }}>
              {fill(t.since, { date: since })}
            </div>
          )}

          {/* The button DOES the thing now.
              It used to be a link to /app — "go and open the app", which is the
              one sentence a shared link exists to avoid. Whoever tapped it
              arrived in an empty app with no memory of who they had come to
              see. It follows this person instead, signing in on the way if
              there is no session, and returning here. */}
          <div style={{ marginTop: 26 }}>
            <FollowCta
              username={p.username}
              labels={{
                follow:    fill(t.follow, { name: p.username }),
                following: fill(t.following, { name: p.username }),
                signIn:    fill(t.followSignIn, { name: p.username }),
                self:      t.followSelf,
                failed:    t.followFailed,
              }}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <ShareProfile
              username={p.username}
              labels={{
                share:  t.shareProfile,
                copied: t.shareCopied,
                title:  `@${p.username} · TEC`,
                text:   fill(t.shareText, { name: p.username }),
              }}
            />
          </div>
          <Link href="/discover" className="pub-secondary">{t.browseMore}</Link>
        </section>

        <p style={{
          fontSize: 11.5, color: 'rgba(255,255,255,0.34)', marginTop: 20,
          textAlign: 'center', lineHeight: 1.65,
        }}>
          {t.profileNote}
        </p>

        <div style={{ marginTop: 24 }}>
          <LanguagePicker current={locale} next={`/u/${encodeURIComponent(p.username)}`} />
        </div>
      </div>
    </main>
  );
}
