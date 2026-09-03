// TEC Connection (C-107) — the PUBLIC Discover directory.
//
// ── Why this page exists ─────────────────────────────────────────────────────
// The directory, the public profile and their BFF routes were already public —
// but the only PAGE that rendered them lived inside /app, which the middleware
// guards. So a visitor who had heard of TEC saw exactly one thing: a login
// button on an otherwise empty screen. An app that asks you to authenticate
// before it shows you a single human is not a front door.
//
// Search, category filtering and the language switch all run through plain links
// and a GET <form>, so the page works with JavaScript disabled, inside an in-app
// browser, and — the point — for a crawler. Every result is a URL somebody can
// paste into a group chat.
//
// Publishing is opt-in (sovereignty, C-107): only profiles the owner published
// appear here. An unreachable backend renders an honest empty state; it never
// fabricates a directory.
import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORIES, resolveDirectory } from '@/lib/connection/discovery';
import { DirectoryCard } from '@/components/public/DirectoryCard';
import { LanguagePicker } from '@/components/public/LanguagePicker';
import { getI18n } from '@/lib/i18n/server';
import { C, inkA } from '@/lib-client/palette';

export const dynamic = 'force-dynamic';

// Localised too: this is a public, indexable page, so its title and description
// should reach a search engine in the language the visitor's browser asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title:       `${t.public.discoverTitle} · TEC Connection`,
    description: t.public.discoverLede,
    openGraph:   { title: t.public.discoverTitle, description: t.public.discoverLede, type: 'website' },
  };
}

export default async function DiscoverPage(
  { searchParams }: { searchParams: Promise<{ q?: string; category?: string }> },
) {
  const [{ q, category }, { locale, t: dict }] = await Promise.all([searchParams, getI18n()]);
  const t = dict.public;

  const active   = CATEGORIES.includes((category ?? '') as (typeof CATEGORIES)[number]) ? category : undefined;
  const profiles = await resolveDirectory({ query: q, category: active });

  const href = (cat?: string) => {
    const p = new URLSearchParams();
    if (q?.trim()) p.set('q', q.trim());
    if (cat)       p.set('category', cat);
    const s = p.toString();
    return s ? `/discover?${s}` : '/discover';
  };

  const labels = {
    verified: t.verified, verifiedHint: t.verifiedHint,
    featured: t.featured, featuredHint: t.featuredHint,
    follower: t.follower, followers: t.followers,
  };

  return (
    <main className="pub-glow" style={{
      minHeight: '100vh', color: C.text,
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)', overflowX: 'hidden',
    }}>
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: 'calc(34px + env(safe-area-inset-top)) 22px calc(56px + env(safe-area-inset-bottom))',
      }}>

        <Link href="/" className="pub-eyebrow" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← {t.brand}
        </Link>

        <h1 className="pub-h1 pub-in" style={{ marginTop: 16, fontSize: 'clamp(28px, 7.5vw, 38px)' }}>
          {t.discoverTitle}
        </h1>
        <p className="pub-lede pub-in" style={{ animationDelay: '60ms' }}>{t.discoverLede}</p>

        {/* Plain GET form: no JavaScript required, and the result is a real URL
            you can share or a crawler can follow. */}
        <form action="/discover" method="GET" className="pub-in"
          style={{ display: 'flex', gap: 9, marginTop: 24, animationDelay: '110ms' }}>
          {active && <input type="hidden" name="category" value={active} />}
          <input
            className="pub-input" name="q" defaultValue={q ?? ''}
            placeholder={t.searchHint} aria-label={t.searchLabel} />
          <button type="submit" className="pub-cta" style={{ width: 'auto', padding: '13px 22px', fontSize: 15 }}>
            {t.searchAction}
          </button>
        </form>

        <div className="pub-in" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, animationDelay: '150ms' }}>
          <Link href={href()} className="pub-chip" data-active={String(!active)}>{t.all}</Link>
          {CATEGORIES.map(c => (
            <Link key={c} href={href(c)} className="pub-chip" data-active={String(active === c)}>
              {t.cat[c] ?? c}
            </Link>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 26 }}>
          {profiles.length === 0 ? (
            <div className="pub-panel pub-in" style={{ padding: '34px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">🔍</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                {q || active ? t.emptyFiltered : t.emptyAll}
              </div>
              <p style={{ fontSize: 13.5, color: inkA(0.55), margin: '10px auto 0', maxWidth: 380, lineHeight: 1.6 }}>
                {t.emptyBody}
              </p>
              {(q || active) && (
                <Link href="/discover" className="pub-secondary" style={{ marginTop: 18 }}>
                  {t.clearFilters}
                </Link>
              )}
            </div>
          ) : profiles.map((p, i) => (
            <DirectoryCard
              key={p.username}
              profile={p}
              delay={180 + i * 45}
              categoryLabel={t.cat[p.category as keyof typeof t.cat] ?? p.category}
              labels={labels}
            />
          ))}
        </div>

        <div className="pub-panel" style={{ marginTop: 34, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 850, color: C.text, letterSpacing: '-0.01em' }}>
            {t.findableTitle}
          </div>
          <p style={{ fontSize: 13.5, color: inkA(0.58), margin: '10px auto 20px', maxWidth: 380, lineHeight: 1.6 }}>
            {t.findableBody}
          </p>
          <Link href="/app" className="pub-cta" style={{ textDecoration: 'none', maxWidth: 300 }}>
            {t.cta}
          </Link>
        </div>

        <div style={{ marginTop: 28 }}>
          <LanguagePicker current={locale} next="/discover" />
        </div>
      </div>
    </main>
  );
}
