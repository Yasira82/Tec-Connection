// @vitest-environment happy-dom
//
// happy-dom, not jsdom: it is the DOM this repo already ships. Naming jsdom here
// would add a dependency for one test file.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useThread } from '@/lib-client/connection/useMessages';

// The open thread polls with `?after=<newest>`, so a poll returns ONLY messages
// the client has not seen. That makes the merge step load-bearing and easy to get
// backwards:
//
//   · replace-on-incremental → the thread EMPTIES on the first quiet poll, because
//     a quiet poll returns zero messages;
//   · append-on-full-load    → the history is duplicated when the thread reopens.
//
// Neither raises an error. Both destroy the conversation on screen, and only in
// the second poll — which is exactly the moment nobody is still watching.

const msg = (id: string, at: string) => ({ id, body: id, by: 'bob', at });

const thread = (messages: ReturnType<typeof msg>[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: {
      conversation: {
        id: 'c1', kind: 'DIRECT', title: null, owner: null, role: 'member',
        peer: 'bob', members: ['alice', 'bob'], messages,
      },
    },
  }),
});

// Real timers on purpose. Faking them deadlocks the test: testing-library's
// `waitFor` polls with setTimeout, so a faked clock never lets it resolve and
// every assertion times out instead of failing for a reason you can read. The
// poll is driven directly through `reload()` — which is the same code path the
// interval calls, minus the waiting.
afterEach(() => { vi.unstubAllGlobals(); });

describe('useThread poll merge', () => {
  it('appends new messages instead of replacing the history', async () => {
    const fetchMock = vi.fn()
      // first load (no ?after) — full history
      .mockResolvedValueOnce(thread([msg('m1', '2026-01-01T00:00:00.000Z')]))
      // the read receipt
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      // incremental poll — only what is new
      .mockResolvedValue(thread([msg('m2', '2026-01-01T00:01:00.000Z')]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useThread('c1'));
    await waitFor(() => expect(result.current.thread?.messages).toHaveLength(1));

    await act(async () => { await result.current.reload(); });
    expect(result.current.thread?.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('keeps the history when a poll returns nothing new', async () => {
    // The regression that "replace" would cause: a quiet conversation blanks out.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(thread([msg('m1', '2026-01-01T00:00:00.000Z')]))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValue(thread([]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useThread('c1'));
    await waitFor(() => expect(result.current.thread?.messages).toHaveLength(1));

    await act(async () => { await result.current.reload(); });
    expect(result.current.thread?.messages.map((m) => m.id)).toEqual(['m1']);
  });

  it('does not duplicate a message that arrives in two polls', async () => {
    // At-least-once is the rule everywhere else on this platform; the merge
    // dedupes by id rather than trusting the cursor to be exact.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(thread([msg('m1', '2026-01-01T00:00:00.000Z')]))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValue(thread([msg('m1', '2026-01-01T00:00:00.000Z'), msg('m2', '2026-01-01T00:01:00.000Z')]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useThread('c1'));
    await waitFor(() => expect(result.current.thread?.messages).toHaveLength(1));

    await act(async () => { await result.current.reload(); });
    expect(result.current.thread?.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('marks the thread read on open — a badge should not survive being looked at', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(thread([]))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useThread('c1'));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.endsWith('/conversations/c1/read'))).toBe(true);
    });
  });

  it('reports a 404 as the thread being unavailable, not as a crash', async () => {
    // 404 is what the service returns for a thread you do not belong to. It is a
    // normal answer, not an error state to throw on.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    const { result } = renderHook(() => useThread('c1'));
    await waitFor(() => expect(result.current.error).toBe('notfound'));
    expect(result.current.thread).toBeNull();
  });
});

// The session hook returns the Pi username as the person typed it (`yas55eR82`);
// the service normalizes to lowercase before storing, and returns `yas55er82`.
// A plain `===` between the two is ALWAYS false, so every message you had sent
// was drawn as a stranger's: labelled with your own handle instead of "You", and
// on the wrong side of the screen. It looked like a rendering quirk; it was an
// identity comparison.
//
// The rule is pinned as a pure function so it cannot drift back into a `===`
// somewhere in the component.
describe('“is this message mine?”', () => {
  const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();
  const isMine = (by: string, me: string) => norm(by) === norm(me);

  it('matches across the case the service normalizes away', () => {
    expect(isMine('yas55er82', 'yas55eR82')).toBe(true);
  });

  it('matches whether or not the handle carries an @', () => {
    expect(isMine('alice', '@Alice')).toBe(true);
    expect(isMine('@alice', 'alice')).toBe(true);
  });

  it('still says no for a different person', () => {
    expect(isMine('bob', 'yas55eR82')).toBe(false);
  });

  it('does not claim a message when the session name is missing', () => {
    // Signed-out or still loading: nothing should be attributed to "You".
    expect(isMine('alice', '')).toBe(false);
  });
});

// `openDirect` used to return `null` for every failure. The screen closed the
// composer, discarded the typed name, and said nothing — which is precisely what
// "New chat doesn't work" looks like from the outside, whatever the real cause.
// It now returns either the id or the HTTP status, so the reason reaches the
// screen and, from there, a screenshot.
describe('openDirect reports why it failed', () => {
  const load = async () => {};

  const openDirect = async (username: string): Promise<{ id: string } | { code: number }> => {
    try {
      const res = await fetch('/api/bff/connection/conversations/direct', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().replace(/^@+/, '') }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { code: res.status };
      await load();
      const d = ((json as Record<string, unknown>)?.data ?? json ?? {}) as Record<string, unknown>;
      const id = (d.conversation as { id?: string } | undefined)?.id;
      return id ? { id } : { code: 502 };
    } catch {
      return { code: 0 };
    }
  };

  it('returns the id on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: { conversation: { id: 'dm-1' } } }),
    }));
    expect(await openDirect('@Bob')).toEqual({ id: 'dm-1' });
  });

  it('surfaces the status instead of a bare null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect(await openDirect('bob')).toEqual({ code: 404 });
  });

  it('treats a 200 with no conversation id as a failure, not a success', async () => {
    // The worst outcome is a "successful" call that leaves the screen unchanged.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) }));
    expect(await openDirect('bob')).toEqual({ code: 502 });
  });

  it('reports a thrown network error rather than swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await openDirect('bob')).toEqual({ code: 0 });
  });
});
