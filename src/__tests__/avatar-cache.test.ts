// @vitest-environment node
//
// A profile photo the owner had DELETED kept being painted at the top of
// Settings — on the same screen as a card offering to add one.
//
// The route sent `max-age=3600, s-maxage=86400`, reasoning that a change mints
// a new key and the page asks for `?v=<n>`. Only the upload control does that.
// Every other surface — Settings, Discover, the message list, the shared
// profile card — asks for the bare URL through `tryPhoto`, which exists
// precisely because those surfaces do not know a version exists. So the browser
// answered from its own cache for an hour and never asked.
//
// The fix is a validator, not a shorter guess: the stored object key says which
// photo is current, so it becomes an ETag and the browser spends one conditional
// request instead of trusting a clock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

process.env.API_GATEWAY_URL = 'https://gw.example.com';
process.env.INTERNAL_SECRET = 'secret';

const { avatarETag } = await import('@/lib/connection/avatar');
const { GET } = await import('@/app/api/avatar/[username]/route');

const params = (username: string) => ({ params: Promise.resolve({ username }) });
const req = (headers: Record<string, string> = {}) =>
  ({ headers: new Headers(headers) }) as never;

/** gateway: avatar-key → `key`, then storage → bytes. */
function gateway(key: string | null) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/avatar-key')) {
      return { ok: true, json: async () => ({ data: { key } }) } as never;
    }
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new ArrayBuffer(8),
    } as never;
  });
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('the photo is revalidated, never held on a clock', () => {
  it('does not tell a browser to keep the bytes without asking again', async () => {
    vi.stubGlobal('fetch', gateway('avatars/yas/a.jpg'));
    const res = await GET(req(), params('yas'));
    const cc = res.headers.get('cache-control') ?? '';

    expect(cc).toContain('must-revalidate');
    expect(cc).toContain('max-age=0');
    // The exact values that let a deleted photo survive on screen.
    expect(cc).not.toMatch(/max-age=[1-9]/);
    expect(cc).not.toContain('s-maxage=86400');
  });

  it('sends a validator derived from the key', async () => {
    vi.stubGlobal('fetch', gateway('avatars/yas/a.jpg'));
    const res = await GET(req(), params('yas'));
    expect(res.headers.get('etag')).toBe(await avatarETag('avatars/yas/a.jpg'));
  });

  it('answers 304 when the browser already holds the current photo', async () => {
    const key = 'avatars/yas/a.jpg';
    const fetchSpy = gateway(key);
    vi.stubGlobal('fetch', fetchSpy);

    const res = await GET(req({ 'if-none-match': await avatarETag(key) }), params('yas'));
    expect(res.status).toBe(304);

    // And the image was never pulled out of storage to say so.
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/avatar-key'))).toBe(true);
    expect(urls.some((u) => u.includes('public-object'))).toBe(false);
  });

  it('a REPLACED photo does not match the old validator', async () => {
    const before = await avatarETag('avatars/yas/a.jpg');
    vi.stubGlobal('fetch', gateway('avatars/yas/b.jpg'));

    const res = await GET(req({ 'if-none-match': before }), params('yas'));
    expect(res.status).toBe(200);
  });

  it('tolerates a weak tag and a list, as a shared cache may send', async () => {
    const key = 'avatars/yas/a.jpg';
    vi.stubGlobal('fetch', gateway(key));
    const etag = await avatarETag(key);

    const res = await GET(req({ 'if-none-match': `W/${etag}, "other"` }), params('yas'));
    expect(res.status).toBe(304);
  });
});

describe('a removal reaches a browser that is holding the old photo', () => {
  it('never caches "there is no photo"', async () => {
    vi.stubGlobal('fetch', gateway(null));
    const res = await GET(req(), params('yas'));

    expect(res.status).toBe(404);
    // The answer most likely to change is the one that must not be stored.
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('the object key stays on the server (C-107)', () => {
  it('the ETag is a hash, not the key', async () => {
    const key = 'avatars/yas/secret-object-name.jpg';
    const etag = await avatarETag(key);
    expect(etag).not.toContain('secret-object-name');
    expect(etag).not.toContain('avatars/');
    expect(etag).toMatch(/^"[A-Za-z0-9_-]{22}"$/);
  });

  it('two keys do not share a tag', async () => {
    expect(await avatarETag('a')).not.toBe(await avatarETag('b'));
  });
});
