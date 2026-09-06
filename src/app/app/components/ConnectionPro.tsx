'use client';

// Connection Pro — the monetization surface (C-107 §7). A real Pi User-to-App
// payment — this also satisfies the Pi Portal "Process a Transaction" checklist
// step. ADR-007 dual-mode: Hub navigation → Mode 1 (Hub modal); standalone in Pi
// Browser → Mode 2 (direct createU2APayment). Approves under PI_API_KEY_CONNECTION.
import { useEffect, useState } from 'react';
import { C, goldA, successA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import {
  isHubNavigation,
  redirectToHubPayment,
  createPaymentRecord,
  createU2APayment,
  type PaymentStage,
} from '@/lib/pi-payment';
import { isTestnetHost } from '@/lib/pi-network';

const PRICE   = 5;                          // π / month
const ITEM_ID = 'connection_pro_monthly';
const MEMO    = 'TEC Connection — Pro (1 month)';

// Always render a STRING — a gateway/payment error body can be an object
// ({ code, message }); rendering it as a React child throws (minified #31).
const asText = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string')   return o.error;
    try { return JSON.stringify(v); } catch { return 'Payment failed.'; }
  }
  return v == null ? '' : String(v);
};

type Status = 'idle' | 'creating' | 'paying' | 'success' | 'error';

