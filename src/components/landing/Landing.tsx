'use client';

// The landing, built around one rule: SHOW BEFORE YOU ASK.
//
// The previous version was a login button on an empty screen — a visitor who had
// just heard about TEC had to authenticate with Pi before seeing that a single
// other human was here. That is the wrong order for the app that is meant to be
// the ecosystem's front door: the reason to sign in has to be visible first.
//
// The people below are server-rendered by the parent from the public opt-in
// directory (C-107), so they are in the delivered HTML — visible with no session,
// to a crawler, and to a link preview. This component owns only the interactive
// half: bounce an already-authenticated user into /app, and offer the Pi sign-in.
//
// There is deliberately NO "N people" counter. The directory API is capped at
// `take: 60`, so a count derived from the returned array would silently freeze at
// 60 and start understating the network the moment it grew past it. A number on
// the front door has to be true or absent; the avatars are true.
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';
import { Avatar } from '@/components/public/Avatar';
import { DirectoryCard, type DirectoryCardProfile } from '@/components/public/DirectoryCard';

const HUB_URL  = process.env.NEXT_PUBLIC_HUB_URL  ?? 'https://hub.tecosystem.app';
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://connection.tecosystem.app';

const FOOTER_LINKS = [
  { label: 'Discover', href: '/discover' },
  { label: 'Privacy',  href: '/privacy'  },
  { label: 'Terms',    href: '/terms'    },
];

const STEPS = [
  { n: '1', title: 'Publish',  body: 'Put up a handle and one line about what you do. Opt-in — you are listed only if you choose to be.' },
  { n: '2', title: 'Connect',  body: 'Follow the builders and merchants you actually deal with. Your graph belongs to you.' },
  { n: '3', title: 'Be trusted', body: 'Trust here is computed from completed Pi payments — not from followers, reviews, or anything you can write about yourself.' },
];

export function Landing({ profiles }: { profiles: DirectoryCardProfile[] }) {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/app');
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => ssoRedirect(HUB_URL, `${APP_URL}/app`);

  return (
    <main className="pub-glow" style={{
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      overflowX: 'hidden',
    }}>
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: 'calc(56px + env(safe-area-inset-top)) 22px calc(56px + env(safe-area-inset-bottom))',
      }}>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <header style={{ textAlign: 'center' }}>
          <div className="pub-eyebrow pub-in">TEC · Connection</div>

          <h1 className="pub-h1 pub-in" style={{ marginTop: 14, animationDelay: '60ms' }}>
            The people of the<br />Pi economy.
          </h1>

          <p className="pub-lede pub-in" style={{ animationDelay: '120ms' }}>
            Find builders and merchants who actually accept Pi — and see who is
            trusted, from real completed payments rather than claims.
          </p>

          {/* Social proof made of real, published people. Rendered only when the
              directory answered; an empty stack says nothing and is left out. */}
          {profiles.length > 0 && (
            <div className="pub-in" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, marginTop: 26, animationDelay: '170ms',
            }}>
              <div className="pub-stack">
                {profiles.slice(0, 5).map(p => <Avatar key={p.username} username={p.username} size={34} />)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 650, color: 'rgba(255,255,255,0.55)' }}>
                already on TEC
              </span>
            </div>
          )}

          <div className="pub-in" style={{ marginTop: 30, animationDelay: '220ms' }}>
            {/* Never disabled, and never labelled with its own internal state.
                The session probe can hang or fail — on a slow phone, or when the
                auth endpoint is unreachable — and an earlier build left the ONLY
                action on the front door greyed out reading "Checking session…"
                until it resolved. The sign-in redirect does not depend on that
                answer: an authenticated visitor is already being bounced to /app
                by the effect above, so the button can always be pressed. */}
            <button onClick={handleLogin} className="pub-cta">Continue with Pi</button>
            <div>
              <Link href="/discover" className="pub-secondary">
                Or browse without signing in →
              </Link>
            </div>
          </div>
        </header>

        {/* ── Proof ──────────────────────────────────────────────────── */}
        {profiles.length > 0 && (
          <section style={{ marginTop: 52 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                People on TEC
              </h2>
              <Link href="/discover" style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--tec-gold)', textDecoration: 'none' }}>
                See all →
              </Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {profiles.map((p, i) => <DirectoryCard key={p.username} profile={p} delay={280 + i * 60} />)}
            </div>
          </section>
        )}

        {/* ── The differentiator, stated plainly ─────────────────────── */}
        <section className="pub-panel" style={{ marginTop: 44, padding: '26px 22px' }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: '0 0 18px' }}>
            How trust works here
          </h2>
          <div style={{ display: 'grid', gap: 18 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 900, color: 'var(--tec-gold)',
                  background: 'rgba(251,180,74,0.12)', border: '1px solid var(--tec-border-gold)',
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff' }}>{s.title}</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.58)', margin: '4px 0 0' }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 11.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.34)', margin: 0 }}>
            Verification is presented from Zone / KYC — never minted by Connection.
            Featured is a Pro placement: reach only, not trust.
          </p>
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 14 }}>
            {FOOTER_LINKS.map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
                {l.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
