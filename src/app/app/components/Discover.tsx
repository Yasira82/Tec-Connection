'use client';

// TEC Connection (C-107) — Discover. The graph was username-only: you could follow
// someone only if you already knew their handle. Discover is the opt-in PUBLIC
// directory that makes Pi users findable. Verification is PRESENTED (Zone/kyc), never
// minted; a ⭐ Featured card is Connection Pro = reach only (ranks BELOW verified —
// trust is earned, never bought). Publishing is opt-in (sovereignty); your identity
// is your session — the app never sends it.
import { useEffect, useMemo, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { Avatar } from '@/components/public/Avatar';

const CATEGORIES = ['builder', 'merchant', 'creator', 'investor', 'mentor', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

interface Card {
  username: string; headline: string; category: string;
  verified: boolean; featured: boolean; followers: number;
  hasAvatar?: boolean;
}
interface MyProfile {
  username: string; headline: string; category: string;
  published: boolean; verified: boolean; featured: boolean;
  hasAvatar?: boolean;
}

const card = {
  background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`,
  borderRadius: 16, padding: '20px 22px',
} as const;
const field = {
  width: '100%', background: TEC_COLORS.bg, color: TEC_COLORS.text,
  border: `1px solid ${TEC_COLORS.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14,
} as const;
const goldBtn = {
  background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
  color: '#0a0800', border: 'none', borderRadius: 10, padding: '9px 16px',
  fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;
const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  color: active ? '#0a0800' : TEC_COLORS.text,
  background: active ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent',
  border: `1px solid ${TEC_COLORS.gold}${active ? '' : '33'}`,
  borderRadius: 999, padding: '6px 12px', cursor: 'pointer', textTransform: 'capitalize',
});

export function Discover() {
  const { t } = useTranslation();
  const a = t.app;
  const [query, setQuery] = useState('');
  const [cat,   setCat]   = useState<Category | 'all'>('all');
  const [list,  setList]  = useState<Card[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  // Only the caller's own username is needed here — to hide the Follow button on
  // their own row. Editing the card is a Settings task (see ProfileEditor).
  const [myUsername, setMyUsername] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/bff/connection/profile/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { profile?: { username?: string } } | null) => setMyUsername(j?.profile?.username ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams();
        if (query.trim()) qs.set('q', query.trim());
        if (cat !== 'all') qs.set('category', cat);
        const res  = await fetch(`/api/bff/connection/discover?${qs.toString()}`, { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (data && data.source === 'live' && Array.isArray(data.profiles)) {
          setList(data.profiles as Card[]); setStatus('ready');
        } else { setList([]); setStatus('unavailable'); }
      } catch { if (alive) { setList([]); setStatus('unavailable'); } }
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [query, cat]);

  const follow = async (username: string) => {
    setFollowed((s) => new Set(s).add(username));
    try {
      await fetch('/api/bff/connection/following', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
      });
    } catch { setFollowed((s) => { const n = new Set(s); n.delete(username); return n; }); }
  };

  const count = list.length;
  const isSelf = (u: string) => !!myUsername && u.toLowerCase() === myUsername.toLowerCase();
  const catList = useMemo(() => CATEGORIES, []);

  return (
    <section>

      {/* Directory */}
      <div style={card}>
        <input style={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={a.searchPeople} maxLength={80} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
          <button style={chip(cat === 'all')} onClick={() => setCat('all')}>{a.all}</button>
          {catList.map((c) => <button key={c} style={chip(cat === c)} onClick={() => setCat(c)}>{t.public.cat[c] ?? c}</button>)}
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {status === 'loading' && <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>{a.loading}</p>}
          {status === 'unavailable' && <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>{a.discoverUnavailable}</p>}
          {status === 'ready' && count === 0 && (
            <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>
              {a.discoverEmpty}
            </p>
          )}
          {status === 'ready' && list.map((p) => (
            <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* The same Avatar the public pages use, so a person looks the
                  same inside the app as they do on their shared link. */}
              <Avatar username={p.username} size={38} hasPhoto={p.hasAvatar} />
              <a href={`/u/${encodeURIComponent(p.username)}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <bdi style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.text }}>@{p.username}</bdi>
                  {p.verified && <span style={{ fontSize: 10, fontWeight: 800, color: TEC_COLORS.success, background: 'rgba(34,197,94,0.12)', border: `1px solid ${TEC_COLORS.success}4d`, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>✓ {t.public.verified}</span>}
                </div>
                {/* `capitalize` scoped to the category alone — on the whole
                    line it also title-cased the count: "184 Followers". */}
                <div style={{ fontSize: 11, color: TEC_COLORS.gold, marginTop: 2 }}>
                  <span style={{ textTransform: 'capitalize' }}>{t.public.cat[p.category as keyof typeof t.public.cat] ?? p.category}</span>
                  {' · '}{p.followers} follower{p.followers === 1 ? '' : 's'}
                  {/* ⭐ on the META line, not beside the name: a second badge
                      next to a long handle wraps and makes that one row taller.
                      It is also a paid placement, not part of who they are. */}
                  {p.featured && <span style={{ marginInlineStart: 6, color: TEC_COLORS.subtext }}>⭐</span>}
                </div>
                {p.headline && <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 3, lineHeight: 1.4 }}>{p.headline}</div>}
              </a>
              {!isSelf(p.username) && (
                followed.has(p.username)
                  ? <span style={{ fontSize: 12, color: TEC_COLORS.success, whiteSpace: 'nowrap' }}>{a.followingNow}</span>
                  : <button style={goldBtn} onClick={() => follow(p.username)}>{a.follow}</button>
              )}
            </div>
          ))}
        </div>

        {/* One line, once. The same three principles were previously restated
            at the bottom of every card on every tab. */}
        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '14px 0 0', lineHeight: 1.5 }}>
          {a.verifiedNote}
        </p>
      </div>
    </section>
  );
}
