import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inviteUrl, joinByInvite } from '@/lib-client/connection/useInvite';

// The invite link, and the two things about it that are easy to get wrong.
//
// 1. It is built from the browser's OWN origin. This app answers on two
//    hostnames — the domain and the Vercel one — and a link that hard-coded
//    either would send half the people who tap it to the host where their
//    session cookie is not. The link would look broken, and the cause would be
//    invisible from the screenshot.
//
// 2. A refused redemption is one answer, not two. Upstream deliberately reports
//    a wrong code and a withdrawn code identically; a client that told them
//    apart would hand back the very oracle the service refuses to be.

const origin = (o: string) => {
  Object.defineProperty(window, 'location', {
    value: new URL(o), writable: true, configurable: true,
  });
};

describe('inviteUrl', () => {
  it('is built from the current origin, whichever host that is', () => {
    origin('https://connection.tecosystem.app/app');
    expect(inviteUrl('abc123')).toBe('https://connection.tecosystem.app/app?invite=abc123');

    origin('https://tec-connection.vercel.app/app');
    expect(inviteUrl('abc123')).toBe('https://tec-connection.vercel.app/app?invite=abc123');
  });

  it('encodes the code', () => {
    origin('https://connection.tecosystem.app/app');
    // base64url has no characters needing escape, but the code is a value from
    // the server and this function must not be the place that assumes so.
    expect(inviteUrl('a+b/c=')).toBe('https://connection.tecosystem.app/app?invite=a%2Bb%2Fc%3D');
  });
});

describe('joinByInvite', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the conversation on success, unwrapping the nested envelope', async () => {
    // The gateway envelope is `{ success, data: {...} }`. Reading it flat gives
    // `undefined` with no error — the exact shape of the Session 27 incident.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'c1', title: 'TEC', joined: true } }),
    });
    await expect(joinByInvite('a-real-code')).resolves.toEqual({ id: 'c1' });
  });

  it('gives ONE answer for a wrong code and a withdrawn one', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(joinByInvite('made-up')).resolves.toBeNull();
  });

  it('is null when the network fails, not a throw', async () => {
    // A thrown error here reaches a click handler and becomes an unhandled
    // rejection; the screen would sit on "joining…" forever.
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(joinByInvite('a-real-code')).resolves.toBeNull();
  });

  it('is null when a 200 carries no id — a contract break is not a success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    await expect(joinByInvite('a-real-code')).resolves.toBeNull();
  });

  it('sends the code in the body, never in the URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'c1' } }) });
    await joinByInvite('a-real-code');
    // Asserted rather than destructured. `mock.calls[0]` is possibly undefined
    // under this project's strict index checks, and destructuring it is what
    // failed CI while passing every local run of the tests themselves — a type
    // error is invisible to the test runner.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    // A code in a query string lands in access logs and browser history. It is
    // a credential; it travels in the body.
    expect(call[0]).not.toContain('a-real-code');
    expect(JSON.parse(call[1].body)).toEqual({ code: 'a-real-code' });
  });
});
