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
