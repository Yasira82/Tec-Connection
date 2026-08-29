// @vitest-environment node
//
// Profile photos (C-107). The two rules worth pinning are the ones a reviewer
// cannot see and a user would never report:
//
//   · What is accepted for upload. Storage's own limits are deliberately WIDER
//     (10MB, any image type, GIF included) because it also serves KYC documents
//     and asset media. The avatar rules are Connection's, so Connection states
//     them — and if this drifts, the symptom is a 12MB animated GIF rendering in
//     a 46px circle on the front door, not an error.
//   · That the avatar route serves ONLY images. The bytes originate from user
//     upload; passing an unexpected content type straight through to a browser
//     is how an "image" host starts serving something a browser will execute.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set BEFORE the module is loaded. `avatar.ts` reads API_GATEWAY_URL into a
// const at module scope, and ESM hoists every static import above statements in
// this file — so a plain `import` would evaluate that const while the variable
// was still unset, and every call would short-circuit to null with fetch never
// invoked. The existing discover-BFF test carries the same note; this is the
// second time it has bitten, so it is worth stating again here.
process.env.API_GATEWAY_URL = 'https://gw.example.com';
process.env.INTERNAL_SECRET = 'secret';

const mod = await import('@/lib/connection/avatar');
const { isAllowedAvatar, AVATAR_MAX_BYTES, resolveAvatarBytes } = mod;

describe('what may be uploaded as a profile photo', () => {
  it('accepts the three formats the UI offers', () => {
    expect(isAllowedAvatar('image/jpeg', 500_000)).toBe(true);
    expect(isAllowedAvatar('image/png',  500_000)).toBe(true);
    expect(isAllowedAvatar('image/webp', 500_000)).toBe(true);
  });

  it('rejects SVG — it is a script container, not an image', () => {
    expect(isAllowedAvatar('image/svg+xml', 1_000)).toBe(false);
  });

  it('rejects GIF, which storage would otherwise allow', () => {
    // Not a security rule: an animated avatar in a directory listing is a
    // distraction the page did not ask for. Pinned so it is a decision, not drift.
    expect(isAllowedAvatar('image/gif', 1_000)).toBe(false);
  });

  it('rejects a non-image type', () => {
    expect(isAllowedAvatar('application/pdf', 1_000)).toBe(false);
    expect(isAllowedAvatar('', 1_000)).toBe(false);
  });

  it('enforces 2MB, well under storage’s own 10MB', () => {
    expect(isAllowedAvatar('image/jpeg', AVATAR_MAX_BYTES)).toBe(true);
    expect(isAllowedAvatar('image/jpeg', AVATAR_MAX_BYTES + 1)).toBe(false);
  });

  it('rejects a zero, negative or non-finite size', () => {
    // A client-declared size of 0 or NaN must not slip past a `> MAX` test.
    expect(isAllowedAvatar('image/jpeg', 0)).toBe(false);
    expect(isAllowedAvatar('image/jpeg', -1)).toBe(false);
    expect(isAllowedAvatar('image/jpeg', Number.NaN)).toBe(false);
  });
});

describe('resolveAvatarBytes', () => {
  const fetchMock = vi.fn();

  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const keyOk = () => ({ ok: true, status: 200, json: async () => ({ data: { key: 'avatars/u1/a.jpg' } }) });

  it('returns the bytes for an image', async () => {
    fetchMock
      .mockResolvedValueOnce(keyOk())
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new ArrayBuffer(8),
      });

    const out = await resolveAvatarBytes('sara');
    expect(out?.contentType).toBe('image/jpeg');
    expect(out?.body.byteLength).toBe(8);
  });

  it('DROPS a non-image content type instead of passing it through', async () => {
    // The guard that matters: these bytes came from a user upload and are about
    // to be served from our own origin.
    fetchMock
      .mockResolvedValueOnce(keyOk())
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new ArrayBuffer(8),
      });

    expect(await resolveAvatarBytes('sara')).toBeNull();
  });

  it('returns null when the profile has no photo', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { key: null } }) });
    expect(await resolveAvatarBytes('sara')).toBeNull();
    // The key lookup failing must not lead to a storage call at all.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null rather than throwing when the gateway is unreachable', async () => {
    // A profile page must never fail because a photo could not be loaded.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await resolveAvatarBytes('sara')).toBeNull();
  });

  it('returns null when storage refuses the key', async () => {
    fetchMock
      .mockResolvedValueOnce(keyOk())
      .mockResolvedValueOnce({ ok: false, status: 403, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) });
    expect(await resolveAvatarBytes('sara')).toBeNull();
  });

  it('sends the internal key and never the object key to a caller', async () => {
    fetchMock
      .mockResolvedValueOnce(keyOk())
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new ArrayBuffer(4),
      });

    const out = await resolveAvatarBytes('sara');

    // Asserted before indexing, not destructured blind: `mock.calls[n]` is
    // `any[] | undefined` under noUncheckedIndexedAccess, and it also makes the
    // failure legible — "expected 2 calls, got 1" beats a Symbol.iterator error.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keyInit   = fetchMock.mock.calls[0]?.[1];
    const bytesInit = fetchMock.mock.calls[1]?.[1];

    expect(keyInit?.headers['x-internal-key']).toBe('secret');
    expect(bytesInit?.headers['x-internal-key']).toBe('secret');
    // The returned shape carries bytes + type only — the key stays server-side.
    expect(Object.keys(out ?? {}).sort()).toEqual(['body', 'contentType']);
  });
});
