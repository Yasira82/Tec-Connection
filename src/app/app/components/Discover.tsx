'use client';

// TEC Connection (C-107) — Discover. The graph was username-only: you could follow
// someone only if you already knew their handle. Discover is the opt-in PUBLIC
// directory that makes Pi users findable. Verification is PRESENTED (Zone/kyc), never
// minted; a ⭐ Featured card is Connection Pro = reach only (ranks BELOW verified —
// trust is earned, never bought). Publishing is opt-in (sovereignty); your identity
// is your session — the app never sends it.
import { useEffect, useMemo, useState } from 'react';
import { C, errorA, goldA, successA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { Avatar } from '@/components/public/Avatar';
import { useBlocks } from '@/lib-client/connection/useBlocks';
import { ReportSheet } from './ReportSheet';

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
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 16, padding: '20px 22px',
} as const;
const field = {
  width: '100%', background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14,
} as const;
const goldBtn = {
  background: C.gold,
  color: C.onGold, border: 'none', borderRadius: 10, padding: '9px 16px',
  fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;
const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  color: active ? C.onGold : C.text,
  background: active ? C.gold : 'transparent',
  border: `1px solid ${C.gold}${active ? '' : '33'}`,
  borderRadius: 999, padding: '6px 12px', cursor: 'pointer', textTransform: 'capitalize',
});

export function Discover({ onMessage }: {
  /** Start a direct chat with this person. Provided by the page, which owns
      conversations — Discover finds people, it does not open threads. */
  onMessage?: (username: string) => void;
} = {}) {
  const { t } = useTranslation();
  const a = t.app;
  const [query, setQuery] = useState('');
  const [cat,   setCat]   = useState<Category | 'all'>('all');
  const [list,  setList]  = useState<Card[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  // Blocking used to be reachable only from INSIDE an open conversation — so
  // the one place you meet a stranger was the one place you could not end it.
  const { isBlocked, block, unblock, busy: blockBusy } = useBlocks();
  const [armedBlock, setArmedBlock] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

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
          {status === 'loading' && <p style={{ color: C.subtext, fontSize: 13, textAlign: 'center' }}>{a.loading}</p>}
          {status === 'unavailable' && <p style={{ color: C.subtext, fontSize: 13, textAlign: 'center' }}>{a.discoverUnavailable}</p>}
          {status === 'ready' && count === 0 && (
            <p style={{ color: C.subtext, fontSize: 13, textAlign: 'center' }}>
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
                  <bdi style={{ fontSize: 14, fontWeight: 800, color: C.text }}>@{p.username}</bdi>
                  {p.verified && <span style={{ fontSize: 10, fontWeight: 800, color: C.success, background: successA(0.12), border: `1px solid ${successA(0.302)}`, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>✓ {t.public.verified}</span>}
                </div>
                {/* `capitalize` scoped to the category alone — on the whole
                    line it also title-cased the count: "184 Followers". */}
                <div style={{ fontSize: 11, color: C.gold, marginTop: 2 }}>
                  <span style={{ textTransform: 'capitalize' }}>{t.public.cat[p.category as keyof typeof t.public.cat] ?? p.category}</span>
                  {' · '}<bdi>{p.followers} {p.followers === 1 ? t.public.follower : t.public.followers}</bdi>
                  {/* ⭐ on the META line, not beside the name: a second badge
                      next to a long handle wraps and makes that one row taller.
                      It is also a paid placement, not part of who they are. */}
                  {p.featured && <span style={{ marginInlineStart: 6, color: C.subtext }}>⭐</span>}
                </div>
                {p.headline && <div style={{ fontSize: 12, color: C.subtext, marginTop: 3, lineHeight: 1.4 }}>{p.headline}</div>}
              </a>
              {!isSelf(p.username) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, flexShrink: 0 }}>
                  {followed.has(p.username)
                    ? <span style={{ fontSize: 12, color: C.success, whiteSpace: 'nowrap', textAlign: 'center' }}>{a.followingNow}</span>
                    : <button style={goldBtn} onClick={() => follow(p.username)}>{a.follow}</button>}
                  {/* Finding someone and then having to remember their handle to
                      write to them was the whole gap: the search that found them
                      is one tab away from the search that starts the chat. */}
                  {onMessage && !isBlocked(p.username) && (
                    <button
                      onClick={() => onMessage(p.username)}
                      style={{
                        background: 'none', border: `1px solid ${goldA(0.4)}`, color: C.gold,
                        borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >✉ {a.message}</button>
                  )}
                  {/* Two taps, and the button says so between them — a mis-tap
                      on a phone is easy and this one ends contact. */}
                  <button
                    disabled={blockBusy}
                    onClick={() => {
                      if (isBlocked(p.username)) { void unblock(p.username); return; }
                      if (armedBlock === p.username) { void block(p.username); setArmedBlock(null); }
                      else setArmedBlock(p.username);
                    }}
                    style={{
                      background: armedBlock === p.username ? errorA(0.078) : 'none',
                      border: `1px solid ${armedBlock === p.username ? C.error : C.border}`,
                      color: isBlocked(p.username) ? C.subtext : C.error,
                      borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >{isBlocked(p.username) ? a.unblock : armedBlock === p.username ? a.confirmBlock : a.block}</button>
                  {/* Quiet and last. Most people in a directory are not a
                      problem, and a loud accusation button on every card
                      changes how the whole list reads. */}
                  <button
                    onClick={() => setReporting(p.username)}
                    style={{
                      background: 'none', border: 'none', color: C.subtext,
                      padding: '2px 4px', fontSize: 11, cursor: 'pointer',
                      textDecoration: 'underline', whiteSpace: 'nowrap',
                    }}
                  >{a.report}</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {reporting && (
          <ReportSheet
            kind="user" target={reporting} author={reporting}
            onClose={() => setReporting(null)}
            onBlock={() => { void block(reporting); }}
          />
        )}

        {/* One line, once. The same three principles were previously restated
            at the bottom of every card on every tab. */}
        <p style={{ fontSize: 11, color: C.subtext, margin: '14px 0 0', lineHeight: 1.5 }}>
          {a.verifiedNote}
        </p>
      </div>
    </section>
  );
}
