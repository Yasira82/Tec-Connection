'use client';

// A proper app Settings page for Connection (modeled on tec-assets' settings):
// sectioned, with a Profile card, an EN/AR language toggle that drives i18n + RTL,
// an About block, invite, and logout. Fully translated.
import { useEffect, useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation, LOCALES } from '@/lib/i18n';
import { useMe } from '@/lib-client/hooks/useMe';
import { useBlocks } from '@/lib-client/connection/useBlocks';
import { InviteCard } from '@/components/referral/InviteCard';
import { ProfileEditor } from './ProfileEditor';
import { ConnectionPro } from './ConnectionPro';
import { ModerationQueue } from './ModerationQueue';

const cardStyle = {
  background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`, borderRadius: 16,
} as const;

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px', color: TEC_COLORS.subtext }}>
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
      padding: '14px 16px', borderTop: first ? 'none' : `1px solid ${TEC_COLORS.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEC_COLORS.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 2 }}>{desc}</div>}
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
              border: `1px solid ${active ? TEC_COLORS.gold : TEC_COLORS.border}`,
              background: active ? 'rgba(251,180,74,0.12)' : 'transparent',
              color: active ? TEC_COLORS.gold : TEC_COLORS.subtext,
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
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: '#0a0800',
          }}>{(username ?? 'Y').charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text }}>
              {username ? <bdi>@{username}</bdi> : signedIn ? s.member : s.notSignedIn}
            </div>
            <div style={{ fontSize: 13, color: TEC_COLORS.subtext, marginTop: 2 }}>{isPro ? s.planPro : s.planFree}</div>
            {signedIn && (
              <span style={{
                display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700,
                color: TEC_COLORS.success, background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.25)', borderRadius: 999, padding: '3px 10px',
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

      {/* Appearance — language choice drives the whole app (i18n + RTL) */}
      <Section title={s.appearance} icon="🎨">
        {/* All twelve, in their own scripts. The public pages have spoken these
            languages since the front-door work; a settings panel still offering
            EN/AR was the app disagreeing with itself, and the two lists are now
            the same list — LOCALES — so they cannot drift apart again.
            A wrapping row rather than Pills: twelve options do not fit one line
            on a phone, and a horizontal scroller hides most of them. */}
        <Row label={s.language} desc={s.languageDesc} first>
          <div />
        </Row>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '2px 0 14px' }}>
          {LOCALES.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                lang={l.code}
                aria-pressed={active}
                style={{
                  fontSize: 12.5, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap',
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  color: active ? '#0a0800' : TEC_COLORS.text,
                  background: active ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent',
                  border: `1px solid ${active ? 'transparent' : TEC_COLORS.border}`,
                }}>
                {l.native}
              </button>
            );
          })}
        </div>
      </Section>

      {/* About */}
      {/* Blocked — always present, even when empty. A control you can only find
          after you have already used it is not a control; someone deciding
          whether to block should be able to see that it is reversible first. */}
      <Section title={t.app.blockedList} icon="🚫">
        {blocks.blocked.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: TEC_COLORS.subtext }}>
            {blocks.loading ? t.app.loading : t.app.noBlocked}
          </div>
        ) : blocks.blocked.map((b, i) => (
          <div key={b.username} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}`,
          }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <bdi>@{b.username}</bdi>
            </span>
            <button
              disabled={blocks.busy}
              onClick={() => { void blocks.unblock(b.username); }}
              style={{
                background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.subtext,
                borderRadius: 999, padding: '6px 14px', fontSize: 12.5,
                cursor: blocks.busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >{t.app.unblock}</button>
          </div>
        ))}
        {blocks.error && (
          <div style={{ padding: '0 16px 12px', fontSize: 12, color: TEC_COLORS.error }}>{t.app.blockFailed}</div>
        )}
      </Section>

      {/* Renders nothing at all unless the SERVER says this session may review
          reports — the queue route answers 404 to everyone else, and this asks
          it rather than deciding locally. Placed beside Blocked because both
          are about the same thing: what to do about someone. */}
      <ModerationQueue />

      <Section title={s.about} icon="ℹ️">
        <Row label={s.version} first><span style={{ color: TEC_COLORS.subtext, fontSize: 14 }}>1.0.0</span></Row>
        <Row label={s.domain}><span style={{ color: TEC_COLORS.subtext, fontSize: 14 }}>connection.tecosystem.app</span></Row>
        <Row label={s.ecosystem}><span style={{ color: TEC_COLORS.gold, fontSize: 14, fontWeight: 700 }}>TEC · 24</span></Row>
        <Row label={s.builtOn}><span style={{ color: TEC_COLORS.subtext, fontSize: 14 }}>{s.builtOnPi}</span></Row>
      </Section>

      <div style={{ marginTop: 20 }}><InviteCard /></div>

      {signedIn && (
        <button
          onClick={() => { void logout(); }}
          style={{
            width: '100%', marginTop: 16, padding: '14px', cursor: 'pointer',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.28)',
            borderRadius: 14, color: '#ef4444', fontSize: 15, fontWeight: 800,
          }}>
          {s.logout}
        </button>
      )}
    </div>
  );
}
