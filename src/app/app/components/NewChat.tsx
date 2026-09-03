'use client';

// TEC Connection (C-107) — "New chat" as a people picker.
//
// It used to be a bare text box: type an exact Pi username, press a button, and
// hope. There was no search of any kind, so a name you did not already know by
// heart could not be reached — and when the call failed the composer simply
// closed, taking the typed text with it and saying nothing. "It doesn't find
// anything" was an accurate description of a field that never looked.
//
// Now it searches the same public Discover directory the Discover tab uses, and
// starts with the people you already follow, which is who you are most likely to
// be writing to. Typing an exact handle still works — the last row offers it
// explicitly — so nothing that worked before stops working.
import { useEffect, useMemo, useState } from 'react';
import { C, goldA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';

interface Person { username: string; headline?: string; verified?: boolean }

const row = {
  width: '100%', textAlign: 'start' as const, display: 'flex', alignItems: 'center', gap: 12,
  padding: '11px 2px', background: 'none', border: 'none', cursor: 'pointer',
};

function Avatar({ name }: { name: string }) {
  return (
    <span style={{
      width: 40, height: 40, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
      color: C.onGold, fontSize: 17, fontWeight: 800,
    }}>{(name || '?').charAt(0).toUpperCase()}</span>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
      color: C.subtext, margin: '16px 0 2px',
    }}>{label}</div>
  );
}

export function NewChat({ onPick, onCancel, error }: {
  onPick: (username: string) => void;
  onCancel: () => void;
  /** Set by the parent when opening a chat failed, so the reason is visible. */
  error?: string | null;
}) {
  // Back returns to the conversation list rather than out of the app.
  useBackButton(true, onCancel);
  const { t } = useTranslation();
  const a = t.app;
  const [q, setQ] = useState('');
  const [following, setFollowing] = useState<string[]>([]);
  const [found, setFound] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch('/api/bff/connection/following', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = (j?.data ?? j ?? {}) as Record<string, unknown>;
        const list = (d.following ?? []) as unknown[];
        setFollowing(list.map((f) => (typeof f === 'string' ? f : String((f as Record<string, unknown>)?.username ?? ''))).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  // Debounced so a phone keyboard does not fire a request per keystroke.
  useEffect(() => {
    const term = q.trim().replace(/^@+/, '');
    if (term.length < 2) { setFound([]); setSearching(false); return; }
    setSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/bff/connection/discover?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setFound(((j?.profiles ?? []) as Person[]).slice(0, 20)))
        .catch(() => setFound([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const term = q.trim().replace(/^@+/, '').toLowerCase();

  const followingShown = useMemo(
    () => following.filter((u) => !term || u.toLowerCase().includes(term)),
    [following, term],
  );

  // Someone you follow who is also listed in the directory would otherwise
  // appear twice, one row above the other, which reads as a duplicate rather
  // than as two sources.
  const foundShown = useMemo(() => {
    const already = new Set(followingShown.map((u) => u.toLowerCase()));
    return found.filter((p) => !already.has(p.username.toLowerCase()));
  }, [found, followingShown]);

  // Whatever the directory does or does not know, an exact handle must stay
  // reachable — the directory is opt-in, so most people are not in it.
  const exactOffered = term.length > 0
    && !followingShown.some((u) => u.toLowerCase() === term)
    && !foundShown.some((p) => p.username.toLowerCase() === term);

  return (
    <section style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && term) onPick(term); }}
          placeholder={a.searchOrType}
          maxLength={100}
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            flex: 1, minWidth: 0, background: C.bg, color: C.text,
            border: `1px solid ${C.border}`, borderRadius: 999,
            padding: '11px 16px', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={onCancel} style={{
          background: 'none', border: `1px solid ${C.border}`, color: C.subtext,
          borderRadius: 999, padding: '9px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{a.cancel}</button>
      </div>

      {error && (
        <p style={{ color: C.error, fontSize: 12.5, margin: '0 0 8px' }}>{error}</p>
      )}

      {followingShown.length > 0 && <Section label={a.peopleYouFollow} />}
      {followingShown.map((u, i) => (
        <button key={u} onClick={() => onPick(u)}
          style={{ ...row, borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
          <Avatar name={u} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <bdi>@{u}</bdi>
          </span>
        </button>
      ))}

      {foundShown.length > 0 && <Section label={a.fromDiscover} />}
      {foundShown.map((p, i) => (
        <button key={p.username} onClick={() => onPick(p.username)}
          style={{ ...row, borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
          <Avatar name={p.username} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <bdi>@{p.username}</bdi>{p.verified ? ' ✅' : ''}
            </span>
            {p.headline && (
              <span style={{ display: 'block', fontSize: 12.5, color: C.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <bdi dir="auto">{p.headline}</bdi>
              </span>
            )}
          </span>
        </button>
      ))}

      {term.length >= 2 && !searching && foundShown.length === 0 && followingShown.length === 0 && (
        <p style={{ color: C.subtext, fontSize: 13, margin: '18px 0 0' }}>{a.noPeopleFound}</p>
      )}

      {exactOffered && (
        <button onClick={() => onPick(term)} style={{
          ...row, marginTop: 14, padding: '12px 14px',
          border: `1px solid ${goldA(0.333)}`, borderRadius: 14,
          background: goldA(0.071),
        }}>
          <span style={{ fontSize: 18 }}>✉</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>
            <bdi dir="auto">{a.messageExact.replace('{name}', term)}</bdi>
          </span>
        </button>
      )}
    </section>
  );
}
