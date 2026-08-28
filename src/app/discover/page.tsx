// TEC Connection (C-107) — the PUBLIC Discover directory.
//
// ── Why this page exists ─────────────────────────────────────────────────────
// The directory, the public profile and their BFF routes were already public —
// but the only PAGE that rendered them lived inside /app, which the middleware
// guards. So a visitor who had heard of TEC saw exactly one thing: a login
// button on an otherwise empty screen. An app that asks you to authenticate
// before it shows you a single human is not a front door.
//
// Search and category filtering run through a plain GET <form> and real links,
// so the page works with JavaScript disabled, inside an in-app browser, and —
// the point — for a crawler. Every result is a URL somebody can paste into a
// group chat.
//
// Publishing is opt-in (sovereignty, C-107): only profiles the owner published
// appear here. An unreachable backend renders an honest empty state; it never
// fabricates a directory.
import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORIES, resolveDirectory } from '@/lib/connection/discovery';
import { DirectoryCard } from '@/components/public/DirectoryCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title:       'Discover people on Pi · TEC Connection',
  description: 'Find builders, merchants, creators and investors in the Pi economy. Trust is earned from real completed payments — never bought.',
  openGraph: {
    title:       'Discover people on Pi · TEC Connection',
    description: 'Find builders, merchants, creators and investors in the Pi economy.',
    type:        'website',
  },
};

export default async function DiscoverPage(
  { searchParams }: { searchParams: Promise<{ q?: string; category?: string }> },
) {
  const { q, category } = await searchParams;
  const active   = CATEGORIES.includes((category ?? '') as (typeof CATEGORIES)[number]) ? category : undefined;
  const profiles = await resolveDirectory({ query: q, category: active });

  const href = (cat?: string) => {
    const p = new URLSearchParams();
    if (q?.trim()) p.set('q', q.trim());
    if (cat)       p.set('category', cat);
    const s = p.toString();
    return s ? `/discover?${s}` : '/discover';
  };

  return (
    <main className="pub-glow" style={{
      minHeight: '100vh', color: '#fff',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)', overflowX: 'hidden',
    }}>
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: 'calc(34px + env(safe-area-inset-top)) 22px calc(56px + env(safe-area-inset-bottom))',
      }}>

        <Link href="/" className="pub-eyebrow" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← TEC · Connection
        </Link>

        <h1 className="pub-h1 pub-in" style={{ marginTop: 16, fontSize: 'clamp(28px, 7.5vw, 38px)' }}>
          Discover people on Pi
        </h1>
        <p className="pub-lede pub-in" style={{ animationDelay: '60ms' }}>
          Builders, merchants, creators and investors. Verification comes from
          Zone / KYC — Connection presents it, never mints it.
        </p>

        {/* Plain GET form: no JavaScript required, and the result is a real URL
            you can share or a crawler can follow. */}
        <form action="/discover" method="GET" className="pub-in"
          style={{ display: 'flex', gap: 9, marginTop: 24, animationDelay: '110ms' }}>
          {active && <input type="hidden" name="category" value={active} />}
          <input
            className="pub-input" name="q" defaultValue={q ?? ''}
            placeholder="Search people…" aria-label="Search by handle or headline" />
          <button type="submit" className="pub-cta" style={{ width: 'auto', padding: '13px 22px', fontSize: 15 }}>
            Search
          </button>
        </form>

        <div className="pub-in" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, animationDelay: '150ms' }}>
          <Link href={href()} className="pub-chip" data-active={String(!active)}>all</Link>
          {CATEGORIES.map(c => (
            <Link key={c} href={href(c)} className="pub-chip" data-active={String(active === c)}>{c}</Link>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 26 }}>
          {profiles.length === 0 ? (
            <div className="pub-panel pub-in" style={{ padding: '34px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">🔍</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                {q || active ? 'Nobody matches that yet' : 'The directory is still filling up'}
              </div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', margin: '10px auto 0', maxWidth: 380, lineHeight: 1.6 }}>
                Listing is opt-in — people appear here only after publishing their
                profile. Sign in and publish yours to be found.
              </p>
              {(q || active) && (
                <Link href="/discover" className="pub-secondary" style={{ marginTop: 18 }}>
                  Clear filters
                </Link>
              )}
            </div>
          ) : profiles.map((p, i) => <DirectoryCard key={p.username} profile={p} delay={180 + i * 45} />)}
        </div>

        <div className="pub-panel" style={{ marginTop: 34, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 850, color: '#fff', letterSpacing: '-0.01em' }}>
            Be findable in the Pi economy
          </div>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.58)', margin: '10px auto 20px', maxWidth: 380, lineHeight: 1.6 }}>
            Publish your profile, follow the people you deal with, and let trust
            build from real completed payments.
          </p>
          <Link href="/app" className="pub-cta" style={{ textDecoration: 'none', maxWidth: 300 }}>
            Continue with Pi
          </Link>
        </div>
      </div>
    </main>
  );
}
