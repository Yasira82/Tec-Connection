'use client';

// The landing, rebuilt around one rule: SHOW BEFORE YOU ASK.
//
// The previous version was a login button on an empty screen — a visitor who had
// just heard about TEC had to authenticate with Pi before seeing that a single
// other human was here. That is the wrong order for the app that is meant to be
// the ecosystem's front door: the reason to sign in has to be visible first.
//
// The people below are server-rendered by the parent (the public opt-in directory,
// C-107), so they are in the HTML — visible with no session, and to a crawler or a
// link preview. This component only owns the interactive part: bounce an already
// authenticated user into /app, and offer the Pi sign-in.
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { DirectoryCard, type DirectoryCardProfile } from '@/components/public/DirectoryCard';

const HUB_URL   = process.env.NEXT_PUBLIC_HUB_URL   ?? 'https://hub.tecosystem.app';
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL   ?? 'https://connection.tecosystem.app';
const APP_NAME  = process.env.NEXT_PUBLIC_APP_NAME  ?? 'TEC Connection';
const APP_EMOJI = process.env.NEXT_PUBLIC_APP_EMOJI ?? '🔗';

export function Landing({ profiles }: { profiles: DirectoryCardProfile[] }) {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/app');
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => ssoRedirect(HUB_URL, `${APP_URL}/app`);

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 22px 64px' }}>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>{APP_EMOJI}</div>
          <div style={{ fontSize: 12, letterSpacing: 1.5, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>
            TEC · Your network
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 900, color: TEC_COLORS.gold, margin: '6px 0 12px' }}>{APP_NAME}</h1>
          <p style={{ fontSize: 14, color: TEC_COLORS.subtext, lineHeight: 1.6, margin: '0 0 26px' }}>
            The people of the Pi economy, in one place. Follow builders and merchants,
            and build trust from real activity — not from claims.
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              padding: '14px 32px',
              background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
              border: 'none', borderRadius: 16, color: '#0a0800',
              fontSize: 15, fontWeight: 800,
              cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1,
            }}>
            {isLoading ? '…' : 'Continue with Pi'}
          </button>
        </div>

        {/* Proof, not a promise. Rendered only when the directory actually
            answered — an empty strip says nothing and is better left out than
            filled with placeholders. */}
        {profiles.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 12, marginBottom: 12,
            }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: TEC_COLORS.text, letterSpacing: 0.5, textTransform: 'uppercase', margin: 0 }}>
                People on TEC
              </h2>
              <Link href="/discover" style={{ fontSize: 13, fontWeight: 700, color: TEC_COLORS.gold, textDecoration: 'none' }}>
                See all →
              </Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {profiles.map(p => <DirectoryCard key={p.username} profile={p} />)}
            </div>
            <p style={{ fontSize: 11, color: TEC_COLORS.subtext, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              Browsing is open — signing in is only needed to follow, publish your
              profile, and build your own graph.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
