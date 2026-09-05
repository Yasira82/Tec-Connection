'use client';

// The landing, built around one rule: SHOW BEFORE YOU ASK.
//
// The previous version was a login button on an empty screen — a visitor who had
// just heard about TEC had to authenticate with Pi before seeing that a single
// other human was here. That is the wrong order for the app that is meant to be
// the ecosystem's front door: the reason to sign in has to be visible first.
//
// The people and the copy are both resolved by the SERVER parent — the directory
// from the public opt-in listing (C-107), the strings from the visitor's locale —
// so they are in the delivered HTML: visible with no session, to a crawler, and
// to a link preview, in the visitor's own language.
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
import { LanguagePicker } from '@/components/public/LanguagePicker';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { C, goldA, inkA } from '@/lib-client/palette';

const HUB_URL  = process.env.NEXT_PUBLIC_HUB_URL  ?? 'https://hub.tecosystem.app';
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://connection.tecosystem.app';

type PublicStrings = Dictionary['public'];

export function Landing({
  profiles, t, locale,
}: { profiles: DirectoryCardProfile[]; t: PublicStrings; locale: Locale }) {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  /**
   * Where the visitor was actually heading.
   *
   * `middleware.ts` bounces anyone without a session off a protected page and
   * puts the page they wanted in `?redirect=`. This read is what makes that
   * mean anything: `handleLogin` used to hard-code `/app`, so the destination
   * was thrown away a second time — an invite link survived the middleware only
   * to be dropped here, and the person arrived signed in, on the right app, and
   * nowhere near the group they had been invited to.
   *
   * Guarded like every other redirect on this platform: a same-origin absolute
   * path and nothing else. `//evil.com` is protocol-relative and browsers treat
   * it as external, which is why `startsWith('/')` alone is not enough.
   */
  const target = (): string => {
    if (typeof window === 'undefined') return '/app';
    let raw = '';
    try { raw = new URL(window.location.href).searchParams.get('redirect') ?? ''; } catch { raw = ''; }
    const safe = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') && raw.length < 512;
    return safe ? raw : '/app';
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(target());
    // `target` reads the URL at call time; the deps that matter are the auth ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => ssoRedirect(HUB_URL, `${APP_URL}${target()}`);

  const steps = [
    { n: '1', title: t.step1Title, body: t.step1Body },
    { n: '2', title: t.step2Title, body: t.step2Body },
    { n: '3', title: t.step3Title, body: t.step3Body },
  ];

  return (
    <main className="pub-glow" style={{
      minHeight: '100vh',
      color: C.text,
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      overflowX: 'hidden',
    }}>
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: 'calc(56px + env(safe-area-inset-top)) 22px calc(56px + env(safe-area-inset-bottom))',
      }}>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <header style={{ textAlign: 'center' }}>
          <div className="pub-eyebrow pub-in">{t.brand}</div>

          <h1 className="pub-h1 pub-in" style={{ marginTop: 14, animationDelay: '60ms' }}>
            {t.headline}
          </h1>

          <p className="pub-lede pub-in" style={{ animationDelay: '120ms' }}>{t.lede}</p>

          {/* Social proof made of real, published people. Rendered only when the
              directory answered; an empty stack says nothing and is left out. */}
          {profiles.length > 0 && (
            <div className="pub-in" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, marginTop: 26, animationDelay: '170ms',
            }}>
              <div className="pub-stack">
                {profiles.slice(0, 5).map(p => <Avatar key={p.username} username={p.username} size={34} hasPhoto={p.hasAvatar} />)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 650, color: inkA(0.55) }}>
                {t.alreadyOn}
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
            <button onClick={handleLogin} className="pub-cta">{t.cta}</button>
            <div>
              <Link href="/discover" className="pub-secondary">{t.browseFree}</Link>
            </div>
          </div>
        </header>

        {/* ── Proof ──────────────────────────────────────────────────── */}
        {profiles.length > 0 && (
          <section style={{ marginTop: 52 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: inkA(0.45), margin: 0 }}>
                {t.peopleOnTec}
              </h2>
              <Link href="/discover" style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--tec-gold)', textDecoration: 'none' }}>
                {t.seeAll}
              </Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {profiles.map((p, i) => (
                <DirectoryCard
                  key={p.username}
                  profile={p}
                  delay={280 + i * 60}
                  categoryLabel={t.cat[p.category as keyof PublicStrings['cat']] ?? p.category}
                  labels={{ verified: t.verified, verifiedHint: t.verifiedHint, featured: t.featured, featuredHint: t.featuredHint, follower: t.follower, followers: t.followers }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── The differentiator, stated plainly ─────────────────────── */}
        <section className="pub-panel" style={{ marginTop: 44, padding: '26px 22px' }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: inkA(0.45), margin: '0 0 18px' }}>
            {t.howTrust}
          </h2>
          <div style={{ display: 'grid', gap: 18 }}>
            {steps.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 900, color: 'var(--tec-gold)',
                  background: goldA(0.12), border: '1px solid var(--tec-border-gold)',
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{s.title}</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, color: inkA(0.58), margin: '4px 0 0' }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 11.5, lineHeight: 1.65, color: inkA(0.34), margin: 0 }}>
            {t.disclaimer}
          </p>
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 14 }}>
            <Link href="/discover" style={{ fontSize: 12.5, color: inkA(0.45), textDecoration: 'none' }}>{t.discoverTitle}</Link>
            <Link href="/privacy"  style={{ fontSize: 12.5, color: inkA(0.45), textDecoration: 'none' }}>{t.privacy}</Link>
            <Link href="/terms"    style={{ fontSize: 12.5, color: inkA(0.45), textDecoration: 'none' }}>{t.terms}</Link>
          </div>
          <div style={{ marginTop: 22 }}>
            <LanguagePicker current={locale} next="/" />
          </div>
        </footer>
      </div>
    </main>
  );
}
