import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { SessionExpiredNotice, isSessionExpiry } from '@/components/session/SessionExpiredNotice';

// A 401 from this app's own BFF means the token it holds is no longer good. The screen
// used to go silently empty (2026-10-16); it now says so and offers the Hub's SSO
// hand-off — the one way a Hub-entered session gets a fresh token.

const ORIGIN = 'https://connection.tecosystem.app';
const en = { session: { expiredTitle: 'Your session has ended', expiredBody: 'Open the app again from the Hub to continue.', reopen: 'Continue with the Hub', dismiss: 'Not now' } };

describe('which answers mean the session ended', () => {
  it('a 401 from this app\'s /api/bff/* — and nothing else', () => {
    expect(isSessionExpiry('/api/bff/connection/following', 401, ORIGIN)).toBe(true);
    expect(isSessionExpiry(`${ORIGIN}/api/bff/marketplace`, 401, ORIGIN)).toBe(true);
    expect(isSessionExpiry('/api/bff/connection/following', 200, ORIGIN)).toBe(false);
    expect(isSessionExpiry('/api/bff/connection/following', 403, ORIGIN)).toBe(false);
    // Not signed in yet is not an ended session.
    expect(isSessionExpiry('/api/auth/me', 401, ORIGIN)).toBe(false);
    // Another site's 401 is not ours.
    expect(isSessionExpiry('https://elsewhere.example/api/bff/x', 401, ORIGIN)).toBe(false);
  });
});

describe('the notice', () => {
  let realFetch: typeof fetch;
  beforeEach(() => { realFetch = window.fetch; });
  afterEach(() => { cleanup(); window.fetch = realFetch; });

  const mount = (status: number) => {
    window.fetch = vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch;
    return render(<SessionExpiredNotice />);
  };

  it('stays hidden while calls succeed', async () => {
    mount(200);
    await act(async () => { await window.fetch('/api/bff/connection/following'); });
    expect(screen.queryByText(en.session.expiredTitle)).toBeNull();
  });

  it('appears on a BFF 401, and the button goes through the Hub\'s SSO hand-off', async () => {
    mount(401);
    await act(async () => { await window.fetch('/api/bff/connection/following'); });
    await waitFor(() => expect(screen.getByText(en.session.expiredTitle)).toBeTruthy());
    expect(screen.getByText(en.session.expiredBody)).toBeTruthy();
    expect(screen.getByText(en.session.reopen)).toBeTruthy();
  });

  it('a 401 from /api/auth/me alone does not show it — that visitor just is not signed in', async () => {
    mount(401);
    await act(async () => { await window.fetch('/api/auth/me'); });
    expect(screen.queryByText(en.session.expiredTitle)).toBeNull();
  });

  it('can be dismissed', async () => {
    mount(401);
    await act(async () => { await window.fetch('/api/bff/connection/following'); });
    fireEvent.click(await screen.findByText(en.session.dismiss));
    expect(screen.queryByText(en.session.expiredTitle)).toBeNull();
  });

  it('puts the original fetch back when it unmounts', () => {
    const stub = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    window.fetch = stub;
    const { unmount } = render(<SessionExpiredNotice />);
    expect(window.fetch).not.toBe(stub);
    unmount();
    expect(window.fetch).toBe(stub);
  });
});
