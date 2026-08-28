// TEC Connection (C-107) — the PUBLIC Discover directory.
//
// ── Why this page exists ─────────────────────────────────────────────────────
// The directory, the public profile and their BFF routes were already public —
// but the only PAGE that rendered them lived inside /app, which the middleware
// guards. So a visitor who had heard of TEC saw exactly one thing: a login
// button on an otherwise empty screen. An app that asks you to authenticate
// before it shows you a single human is not a front door.
//
// This page is the front door: real people, searchable, with no session. Search
// and category filtering run through a plain GET <form>, so the page works with
// JavaScript disabled, inside an in-app browser, and — the point — for a crawler.
//
// Publishing is opt-in (sovereignty, C-107): only profiles the owner published
// appear here. An unreachable backend renders an honest empty state; it never
// fabricates a directory.
import Link from 'next/link';
import type { Metadata } from 'next';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { CATEGORIES, resolveDirectory } from '@/lib/connection/discovery';
import { DirectoryCard } from '@/components/public/DirectoryCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title:       'Discover people on Pi · TEC Connection',
  description: 'Find builders, merchants, creators and investors in the Pi economy. Trust is earned from real activity — never bought.',
  openGraph: {
    title:       'Discover people on Pi · TEC Connection',
    description: 'Find builders, merchants, creators and investors in the Pi economy.',
    type:        'website',
  },
};

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none',
  color: active ? '#0a0800' : TEC_COLORS.text,
  background: active ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent',
  border: `1px solid ${TEC_COLORS.gold}${active ? '' : '33'}`,
  borderRadius: 999, padding: '6px 12px', textTransform: 'capitalize',
});

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
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 22px 64px' }}>

        <Link href="/" style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase', textDecoration: 'none' }}>
          ← TEC Connection
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: TEC_COLORS.gold, margin: '10px 0 6px' }}>
          Discover people on Pi
        </h1>
        <p style={{ fontSize: 14, color: TEC_COLORS.subtext, lineHeight: 1.6, margin: 0 }}>
          Builders, merchants, creators and investors in the Pi economy. Verification comes
          from Zone / KYC — Connection presents it, never mints it.
        </p>

        {/* Plain GET form: no JavaScript required, and the result is a real URL
            you can share or a crawler can follow. */}
        <form action="/discover" method="GET" style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {active && <input type="hidden" name="category" value={active} />}
          <input
            name="q" defaultValue={q ?? ''} placeholder="Search by name or headline…"
            aria-label="Search people"
            style={{
              flex: 1, background: TEC_COLORS.surface, color: TEC_COLORS.text,
              border: `1px solid ${TEC_COLORS.gold}33`, borderRadius: 12, padding: '11px 14px', fontSize: 14,
            }} />
          <button type="submit" style={{
            background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            color: '#0a0800', border: 'none', borderRadius: 12, padding: '11px 20px',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}>Search</button>
        </form>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Link href={href()} style={chip(!active)}>all</Link>
          {CATEGORIES.map(c => <Link key={c} href={href(c)} style={chip(active === c)}>{c}</Link>)}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
          {profiles.length === 0 ? (
            <div style={{
              background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}22`,
              borderRadius: 16, padding: '28px 22px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: TEC_COLORS.text }}>
                {q || active ? 'Nobody matches that yet' : 'The directory is still filling up'}
              </div>
              <p style={{ fontSize: 13, color: TEC_COLORS.subtext, marginTop: 8, lineHeight: 1.6 }}>
                Listing is opt-in — people appear here only after publishing their profile.
                Sign in and publish yours to be found.
              </p>
            </div>
          ) : profiles.map(p => <DirectoryCard key={p.username} profile={p} />)}
        </div>

        <div style={{
          marginTop: 30, background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}33`,
          borderRadius: 16, padding: '22px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEC_COLORS.text }}>Be findable in the Pi economy</div>
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: '8px 0 16px', lineHeight: 1.6 }}>
            Publish your profile, follow people, and build trust from real activity.
          </p>
          <Link href="/app" style={{
            display: 'inline-block', padding: '12px 26px', borderRadius: 12,
            background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            color: '#0a0800', fontWeight: 800, fontSize: 14, textDecoration: 'none',
          }}>Continue with Pi</Link>
        </div>
      </div>
    </main>
  );
}
