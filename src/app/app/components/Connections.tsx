'use client';

// TEC Connection (C-107) — slice 1: Follow / Connect. The user's own social graph
// (self-declared, strong consistency). Follower = session identity (server-scoped);
// the client only ever sends the followee username.
import { useState, useMemo } from 'react';
import { C } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useConnection } from '@/lib-client/connection/useConnection';
import { usePresence } from '@/lib-client/connection/usePresence';

const card = {
  background:   C.surface,
  border:       `1px solid ${C.border}`,
  borderRadius: 16,
  padding:      '20px 22px',
} as const;

const inputStyle = {
  flex: 1, minWidth: 0, background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14,
} as const;

const goldBtn = {
  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
  color: C.onGold, border: 'none', borderRadius: 10, padding: '10px 16px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 84 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.gold }}>{value}</div>
      <div style={{ fontSize: 11, color: C.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

export function Connections() {
  const { t } = useTranslation();
  const a = t.app;
  const { following, stats, loading, busy, error, follow, unfollow } = useConnection();
  const [username, setUsername] = useState('');
  const followedNames = useMemo(() => following.map((f) => f.username), [following]);
  const { isOnline } = usePresence(followedNames);
  const onlineCount = following.filter((f) => isOnline(f.username)).length;

  const submit = async () => {
    const u = username.trim().replace(/^@+/, '');
    if (!u) return;
    setUsername('');
    await follow(u);
  };

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🤝</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{a.connections}</h2>
        {onlineCount > 0 ? (
          <span style={{ fontSize: 12, color: C.success, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: C.success }} />
            {onlineCount} {a.onlineCount}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: C.subtext }}>{a.yourGraph}</span>
        )}
      </div>

      <div style={{ ...card }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          <Stat label={a.followingLbl} value={stats.following} />
          <div style={{ width: 1, background: C.border }} />
          <Stat label={a.followers} value={stats.followers} />
        </div>

        {/* Follow input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder={a.followPlaceholder}
            maxLength={100}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>{a.follow}</button>
        </div>

        {error && <p style={{ color: C.error, fontSize: 13, marginTop: 10 }}>{error}</p>}

        {/* Following list */}
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <p style={{ color: C.subtext, fontSize: 13 }}>{a.loading}</p>
          ) : following.length === 0 ? (
            <p style={{ color: C.subtext, fontSize: 13 }}>
              {a.noConnections}
            </p>
          ) : (
            following.map((f, i) => (
              <div key={f.username}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <span style={{ position: 'relative', flexShrink: 0, width: 30, height: 30 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                    background: C.bg, border: `1px solid ${C.border}`, color: C.gold, fontSize: 13, fontWeight: 800,
                  }}>{f.username.charAt(0).toUpperCase()}</span>
                  {isOnline(f.username) && (
                    <span title={a.onlineNow} style={{
                      position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 10, height: 10, borderRadius: 999,
                      background: C.success, border: `2px solid ${C.surface}`,
                    }} />
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <bdi>@{f.username}</bdi>
                </span>
                <button onClick={() => unfollow(f.username)} disabled={busy} title={a.unfollow}
                  style={{ background: 'none', border: `1px solid ${C.border}`, color: C.subtext,
                           borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                  {a.unfollow}
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </section>
  );
}
