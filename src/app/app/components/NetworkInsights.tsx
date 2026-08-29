'use client';

// TEC Connection (C-107) — Network Insights (Connection Pro). A real, standalone Pro
// service (not just reach): see WHO follows you + whether it's mutual, and follow back
// in one tap. Like "who viewed your profile" — valuable with zero population because
// it's your OWN relationship data. The list is gated server-side behind live Pro (P5);
// the follower count is shown to everyone as an honest teaser. Own-scope (P6).
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

interface Follower { username: string; mutual: boolean; }

const card = {
  background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}33`,
  borderRadius: 16, padding: '20px 22px',
} as const;

export function NetworkInsights() {
  const { t } = useTranslation();
  const a = t.app;
  const [pro, setPro] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/bff/connection/followers', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { pro?: boolean; count?: number; followers?: Follower[] } | null) => {
        if (!j) { setPro(false); return; }
        setPro(Boolean(j.pro));
        setCount(Number(j.count ?? 0));
        setFollowers(Array.isArray(j.followers) ? j.followers : []);
      })
      .catch(() => setPro(false))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const followBack = async (username: string) => {
    setFollowedBack((s) => new Set(s).add(username));
    try {
      await fetch('/api/bff/connection/following', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
      });
    } catch { setFollowedBack((s) => { const n = new Set(s); n.delete(username); return n; }); }
  };

  if (loading || pro === null) return null;

  const nonMutual = followers.filter((f) => !f.mutual).length;

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>📈</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>{a.networkInsights}</h2>
        <span style={{ fontSize: 11, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '1px 8px' }}>{a.proTag}</span>
      </div>

      {!pro ? (
        // Honest teaser — the real count, list locked behind Pro.
        <div style={card}>
          {/* Honest and short: the real number, then one sentence for what Pro
              adds. The upgrade lives in Settings, so the pointer names it —
              "upgrade above" was wrong the moment Pro stopped sitting on this
              screen, and a dead instruction is worse than none. */}
          <div style={{ fontSize: 15, fontWeight: 800, color: TEC_COLORS.text }}>
            🔒 {count} {count === 1 ? t.public.follower : t.public.followers}
          </div>
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: '6px 0 0', lineHeight: 1.55 }}>
            {a.proReveals}
          </p>
          <p style={{ fontSize: 12, color: TEC_COLORS.gold, margin: '10px 0 0', fontWeight: 700 }}>
            {a.proWhere}
          </p>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TEC_COLORS.gold }}>{count}</div>
              <div style={{ fontSize: 11, color: TEC_COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.followers}</div>
            </div>
            <div style={{ width: 1, background: TEC_COLORS.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TEC_COLORS.gold }}>{nonMutual}</div>
              <div style={{ fontSize: 11, color: TEC_COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.notFollowedBack}</div>
            </div>
          </div>

          {followers.length === 0 ? (
            <p style={{ fontSize: 13, color: TEC_COLORS.subtext }}>{a.publishPrompt}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {followers.map((f, i) => (
                <div key={f.username}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
                  <span style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: TEC_COLORS.bg, border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.gold, fontSize: 13, fontWeight: 800 }}>
                    {f.username.charAt(0).toUpperCase()}
                  </span>
                  <a href={`/u/${encodeURIComponent(f.username)}`} style={{ flex: 1, minWidth: 0, fontSize: 14, color: TEC_COLORS.text, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <bdi>@{f.username}</bdi>
                  </a>
                  {f.mutual || followedBack.has(f.username)
                    ? <span style={{ fontSize: 12, color: TEC_COLORS.success, whiteSpace: 'nowrap' }}>{a.mutual}</span>
                    : <button onClick={() => followBack(f.username)}
                        style={{ background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, color: '#0a0800', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {a.followBack}
                      </button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
