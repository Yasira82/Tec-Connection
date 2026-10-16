'use client';

import { useEffect, useState } from 'react';
import { ssoRedirect } from '@yasser172/tec-auth';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';

// Two languages here, as SignInGate does: the page's own <html lang> picks one.
const COPY = {
  en: { title: 'Your session has ended', body: 'Open the app again from the Hub to continue.', reopen: 'Continue with the Hub', dismiss: 'Not now' },
  ar: { title: 'انتهت جلستك', body: 'افتح التطبيق من الـ Hub مرة أخرى للمتابعة.', reopen: 'المتابعة عبر الـ Hub', dismiss: 'ليس الآن' },
} as const;

/**
 * A 401 from this app's own BFF means the session token it holds is no longer good —
 * on 2026-10-16 every refreshed session lived ten minutes (tec-core-backend #429), and
 * every screen here went silently empty. This app cannot renew a Hub-entered session by
 * itself: the Hub hands over an access token, not a refresh token, and a Pi sign-in is
 * refused in the Hub's foreign session (ADR-007). So it SAYS so, and offers the one way
 * back that works: the Hub's SSO hand-off, which issues a fresh token to this app.
 *
 * Watches fetch rather than every call site: one place, so a new screen cannot forget.
 * Only same-origin /api/bff/* answers count — never /api/auth/*, which answer 401 for a
 * visitor who simply is not signed in yet.
 */
export const isSessionExpiry = (url: string, status: number, origin: string): boolean => {
  if (status !== 401) return false;
  // A path ("/api/bff/…") is this origin by definition — the screens call it that way.
  if (url.startsWith('/') && !url.startsWith('//')) return url.startsWith('/api/bff/');
  try {
    const u = new URL(url);
    return u.origin === origin && u.pathname.startsWith('/api/bff/');
  } catch { return false; }
};

export function SessionExpiredNotice() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [expired, setExpired] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setLang((document.documentElement.lang || '').toLowerCase().startsWith('ar') ? 'ar' : 'en');
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (isSessionExpiry(url, res.status, window.location.origin)) setExpired(true);
      return res;
    };
    return () => { window.fetch = original; };
  }, []);

  if (!expired || dismissed) return null;
  const t = COPY[lang];
  return (
    <div role="alert" style={{
      position: 'fixed', insetInline: 12, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 1000,
      background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 14, padding: '14px 16px',
      color: 'var(--tec-text-1)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tec-gold)' }}>{t.title}</div>
      <div style={{ fontSize: 13, marginTop: 4, color: 'var(--tec-text-3)' }}>{t.body}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => ssoRedirect(HUB_URL, window.location.href)}
          style={{ flex: 1, background: 'var(--tec-gold)', color: 'var(--tec-bg)', border: 'none', borderRadius: 10, padding: '10px 12px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {t.reopen}
        </button>
        <button type="button" onClick={() => setDismissed(true)}
          style={{ background: 'transparent', color: 'var(--tec-text-3)', border: '1px solid var(--tec-border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}>
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
