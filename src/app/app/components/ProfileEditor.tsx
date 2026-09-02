'use client';

// "Your card" — the user's own public profile (C-107).
//
// This used to sit at the top of the Discover TAB, where it filled the first
// screen with a form on the one surface whose job is finding other people. It is
// a settings task — you edit it once and then forget it — so it lives in
// Settings, and Discover starts with people.
//
// Publishing is opt-in and stays that way: the toggle is the only thing that
// puts a person in the directory, and the state is shown as a plain word
// (Public / Hidden) rather than explained in a paragraph.
import { useEffect, useState } from 'react';
import { C, goldA, successA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { AvatarUpload } from './AvatarUpload';

const CATEGORIES = ['builder', 'merchant', 'creator', 'investor', 'mentor', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

interface MyProfile {
  username: string; headline: string; category: string;
  published: boolean; verified: boolean; featured: boolean;
  hasAvatar?: boolean;
  /** Whether the public page states this person's follower count (C-107 §14.5). */
  showFollowers?: boolean;
}

const card = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 16, padding: '18px 20px',
} as const;
const field = {
  width: '100%', boxSizing: 'border-box' as const, background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', fontSize: 14,
} as const;
const goldBtn = {
  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
  color: C.onGold, border: 'none', borderRadius: 10, padding: '10px 18px',
  fontSize: 13.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' as const,
};
const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
  color: active ? C.onGold : C.text,
  background: active ? `linear-gradient(135deg, ${C.gold}, ${C.goldDark})` : 'transparent',
  border: `1px solid ${C.gold}${active ? '' : '33'}`,
  borderRadius: 999, padding: '7px 13px', cursor: 'pointer', textTransform: 'capitalize',
});

export function ProfileEditor() {
  const { t } = useTranslation();
  const a = t.app;
  const [me, setMe] = useState<MyProfile | null>(null);
  const [headline, setHeadline] = useState('');
  const [cat, setCat] = useState<Category>('builder');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/bff/connection/profile/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { profile?: MyProfile } | null) => {
        if (!j?.profile) return;
        setMe(j.profile);
        setHeadline(j.profile.headline ?? '');
        setCat((CATEGORIES as readonly string[]).includes(j.profile.category) ? (j.profile.category as Category) : 'builder');
      })
      .catch(() => {});
  }, []);

  /**
   * `showFollowers` is sent ONLY when it is being changed.
   *
   * The backend treats an absent field as "leave it alone", and that is the
   * point: publishing or editing a headline must not carry a privacy setting
   * along with it. Sending the current value on every save would work today and
   * silently overwrite the stored value the moment the two drift.
   */
  const save = async (publish: boolean, showFollowers?: boolean) => {
    if (saving) return;
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/bff/connection/profile/me', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(), category: cat, published: publish,
          ...(typeof showFollowers === 'boolean' && { show_followers: showFollowers }),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { profile?: MyProfile; ok?: boolean };
      if (!res.ok || !j.ok || !j.profile) { setMsg(a.saveFailed); return; }
      setMe(j.profile);
      setMsg(j.profile.published ? a.savedPublic : a.savedHidden);
    } catch { setMsg(a.networkError); }
    finally { setSaving(false); }
  };

  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: C.subtext, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        🪪 {a.yourCard}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: C.subtext }}>
            {me?.published ? a.visibleInDiscover : a.notListed}
          </span>
          {me?.published
            ? <span style={{ fontSize: 11, fontWeight: 800, color: C.success, border: `1px solid ${successA(0.333)}`, borderRadius: 999, padding: '2px 10px' }}>
                {me.featured ? `⭐ ${a.publicBadge}` : a.publicBadge}
              </span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: C.subtext, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 10px' }}>{a.hiddenBadge}</span>}
        </div>

        {me?.username && (
          <AvatarUpload
            username={me.username}
            hasPhoto={Boolean(me.hasAvatar)}
            onChange={(has) => setMe((cur) => (cur ? { ...cur, hasAvatar: has } : cur))}
          />
        )}

        <input style={field} value={headline} onChange={(e) => setHeadline(e.target.value)}
          placeholder={a.headlinePlaceholder} maxLength={160} />

        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map((c) => (
            <button key={c} style={chip(cat === c)} onClick={() => setCat(c)}>{t.public.cat[c]}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button style={{ ...goldBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => save(true)}>
            {me?.published ? a.save : a.publish}
          </button>
          {me?.published && (
            <button disabled={saving} onClick={() => save(false)}
              style={{ background: 'none', border: `1px solid ${C.border}`, color: C.subtext, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {a.hide}
            </button>
          )}
        </div>

        {/* Who can see the follower count.
            `published` used to be one switch deciding everything a stranger
            could see. A follower count is a fact about the GRAPH, and C-107 §4
            says the graph is sovereign — so it gets its own control (§14.5).
            Shown only once the profile is public, because until then there is
            no page for it to appear on. */}
        {me?.published && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 16,
            paddingTop: 14, borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{a.showFollowers}</div>
              <div style={{ fontSize: 11.5, color: C.subtext, marginTop: 3, lineHeight: 1.5 }}>
                {me.showFollowers === false ? a.showFollowersOff : a.showFollowersOn}
              </div>
            </div>
            <button
              onClick={() => { void save(true, me.showFollowers === false); }}
              disabled={saving}
              aria-pressed={me.showFollowers !== false}
              style={{
                width: 46, height: 27, borderRadius: 999, flexShrink: 0, padding: 2,
                border: `1px solid ${me.showFollowers !== false ? C.gold : C.border}`,
                background: me.showFollowers !== false ? goldA(0.2) : 'transparent',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: me.showFollowers !== false ? 'flex-end' : 'flex-start',
              }}
            >
              <span style={{
                width: 21, height: 21, borderRadius: 999, display: 'block',
                background: me.showFollowers !== false ? C.gold : C.subtext,
              }} />
            </button>
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: msg.startsWith('✅') ? C.gold : C.error }}>{msg}</div>
        )}

        {me?.published && me.username && (
          <a href={`/u/${encodeURIComponent(me.username)}`}
            style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, color: C.gold, textDecoration: 'none' }}>
            {a.viewPublic}
          </a>
        )}
      </div>
    </section>
  );
}