export function ConnectionPro() {
  const { t } = useTranslation();
  const a = t.app;
  const [piReady, setPiReady] = useState(false);
  const [status,  setStatus]  = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const busy = status === 'creating' || status === 'paying';

  // ── Why there is a diagnostic line on a payment card at all ────────────────
  // A Mode-2 payment can stall inside the Pi SDK, and while it does, NOTHING
  // reaches a server: no Vercel request, no payment-service log. The screen was
  // the only witness and it said "Confirm in Pi…" for two different steps. So
  // the screen has to say which one.
  //
  // It is shown only where a real buyer will not meet it: the `*.vercel.app`
  // host is the paired Testnet app (an internal surface by construction), plus
  // `?debug=1` for reproducing on the Mainnet host on purpose.
  const [stage,   setStage]   = useState<PaymentStage | null>(null);
  const [diag,    setDiag]    = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // What `Pi.init` ACTUALLY ran with, read back from the layout rather than
  // recomputed here — a second copy of the rule could disagree with the first,
  // and then the diagnostic line would be reporting on itself instead of on Pi.
  const [sandbox, setSandbox] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDiag(isTestnetHost(window.location.hostname)
            || new URLSearchParams(window.location.search).has('debug'));
  }, []);

  // Seconds on the clock. Without it a stall and a slow network look identical,
  // and "it just sat there" is not a report anyone can act on.
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  // Reflect the real subscription (activated by commerce-service when a Pro payment
  // completes). Pro ONLY while the period is live — no auto-renewal / no downgrade job.
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/bff/subscription', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json()).catch(() => ({}))
      .then((j: Record<string, unknown>) => {
        const d = (j?.data ?? j ?? {}) as Record<string, unknown>;
        const s = ((d?.subscription ?? d) ?? {}) as Record<string, unknown>;
        const end  = typeof s.current_period_end === 'string' ? new Date(s.current_period_end) : null;
        const live = s.isActive !== false && !(s.isExpired === true || (end !== null && end.getTime() < Date.now()));
        const plan = String(s.plan ?? '').toUpperCase();
        setIsSubscribed(live && (plan === 'PRO' || plan === 'ENTERPRISE'));
        // Renewal signal (Pi Pro is one-time, no auto-renewal) — commerce sends
        // daysRemaining; fall back to the period end. Drives a re-subscribe nudge.
        const days = typeof s.daysRemaining === 'number'
          ? s.daysRemaining
          : end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : null;
        setDaysRemaining(days);
      })
      .catch(() => {});
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    // `__TEC_PI_SANDBOX` is stamped by the layout's `load` handler, which can
    // run AFTER this component mounts — so it is read here, on the same signal
    // that says Pi is ready, and not in a mount-only effect that would race it.
    const readSandbox = () =>
      setSandbox((window as { __TEC_PI_SANDBOX?: boolean }).__TEC_PI_SANDBOX ?? null);
    if ((window as { __TEC_PI_READY?: boolean }).__TEC_PI_READY) { setPiReady(true); readSandbox(); return; }
    const h = () => { setPiReady(true); readSandbox(); };
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  // Mode-1 round-trip: the Hub returns to /app?payment_status=success|error.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p  = new URLSearchParams(window.location.search);
    const st = p.get('payment_status');
    if (!st) return;
    // Leave `message` empty and let the render fall back to the translated
    // default — reading `a` inside a mount-only effect would capture the locale
    // that happened to be active on the first render.
    if (st === 'success') setStatus('success');
    else if (st === 'error') { setStatus('error'); setMessage(''); }
    window.history.replaceState({}, '', '/app');
  }, []);

  const handleUpgrade = async () => {
    if (status === 'creating' || status === 'paying') return;

    // ADR-007 (C-76): check Hub navigation FIRST — before any Pi SDK call.
    if (isHubNavigation() || (window as { __TEC_PI_FOREIGN_SESSION?: boolean }).__TEC_PI_FOREIGN_SESSION
        || !(window as { Pi?: unknown }).Pi || !piReady) {
      redirectToHubPayment({ amount: PRICE, itemId: ITEM_ID, memo: MEMO });
      return;
    }

    // Mode 2 — standalone Pi Browser payment.
    setStatus('creating');
    setMessage('');
    setStage(null);
    try {
      const internalId = await createPaymentRecord(PRICE, ITEM_ID, MEMO);
      if (!internalId) {
        setStatus('error');
        setMessage(a.proCouldNotStart);
        return;
      }
      setStatus('paying');
      const result = await createU2APayment(PRICE, MEMO, { item_id: ITEM_ID, plan: 'connection_pro' }, internalId, setStage);
      if (result.stage) setStage(result.stage);
      if (result.success && result.status === 'completed') {
        setStatus('success');
      } else if (result.status === 'cancelled') {
        setStatus('idle');
      } else {
        setStatus('error');
        setMessage(asText(result.message) || a.proFailed);
      }
    } catch (err) {
      setStatus('error');
      setMessage(asText(err) || a.proFailed);
    }
  };

  const card: React.CSSProperties = {
    background:   C.surface,
    border:       `1px solid ${goldA(0.333)}`,
    borderRadius: 16,
    padding:      20,
    marginTop:    24,
  };

  if (isSubscribed) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${goldA(0.333)}`, borderRadius: 16, padding: 20, marginTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{a.proActive}</div>
        <div style={{ fontSize: 12, color: C.subtext, marginTop: 6 }}>
          {a.proSubActive}
        </div>
        {typeof daysRemaining === 'number' && (
          <div style={{ fontSize: 12, fontWeight: daysRemaining <= 7 ? 700 : 600, color: daysRemaining <= 7 ? C.gold : C.subtext, marginTop: 8 }}>
            {daysRemaining <= 7 ? '⏳ ' : ''}
            {a.proExpires.replace('{days}', String(daysRemaining))}
            {daysRemaining <= 7 ? ` — ${a.proRenewNote}` : '.'}
          </div>
        )}
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{ ...card, borderColor: successA(0.4) }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.success }}>{a.proPaid}</div>
        <div style={{ fontSize: 12, color: C.subtext, marginTop: 6 }}>
          {a.proPaidBody}
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>🔗 {a.proTitle}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
          {PRICE}π<span style={{ fontSize: 12, color: C.subtext, fontWeight: 600 }}> {a.perMonth}</span>
        </div>
      </div>
      {/* Two lines, not a paragraph. The previous copy ran seven lines and ended
          with "(those are earned, C-107)" — an internal constitutional reference
          on a payment card. The rule it protects still holds and is still stated,
          in four words, at the bottom. */}
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 7 }}>
        <li style={{ fontSize: 13, color: C.text, display: 'flex', gap: 8 }}>
          <span aria-hidden="true">👥</span>
          <span>{a.proBenefit1}</span>
        </li>
        <li style={{ fontSize: 13, color: C.text, display: 'flex', gap: 8 }}>
          <span aria-hidden="true">⭐</span>
          <span>{a.proBenefit2}</span>
        </li>
      </ul>
      <div style={{ fontSize: 11.5, color: C.subtext, marginTop: 10 }}>
        {a.proReachOnly}
      </div>

      <button
        onClick={() => { void handleUpgrade(); }}
        disabled={busy}
        style={{
          marginTop: 14, width: '100%', padding: '12px 16px', borderRadius: 12,
          background: busy ? C.surface3 : C.gold,
          color: busy ? C.subtext : C.onGold,
          border: 'none', fontSize: 14, fontWeight: 800,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'creating' ? a.proPreparing
          : status === 'paying' ? a.proConfirm
          : `${a.proUpgrade} — ${PRICE}π ${a.perMonth}`}
      </button>

      {status === 'error' && (
        <div style={{ fontSize: 12, color: C.error, marginTop: 10 }}>{message || a.proNotCompleted}</div>
      )}

      {/* Machine tokens, not prose — identifiers straight out of the code, the
          seconds on the clock, and the flag `Pi.init` actually ran with. There
          is no English word here to translate, and a translated stage name
          would be useless in a bug report. The i18n guard is satisfied for the
          real reason, not dodged. */}
      {diag && (busy || status === 'error') && (
        <div style={{
          fontSize: 11, color: C.subtext, marginTop: 8,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {[
            `⚙ ${stage ?? (status === 'creating' ? 'create_record' : '?')}`,
            busy ? `${elapsed}s` : null,
            `sandbox=${String(sandbox)}`,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}
