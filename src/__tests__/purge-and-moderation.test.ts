import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Two pieces of logic added with the media-purge and moderation work, both of
// which fail SILENTLY when wrong — which is exactly why they are pinned here.
//
//   · takeMediaKeys — reads a NESTED envelope. Reading the flat shape returns
//     `undefined` with no error: the purge simply never runs, and the only
//     symptom is a storage bill nobody is watching. This platform has already
//     paid for that once (a BFF that read `.data.plan` on `.data.subscription.plan`
//     and locked Pro off for every paying user), so the shape is asserted, not
//     assumed.
//
//   · the moderator allowlist — the gate that decides whether the server spends
//     its INTERNAL_SECRET on a caller's behalf. Its failure mode is opening the
//     report queue, which names reporters.

describe('takeMediaKeys', () => {
  it('finds the key inside the NESTED envelope the gateway actually returns', async () => {
    const { takeMediaKeys } = await import('@/lib/connection/purge');
    const { keys, body } = takeMediaKeys({
      success: true,
      data: { deleted: true, scope: 'everyone', mediaKey: 'chat/abc/1.jpg' },
    });
    expect(keys).toEqual(['chat/abc/1.jpg']);
    // …and takes it OUT. A storage key must not reach a browser.
    expect((body.data as Record<string, unknown>).mediaKey).toBeUndefined();
    expect((body.data as Record<string, unknown>).deleted).toBe(true);
  });

  it('also handles a flat body, so a route need not know its envelope', async () => {
    const { takeMediaKeys } = await import('@/lib/connection/purge');
    const { keys, body } = takeMediaKeys({ deleted: true, mediaKey: 'stories/x.png' });
    expect(keys).toEqual(['stories/x.png']);
    expect(body.mediaKey).toBeUndefined();
  });

  it('collects a list of keys from a purge sweep', async () => {
    const { takeMediaKeys } = await import('@/lib/connection/purge');
    const { keys } = takeMediaKeys({
      data: { deleted: 3, mediaKeys: ['stories/a', 'stories/b', 'stories/c'] },
    });
    expect(keys).toHaveLength(3);
  });

  it('returns nothing for a delete that freed nothing', async () => {
    const { takeMediaKeys } = await import('@/lib/connection/purge');
    expect(takeMediaKeys({ data: { deleted: true, mediaKey: null } }).keys).toEqual([]);
  });
});

describe('purgeObjects', () => {
  const OLD = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...OLD }; vi.restoreAllMocks(); });

  it('refuses keys outside chat/ and stories/, and never calls storage for them', async () => {
    process.env.API_GATEWAY_URL = 'http://gw';
    process.env.INTERNAL_SECRET = 'x'.repeat(16);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { purgeObjects } = await import('@/lib/connection/purge');

    // An avatar and a KYC document are the two things this must never delete.
    const n = await purgeObjects(['avatars/me.jpg', 'kyc/passport.png', 'chat/../avatars/me.jpg']);
    expect(n).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends allowed keys to storage and reports what was deleted', async () => {
    process.env.API_GATEWAY_URL = 'http://gw';
    process.env.INTERNAL_SECRET = 'x'.repeat(16);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { deleted: 2, failed: [] } }), { status: 200 }),
    );
    const { purgeObjects } = await import('@/lib/connection/purge');

    expect(await purgeObjects(['chat/a.jpg', 'stories/b.png'])).toBe(2);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/storage/internal/purge-objects');
    expect((init.headers as Record<string, string>)['x-internal-key']).toBeTruthy();
  });

  it('reports 0 rather than throwing when storage is unreachable', async () => {
    process.env.API_GATEWAY_URL = 'http://gw';
    process.env.INTERNAL_SECRET = 'x'.repeat(16);
    // Once, not permanently: a rejection left on the shared fetch mock leaks
    // into later tests as an unhandled rejection and kills the runner.
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('down'));
    const { purgeObjects } = await import('@/lib/connection/purge');
    // The row is already gone; a failed purge must not become a failed delete.
    expect(await purgeObjects(['chat/a.jpg'])).toBe(0);
  });
});

describe('moderator allowlist', () => {
  const OLD = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...OLD }; });

  it('lets nobody in when unset — fails CLOSED', async () => {
    delete process.env.CONNECTION_MODERATORS;
    const { isModerator, moderationConfigured } = await import('@/lib/connection/moderators');
    expect(moderationConfigured).toBe(false);
    expect(isModerator('anyone')).toBe(false);
  });

  it('matches case-insensitively and ignores a leading @', async () => {
    process.env.CONNECTION_MODERATORS = '@Yasser172, magy888';
    const { isModerator } = await import('@/lib/connection/moderators');
    expect(isModerator('yasser172')).toBe(true);
    expect(isModerator('@MAGY888')).toBe(true);
    expect(isModerator('someone_else')).toBe(false);
    // An empty username is not a match against an empty list entry.
    expect(isModerator('')).toBe(false);
    expect(isModerator(null)).toBe(false);
  });

  it('reads the username from the session cookie, encoded or plain', async () => {
    const { sessionUsername } = await import('@/lib/connection/moderators');
    const user = { piUsername: 'yasser172', id: 'u1' };
    expect(sessionUsername(JSON.stringify(user))).toBe('yasser172');
    expect(sessionUsername(encodeURIComponent(JSON.stringify(user)))).toBe('yasser172');
    expect(sessionUsername(undefined)).toBeNull();
    expect(sessionUsername('not json')).toBeNull();
  });
});
