/**
 * The landing sends a signed-in member into the app on the SERVER's word, not
 * only on the browser's copy of `tec_user`.
 *
 * Production, 2026-10-10: every SSO landing wrote `tec_user` encoded twice. The
 * browser copy could not be read, usePiAuth() said "signed out", and this page
 * kept a member on the sign-in button — while /app (which asks /api/auth/me)
 * opened. Fixing the writer did not reach a browser that still held the old
 * cookie, so the landing asks the server too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';

let auth = { isAuthenticated: false, isLoading: false, user: null as unknown };
const replace = vi.fn();
vi.mock('@yasser172/tec-auth', () => ({ usePiAuth: () => auth, ssoRedirect: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { Landing } from '@/components/landing/Landing';
import { en } from '@/lib/i18n/dictionaries/en';

const me = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status } as Response)));
const page = () => render(<Landing profiles={[]} t={en.public} locale="en" />);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { auth = { isAuthenticated: false, isLoading: false, user: null }; replace.mockReset(); });

describe('the landing and a signed-in member', () => {
  it('the browser copy is unreadable but the server says yes → into the app', async () => {
    me(200);
    page();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
  });

  it('the server says no → stays here, with the sign-in button', async () => {
    me(401);
    page();
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });

  it('a readable browser copy still goes straight in', async () => {
    auth = { isAuthenticated: true, isLoading: false, user: { id: 'u' } };
    me(401);
    page();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
  });
});
