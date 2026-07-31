// Shared client helpers for capturing + applying a referral code.
//
// A referral code is NOT an auth token, so storing it client-side is allowed
// (the "no localStorage/sessionStorage for tokens" rule is about tec_access_token
// etc., not a marketing code). We keep it in BOTH sessionStorage (per-tab, cheap)
// and a short-lived `tec_ref` cookie so it survives the full-page SSO redirect
// and a fresh tab. SameSite=Lax is fine here — this is not a session cookie
// (C-123 forbids `lax` on SESSION cookies only).

export const REF_KEY = 'tec_ref';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const sanitize = (raw: string | null | undefined): string => {
  const v = (raw ?? '').trim().toUpperCase();
  // Codes are 8 unambiguous alnum chars; tolerate up to 16, alnum only.
  return /^[A-Z0-9]{1,16}$/.test(v) ? v : '';
};

const readCookie = (name: string): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith(`${name}=`))?.split('=')?.[1] ?? '';
};

/** Read a `?ref=CODE` from a query string and persist it. Returns the code, or ''. */
export function captureRef(search: string): string {
  if (typeof window === 'undefined') return '';
  let code = '';
  try {
    code = sanitize(new URLSearchParams(search).get('ref'));
  } catch {
    code = '';
  }
  if (!code) return '';
  try { sessionStorage.setItem(REF_KEY, code); } catch { /* ignore */ }
  try { document.cookie = `${REF_KEY}=${code}; path=/; max-age=${MAX_AGE_S}; samesite=lax`; } catch { /* ignore */ }
  return code;
}

/** The pending referral code (sessionStorage first, then the cookie), or ''. */
export function getPendingRef(): string {
  if (typeof window === 'undefined') return '';
  let v = '';
  try { v = sessionStorage.getItem(REF_KEY) ?? ''; } catch { /* ignore */ }
  if (!v) v = readCookie(REF_KEY);
  return sanitize(v);
}

/** Clear the pending referral code from every store. */
export function clearPendingRef(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(REF_KEY); } catch { /* ignore */ }
  try { document.cookie = `${REF_KEY}=; path=/; max-age=0; samesite=lax`; } catch { /* ignore */ }
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return readCookie('tec_csrf');
};

/**
 * Apply a referral code to the current (authenticated) account via the BFF.
 * Returns 'applied' on success, 'consumed' on a definitive rejection (already
 * referred / own code / past the window — nothing more to do, so stop retrying),
 * or 'retry' on a transient/network error (keep the code for a later attempt).
 */
export async function applyReferral(code: string): Promise<'applied' | 'consumed' | 'retry'> {
  const c = sanitize(code);
  if (!c) return 'consumed';
  try {
    const res = await fetch('/api/referral', {
      method:  'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body:    JSON.stringify({ code: c }),
    });
    if (res.ok) return 'applied';
    // 4xx = definitive (400 bad/own/past-window, 409 already referred). Stop.
    if (res.status >= 400 && res.status < 500) return 'consumed';
    return 'retry'; // 5xx / gateway blip
  } catch {
    return 'retry';
  }
}
