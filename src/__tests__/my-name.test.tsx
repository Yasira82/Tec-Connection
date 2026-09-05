import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useMyName, refreshMyName } from '@/lib-client/connection/useMyName';

// The caller's own name, on the caller's own screens.
//
// `useMe` answers "who am I?" — the Pi username, resolved server-side because
// Pi Browser hides the cookie from client JS. It cannot answer "what do I call
// myself?": a chosen name is profile data owned by the Connection store, not a
// claim in the session token. So the Home header, the Settings card and the
// status strip showed the handle and nothing else, and setting a name looked
// like it had done nothing — the one screen it did reach was the field you
// typed it into.
//
// Two properties are pinned, and the second is the one that would rot quietly:
//   · a save reaches every screen at once, without a reload;
//   · a FAILED read does not decide, for the rest of the session, that nobody
//     has a name.

describe('useMyName', () => {
  beforeEach(() => { void refreshMyName(null); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('reads the chosen name from the profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ profile: { display_name: 'YM' } }),
    })) as unknown as typeof fetch);

    const { result } = renderHook(() => useMyName());
    await waitFor(() => expect(result.current).toBe('YM'));
  });

  it('is null when no name is set — the handle is then the whole answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ profile: { display_name: '   ' } }),
    })) as unknown as typeof fetch);

    const { result } = renderHook(() => useMyName());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('a save reaches every screen at once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ profile: { display_name: '' } }),
    })) as unknown as typeof fetch);

    // Two screens showing the same person — the Home header and the Settings
    // card, in practice.
    const a = renderHook(() => useMyName());
    const b = renderHook(() => useMyName());
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => { await refreshMyName('YM'); });
    expect(a.result.current).toBe('YM');
    expect(b.result.current).toBe('YM');
  });

  it('asks ONCE for several screens, not once per screen', async () => {
    const f = vi.fn(async () => ({
      ok: true, json: async () => ({ profile: { display_name: 'YM' } }),
    }));
    vi.stubGlobal('fetch', f as unknown as typeof fetch);

    renderHook(() => useMyName());
    renderHook(() => useMyName());
    renderHook(() => useMyName());
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(f.mock.calls.length).toBe(1);
  });

  it('a failed read does not poison the session', async () => {
    // A dropped request must not become "this person has no name" for as long
    // as the app stays open. The next mount tries again.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    const first = renderHook(() => useMyName());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(first.result.current).toBeNull();
    cleanup();

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ profile: { display_name: 'YM' } }),
    })) as unknown as typeof fetch);
    const second = renderHook(() => useMyName());
    await waitFor(() => expect(second.result.current).toBe('YM'));
  });
});
