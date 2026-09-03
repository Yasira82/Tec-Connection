'use client';

// A proper app Settings page for Connection (modeled on tec-assets' settings):
// sectioned, with a Profile card, an EN/AR language toggle that drives i18n + RTL,
// an About block, invite, and logout. Fully translated.
import { useEffect, useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { C, errorA, goldA, successA } from '@/lib-client/palette';
import { useTranslation, LOCALES } from '@/lib/i18n';
import { THEME_ORDER, readTheme, saveTheme, type ThemeChoice } from '@/lib-client/theme';
import { useMe } from '@/lib-client/hooks/useMe';
import { useBlocks } from '@/lib-client/connection/useBlocks';
import { InviteCard } from '@/components/referral/InviteCard';
import { Avatar } from '@/components/public/Avatar';
import { ProfileEditor } from './ProfileEditor';
import { ConnectionPro } from './ConnectionPro';
import { ModerationQueue } from './ModerationQueue';

const cardStyle = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
} as const;

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px', color: C.subtext }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ ...cardStyle, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}

function Row({ label, desc, children, first }: { label: string; desc?: string; children?: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 16px', borderTop: first ? 'none' : `1px solid ${C.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.subtext, marginTop: 2 }}>{desc}</div>}
      </div>
      {children != null && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  );
}

function Pills<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              border: `1px solid ${active ? C.gold : C.border}`,
              background: active ? goldA(0.12) : 'transparent',
              color: active ? C.gold : C.subtext,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsView() {
  const { t, locale, setLocale } = useTranslation();
  const { user, isAuthenticated, logout } = usePiAuth();
  const me = useMe();
  const s = t.connection.settings;
  // Prefer the server-resolved Pi username (/api/auth/me) — Pi Browser hides the
  // tec_user cookie from client JS, so usePiAuth alone shows no name / "Not signed in".
  const username = me.username ?? user?.piUsername ?? null;
  const blocks = useBlocks();

  // Reflect the real subscription (same source ConnectionPro reads).
  // Read on the CLIENT, after mount. The stored choice lives in localStorage,
  // which the server cannot see — initialising from it during render would make
  // the markup disagree with the boot script and hydrate wrong.
  const [theme, setTheme] = useState<ThemeChoice>('system');
  useEffect(() => { setTheme(readTheme()); }, []);

  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/bff/subscription', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const sub = ((d?.subscription ?? d) ?? {}) as Record<string, unknown>;
        const plan = String(sub.plan ?? '').toUpperCase();
        const active = sub.isActive === true || sub.status === 'ACTIVE';
        if (active && plan && plan !== 'FREE') setIsPro(true);
      })
      .catch(() => { /* fail closed to Free */ });
    return () => { alive = false; };
  }, []);

  // A resolved session, a live Pro subscription, or an authenticated hook state all
  // mean the user IS signed in — never show "Not signed in" to a member.
  const signedIn = me.authenticated || isAuthenticated || isPro || !!username;

  return (
    <div>
      {/* Profile */}
      <Section title={s.profile} icon="👤">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          {/* The Avatar component, NOT a hand-drawn disc.
              This card used to build its own gradient circle with the first
              letter of the handle — so it showed "Y" while the card directly
              below it, on the same screen, showed the uploaded photo. Two
              renderings of the same person, and the one at the top of Settings
              is the one people read as "my photo did not save". */}
          <span style={{ flexShrink: 0, display: 'block' }}>
            <Avatar username={username ?? '?'} size={56} tryPhoto />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              {username ? <bdi>@{username}</bdi> : signedIn ? s.member : s.notSignedIn}
            </div>
            <div style={{ fontSize: 13, color: C.subtext, marginTop: 2 }}>{isPro ? s.planPro : s.planFree}</div>
            {signedIn && (
              <span style={{
                display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700,
                color: C.success, background: successA(0.1),
                border: `1px solid ${successA(0.25)}`, borderRadius: 999, padding: '3px 10px',
              }}>● {s.connectedPi}</span>
            )}
          </div>
        </div>
      </Section>

      {/* Your public card — moved here from the Discover TAB, where a form was
          filling the first screen of the surface meant for finding people. */}
      <ProfileEditor />

      {/* Pro sits WITH the card it upgrades. Rendered after <SettingsView/> by
          the page, it landed below the Logout button — the destructive action
          should be the last thing on a settings screen, not the middle of it. */}
      <div style={{ marginTop: 18 }}><ConnectionPro /></div>

      {/* Appearance — theme and language, both driving the whole app */}
      <Section title={s.appearance} icon="🎨">
        <Row label={s.theme} desc={s.themeDesc} first>
          {/* Three options, not a switch. "System" is a real choice and the
              default: it means the app keeps following the phone, rather than
              freezing whatever the phone happened to be on at first launch.
              A two-state toggle cannot express that, and every reader whose
              phone is on automatic would silently lose it. */}
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_ORDER.map((v) => {
              const active = v === theme;
              return (
                <button
                  key={v}
                  onClick={() => { setTheme(v); saveTheme(v); }}
                  aria-pressed={active}
                  style={{
                    padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700,
                    border: `1px solid ${active ? C.gold : C.border}`,
                    background: active ? goldA(0.12) : 'transparent',
                    color: active ? C.gold : C.subtext,
                  }}
                >{v === 'system' ? s.themeSystem : v === 'light' ? s.themeLight : s.themeDark}</button>
              );
            })}
          </div>
        </Row>
        {/* All twelve, in their own scripts — as a SELECT, matching Explorer.
            It was a wrapping wall of twelve pills: three rows of chips that took
            more vertical space than every other setting combined, and pushed the
            About section off the screen. A language is chosen roughly once, so it
            should not be the largest thing in Settings.

            Each is written in ITS OWN SCRIPT. Someone who cannot read the current
            interface language cannot read "Vietnamese" either, but they can always
            read "Tiếng Việt". That is the whole reason a language menu lists
            native names.

            The public pages have spoken these languages since the front-door
            work; the two lists are the same list — LOCALES — so they cannot
            drift apart again. */}
        <Row label={s.language} desc={s.languageDesc} first>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            aria-label={s.language}
            style={{
              background: C.bg, color: C.text, fontSize: 14,
              border: `1px solid ${goldA(0.2)}`, borderRadius: 8,
              padding: '8px 10px', outline: 'none', maxWidth: 200,
            }}
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>{l.native}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* About */}
      {/* Blocked — always present, even when empty. A control you can only find
          after you have already used it is not a control; someone deciding
          whether to block should be able to see that it is reversible first. */}
      <Section title={t.app.blockedList} icon="🚫">
        {blocks.blocked.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: C.subtext }}>
            {blocks.loading ? t.app.loading : t.app.noBlocked}
          </div>
        ) : blocks.blocked.map((b, i) => (
          <div key={b.username} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
          }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <bdi>@{b.username}</bdi>
            </span>
            <button
              disabled={blocks.busy}
              onClick={() => { void blocks.unblock(b.username); }}
              style={{
                background: 'none', border: `1px solid ${C.border}`, color: C.subtext,
                borderRadius: 999, padding: '6px 14px', fontSize: 12.5,
                cursor: blocks.busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >{t.app.unblock}</button>
          </div>
        ))}
        {blocks.error && (
          <div style={{ padding: '0 16px 12px', fontSize: 12, color: C.error }}>{t.app.blockFailed}</div>
        )}
      </Section>

      {/* Renders nothing at all unless the SERVER says this session may review
          reports — the queue route answers 404 to everyone else, and this asks
          it rather than deciding locally. Placed beside Blocked because both
          are about the same thing: what to do about someone. */}
      <ModerationQueue />

      <Section title={s.about} icon="ℹ️">
        <Row label={s.version} first><span style={{ color: C.subtext, fontSize: 14 }}>1.0.0</span></Row>
        <Row label={s.domain}><span style={{ color: C.subtext, fontSize: 14 }}>connection.tecosystem.app</span></Row>
        <Row label={s.ecosystem}><span style={{ color: C.gold, fontSize: 14, fontWeight: 700 }}>TEC · 24</span></Row>
        <Row label={s.builtOn}><span style={{ color: C.subtext, fontSize: 14 }}>{s.builtOnPi}</span></Row>
      </Section>

      <div style={{ marginTop: 20 }}><InviteCard /></div>

      {signedIn && (
        <button
          onClick={() => { void logout(); }}
          style={{
            width: '100%', marginTop: 16, padding: '14px', cursor: 'pointer',
            background: errorA(0.06), border: `1px solid ${errorA(0.28)}`,
            borderRadius: 14, color: C.error, fontSize: 15, fontWeight: 800,
          }}>
          {s.logout}
        </button>
      )}
    </div>
  );
}
