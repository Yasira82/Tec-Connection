'use client';

// TEC Referral — "Invite & Earn" CTA (C-133 growth). The invite-out half of the
// referral loop: a signed-in user gets their own code + a shareable link back to
// THIS app (so attribution + reward land platform-side, commerce-service). The
// referral SYSTEM is owned by the platform (Hub → commerce-service); this card is
// only a per-app surface over the shared `/api/referral` proxy. Real data only
// (C-135 §4): the code is fetched live; with no session it shows an honest prompt.
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';

export function InviteCard() {
  const [code, setCode]   = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'anon'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/referral', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const c = d?.data?.referral?.code;
        if (c) { setCode(String(c)); setState('ready'); }
        else setState('anon');
      })
      .catch(() => { if (alive) setState('anon'); });
    return () => { alive = false; };
  }, []);

  const link = code && typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${code}`
    : '';

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked — the link is shown for manual copy */ }
  };

  const card: React.CSSProperties = {
    background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}33`,
    borderRadius: 12, padding: 16, marginTop: 20,
  };

  if (state === 'loading') return null;

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎁</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: TEC_COLORS.text }}>Invite &amp; earn</span>
      </div>

      {state === 'anon' ? (
        <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: '8px 0 0', lineHeight: 1.6 }}>
          Sign in with Pi to get your invite link — share it and earn a reward when a friend joins.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext, margin: '8px 0 12px', lineHeight: 1.6 }}>
            Share your link — you both earn when a friend joins TEC through it.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <code style={{ flex: 1, minWidth: 200, fontSize: 12, color: TEC_COLORS.gold, background: '#00000030', border: `1px solid ${TEC_COLORS.gold}22`, borderRadius: 8, padding: '9px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {link}
            </code>
            <button
              onClick={copy}
              style={{ fontSize: 13, fontWeight: 800, color: '#0a0800', background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
