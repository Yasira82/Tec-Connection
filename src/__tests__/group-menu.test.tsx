import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { usePresence } from '@/lib-client/connection/usePresence';

// Two things about the group menu, pinned at the level each one can be tested at.
//
// It was reported as "the three dots don't show the things you made". Half of
// that was true and half was the layout: Report, Mute and Leave were in the info
// sheet, while Search was an unlabelled 🔍 in the header. Somebody looking for
// what they can do opens the menu, not the glyph — so the sheet lists all four,
// and the header icon stays as the shortcut for people who already know it.
//
// The sheet is asserted from its SOURCE rather than rendered. That is not the
// preferred kind of test and it is not being dressed up as one: rendering it
// pulls in the invite, join-request and presence hooks at once and the run does
// not terminate, which is a real problem with that component's testability and
// deserves its own fix rather than a workaround buried here. What this catches
// is the thing that actually regressed — a row quietly disappearing from the
// list — and it catches it in the file where that would happen.

const src = readFileSync(
  join(process.cwd(), 'src/app/app/components/ChatInfoSheet.tsx'), 'utf8',
);
const messages = readFileSync(
  join(process.cwd(), 'src/app/app/components/Messages.tsx'), 'utf8',
);

describe('what a group member is offered', () => {
  it.each([
    ['search', 'a.searchMessages'],
    ['mute',   'a.muteChat'],
    ['report', 'a.reportGroup'],
    ['leave',  'a.leaveGroup'],
  ])('%s has a labelled row in the sheet', (_name, label) => {
    expect(src).toContain(label);
  });

  it('the chat wires Search into the sheet as well as the header icon', () => {
    // Both, not either: removing the icon would take the shortcut away from
    // everyone who already reaches for it.
    expect(messages).toContain('onSearch={');
    expect(messages).toContain('aria-label={a.searchMessages}');
  });

  it('does not offer Report to the owner of the group', () => {
    // The service refuses a report about your own group, and a row that always
    // errors teaches people to distrust the menu.
    expect(messages).toContain("thread.role !== 'owner'");
  });
});

describe('presence in a group', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('marks the members the heartbeat says are here', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ data: { online: ['Ali'] } }),
    })) as unknown as typeof fetch);

    const { result } = renderHook(() => usePresence(['ali', 'nour']));
    await waitFor(() => expect(result.current.isOnline('ali')).toBe(true));
    expect(result.current.isOnline('nour')).toBe(false);
  });

  it('shows NOBODY as online when the heartbeat cannot be reached', async () => {
    // The direction matters. Presence is best-effort and eventual; a failure
    // that rendered everyone online would be a confident statement about people
    // who are not there.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);

    const { result } = renderHook(() => usePresence(['ali', 'nour']));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current.isOnline('ali')).toBe(false);
    expect(result.current.online.size).toBe(0);
  });
});
