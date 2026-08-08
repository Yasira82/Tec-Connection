'use client';

// TEC Connection (C-107) — Discover. The graph was username-only: you could follow
// someone only if you already knew their handle. Discover is the opt-in PUBLIC
// directory that makes Pi users findable. Verification is PRESENTED (Zone/kyc), never
// minted; a ⭐ Featured card is Connection Pro = reach only (ranks BELOW verified —
// trust is earned, never bought). Publishing is opt-in (sovereignty); your identity
// is your session — the app never sends it.
import { useEffect, useMemo, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';

const CATEGORIES = ['builder', 'merchant', 'creator', 'investor', 'mentor', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

interface Card {
  username: string; headline: string; category: string;
  verified: boolean; featured: boolean; followers: number;
}
interface MyProfile {
  username: string; headline: string; category: string;
  published: boolean; verified: boolean; featured: boolean;
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
  const [query, setQuery] = useState('');
  const [cat,   setCat]   = useState<Category | 'all'>('all');
  const [list,  setList]  = useState<Card[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  // Own profile editor
  const [me, setMe] = useState<MyProfile | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editCat, setEditCat] = useState<Category>('builder');
  const [savedMsg, setSavedMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMe = () => {
    fetch('/api/bff/connection/profile/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { profile?: MyProfile } | null) => {
        if (!j?.profile) return;
        setMe(j.profile);
        setEditHeadline(j.profile.headline ?? '');
        setEditCat((CATEGORIES as readonly string[]).includes(j.profile.category) ? (j.profile.category as Category) : 'builder');
      })
      .catch(() => {});
  };
  useEffect(loadMe, []);

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

  const save = async (publish: boolean) => {
    if (saving) return;
    setSaving(true); setSavedMsg('');
    try {
      const res = await fetch('/api/bff/connection/profile/me', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: editHeadline.trim(), category: editCat, published: publish }),
      });
      const j = (await res.json().catch(() => ({}))) as { profile?: MyProfile; ok?: boolean };
      if (!res.ok || !j.ok || !j.profile) { setSavedMsg('Could not save. Please retry.'); return; }
      setMe(j.profile);
      setSavedMsg(j.profile.published ? '✅ Your profile is public in Discover.' : '✅ Saved — your profile is hidden.');
    } catch { setSavedMsg('Network error. Please retry.'); }
    finally { setSaving(false); }
  };

  const count = list.length;
  const isSelf = (u: string) => me?.username && u.toLowerCase() === me.username.toLowerCase();
  const catList = useMemo(() => CATEGORIES, []);

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🔎</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>Discover</h2>
        <span style={{ fontSize: 12, color: TEC_COLORS.subtext }}>find people in the Pi economy</span>
      </div>

      {/* Your public profile — opt-in (sovereignty, C-107) */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.text }}>🪪 Your public profile</div>
          {me?.published
            ? <span style={{ fontSize: 11, color: TEC_COLORS.success, border: `1px solid ${TEC_COLORS.success}55`, borderRadius: 999, padding: '2px 10px' }}>
                {me.featured ? '⭐ Featured · Public' : 'Public'}
              </span>
            : <span style={{ fontSize: 11, color: TEC_COLORS.subtext, border: `1px solid ${TEC_COLORS.border}`, borderRadius: 999, padding: '2px 10px' }}>Hidden</span>}
        </div>
        <p style={{ fontSize: 12, color: TEC_COLORS.subtext, margin: '6px 0 12px', lineHeight: 1.5 }}>
          Publish a card so others can find and follow you. Opt-in — your graph stays yours (C-107).
          {me?.published && me.username && (
            <> Public link: <a href={`/u/${encodeURIComponent(me.username)}`} style={{ color: TEC_COLORS.gold }}>/u/{me.username}</a></>
          )}
        </p>
        <input style={field} value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)}
          placeholder="One line about what you do (e.g. Pi app developer)" maxLength={160} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {catList.map((c) => (
            <button key={c} style={chip(editCat === c)} onClick={() => setEditCat(c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={{ ...goldBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => save(true)}>
            {me?.published ? 'Update' : 'Publish to Discover'}
          </button>
          {me?.published && (
            <button disabled={saving} onClick={() => save(false)}
              style={{ background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.subtext, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Unpublish
            </button>
          )}
        </div>
        {savedMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: savedMsg.startsWith('✅') ? TEC_COLORS.gold : TEC_COLORS.error }}>{savedMsg}</div>}
      </div>

      {/* Directory */}
      <div style={card}>
        <input style={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" maxLength={80} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
          <button style={chip(cat === 'all')} onClick={() => setCat('all')}>all</button>
          {catList.map((c) => <button key={c} style={chip(cat === c)} onClick={() => setCat(c)}>{c}</button>)}
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {status === 'loading' && <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>Loading…</p>}
          {status === 'unavailable' && <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>Discover is unavailable right now. Please try again shortly.</p>}
          {status === 'ready' && count === 0 && (
            <p style={{ color: TEC_COLORS.subtext, fontSize: 13, textAlign: 'center' }}>
              No public profiles match yet. Publish yours above to be the first.
            </p>
          )}
          {status === 'ready' && list.map((p) => (
            <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href={`/u/${encodeURIComponent(p.username)}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.text }}>@{p.username}</span>
                  {p.verified && <span style={{ fontSize: 10, fontWeight: 800, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '1px 7px' }}>✅ Verified</span>}
                  {p.featured && <span style={{ fontSize: 10, fontWeight: 800, color: TEC_COLORS.gold }}>⭐</span>}
                </div>
                <div style={{ fontSize: 11, color: TEC_COLORS.gold, marginTop: 2, textTransform: 'capitalize' }}>
                  {p.category} · {p.followers} follower{p.followers === 1 ? '' : 's'}
                </div>
                {p.headline && <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 3, lineHeight: 1.4 }}>{p.headline}</div>}
              </a>
              {!isSelf(p.username) && (
                followed.has(p.username)
                  ? <span style={{ fontSize: 12, color: TEC_COLORS.success, whiteSpace: 'nowrap' }}>Following ✓</span>
                  : <button style={goldBtn} onClick={() => follow(p.username)}>Follow</button>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '14px 0 0', lineHeight: 1.5 }}>
          Verified badges are presented from Zone / KYC — Connection never mints them. ⭐ Featured is
          Connection Pro (reach only, ranks below verified). Trust is earned, never bought (C-107).
        </p>
      </div>
    </section>
  );
}
