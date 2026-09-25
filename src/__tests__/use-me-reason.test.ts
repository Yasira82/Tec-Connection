/**
 * `useMe` says WHY it is signed out, in the word `/me` answered with.
 *
 * Seen on a phone: opened from the Hub's Quest, `/app` rendered — the guard
 * serves it only to a whole session — and Settings said "Not signed in". A
 * check opened by hand is a full navigation and reported the session as fine,
 * so only this request, from this page, can say what it was told.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMe } from '../lib-client/hooks/useMe';

const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('useMe reports the reason it was refused', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries the route\'s own word', async () => {
    answer(401, { authenticated: false, user: null, reason: 'no_user' });
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ authenticated: false, username: null, reason: 'no_user' });
  });

  it('names an unexpected status instead of guessing', async () => {
    answer(503, { error: 'down' });
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reason).toBe('http_503');
  });

  it('never echoes anything that is not a plain reason word', async () => {
    answer(401, { reason: '<b>hi</b>' });
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reason).toBe('http_401');
  });

  it('is silent when signed in', async () => {
    answer(200, { authenticated: true, user: { piUsername: 'pioneer' } });
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ authenticated: true, username: 'pioneer', reason: null });
  });

  it('says network when nothing answered', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reason).toBe('network');
  });

  it('carries how far this tab\'s own Pi sign-in got, and follows it live', async () => {
    sessionStorage.setItem('__tec_self_signin_step', 'pi_waiting');
    answer(401, { reason: 'no_token' });
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ reason: 'no_token', signIn: 'pi_waiting' });
    sessionStorage.setItem('__tec_self_signin_step', 'pi_auth_failed');
    window.dispatchEvent(new Event('tec-self-signin'));
    await waitFor(() => expect(result.current.signIn).toBe('pi_auth_failed'));
    sessionStorage.clear();
  });
});
