'use client';

// Server-resolved session identity (C-123 §3). The client must NOT decide "who am I?"
// from document.cookie — Pi Browser stores the tec_user cookie so the SERVER sees it
// while hiding it from client JS, so getStoredUser()/usePiAuth() read null and the real
// Pi username never appears ("TEC Member" / "Not signed in"). /api/auth/me reads the
// request cookie server-side and returns the actual user. Fail closed (P6).
import { useEffect, useState } from 'react';
import { selfSignInStep, SELF_SIGNIN_EVENT } from '@/lib/pi/self-sign-in';

interface Me {
  username: string | null;
  authenticated: boolean;
  loading: boolean;
  /**
   * Why `/me` said no, in the words it used: `no_token` · `no_user` · `bad_user`
   * from the route, `http_<status>` for anything else, `network` when the request
   * never answered. Never a value from the session.
   *
   * It exists for one observation: an app opened from the Hub's Quest rendered
   * `/app` — which the page guard only serves to a WHOLE session — and the same
   * page then said "Not signed in", on some visits and not others. A check opened
   * by hand is a full navigation and says the session is fine; only this request,
   * from this page, can say what it was told.
   */
  reason: string | null;
  /**
   * How far this tab's own Pi sign-in got (self-sign-in.ts): `pi_waiting`,
   * `pi_auth_failed`, `login_http_401`, `landing_no_cookie`, … Live — it moves
   * while the page is open. Only worth showing next to a `reason`.
   */
  signIn: string | null;
  /** Which session cookies the refused `/me` request carried: `none`, `user+csrf`, … */
  cookies: string | null;
}

export function useMe(): Me {
  const [me, setMe] = useState<Omit<Me, 'signIn'>>({ username: null, authenticated: false, loading: true, reason: null, cookies: null });
  const [signIn, setSignIn] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setSignIn(selfSignInStep());
    read();
    const events = [SELF_SIGNIN_EVENT, 'tec-pi-ready', 'tec-pi-error'];
    events.forEach((e) => window.addEventListener(e, read));
    return () => events.forEach((e) => window.removeEventListener(e, read));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null) as Record<string, unknown> | null;
        if (!alive) return;
        const u = (r.ok ? d?.user ?? null : null) as Record<string, unknown> | null;
        const raw = u?.piUsername ?? u?.username ?? null;
        const said = typeof d?.reason === 'string' && /^[a-z_]{1,24}$/.test(d.reason) ? d.reason : null;
        setMe({
          username: typeof raw === 'string' && raw ? raw : null,
          authenticated: r.ok && d?.authenticated === true,
          loading: false,
          reason: r.ok ? null : said ?? `http_${r.status}`,
          cookies: !r.ok && typeof d?.cookies === 'string' && /^[a-z+]{1,32}$/.test(d.cookies) ? d.cookies : null,
        });
      })
      .catch(() => { if (alive) setMe((p) => ({ ...p, loading: false, reason: 'network' })); });
    return () => { alive = false; };
  }, []);

  return { ...me, signIn };
}
