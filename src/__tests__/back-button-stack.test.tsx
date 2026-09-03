import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { useBackButton, __resetBackButtonForTests } from '@/lib-client/connection/useBackButton';

// The Back button, and the bug that made "Forward" look dead.
//
// Every overlay used to push its own history entry and call `history.back()` on
// cleanup. That is fine for one layer at a time and wrong the moment one layer
// opens another — which is the normal case: the message sheet opens the forward
// picker, or the report sheet.
//
// Both happen in the SAME React commit — cleanup of the old, then effect of the
// new — so the order was:
//
//     cleanup(sheet):  history.back()      ← asynchronous, no completion signal
//     effect(picker):  history.pushState()
//     …later:          popstate arrives
//
// The back() landed after the push, removed the PICKER's entry, and delivered a
// popstate the picker read as "the user pressed Back". It opened and closed
// itself in one frame. Nothing errored; Forward simply did nothing.
//
// These tests drive that exact transition. They are the reason the entry is now
// shared and the push/pop is coalesced into a microtask.

/** A history double that records the calls, and fires popstate like a browser. */
function fakeHistory() {
  const calls: string[] = [];
  let depth = 0;
  const back = vi.fn(() => {
    calls.push('back');
    if (depth > 0) depth -= 1;
    // The browser dispatches popstate asynchronously. Reproducing that is the
    // whole point — a synchronous double would hide the race entirely.
    setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0);
  });
  const pushState = vi.fn(() => { calls.push('push'); depth += 1; });
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { back, pushState, get length() { return depth; } },
  });
  // A real Back press: the browser removes the entry AND dispatches popstate.
  // Dispatching the event alone would leave the depth wrong and make every
  // assertion about it measure the wrong thing.
  const pressBack = () => {
    if (depth > 0) depth -= 1;
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  return { calls, depth: () => depth, pressBack };
}

function Layer({ onClose }: { onClose: () => void }) {
  useBackButton(true, onClose);
  return null;
}

/** Sheet open → tap Forward → sheet closes and picker opens in ONE commit. */
function SheetThenPicker({ onPickerClosed }: { onPickerClosed: () => void }) {
  const [sheet, setSheet] = useState(true);
  const [picker, setPicker] = useState(false);
  return (
    <>
      {sheet && <Layer onClose={() => setSheet(false)} />}
      {picker && <Layer onClose={() => { setPicker(false); onPickerClosed(); }} />}
      <button
        data-testid="forward"
        onClick={() => { setPicker(true); setSheet(false); }}
      >forward</button>
    </>
  );
}

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };

describe('one overlay opening another', () => {
  beforeEach(() => { cleanup(); __resetBackButtonForTests(); });

  it('does not close the layer that just opened', async () => {
    const h = fakeHistory();
    const closed = vi.fn();
    const { getByTestId } = render(<SheetThenPicker onPickerClosed={closed} />);
    await flush();
    expect(h.calls).toEqual(['push']);          // one entry for the sheet

    await act(async () => { getByTestId('forward').click(); });
    await flush();

    // THE REGRESSION. The picker must still be open: nothing about closing the
    // sheet may reach it, and a popstate caused by the transition is not the
    // user pressing Back.
    expect(closed).not.toHaveBeenCalled();
  });

  it('makes no history calls at all during the transition', async () => {
    const h = fakeHistory();
    const { getByTestId } = render(<SheetThenPicker onPickerClosed={() => {}} />);
    await flush();
    const before = h.calls.length;

    await act(async () => { getByTestId('forward').click(); });
    await flush();

    // One layer left, one layer arrived: the net is unchanged, so the coalesced
    // sync does nothing. No back(), and therefore no race to lose.
    expect(h.calls.length).toBe(before);
    expect(h.depth()).toBe(1);
  });
});

describe('one overlay on its own', () => {
  beforeEach(() => { cleanup(); __resetBackButtonForTests(); });

  it('pushes one entry when it opens and removes it when it closes by tap', async () => {
    const h = fakeHistory();
    function One() {
      const [open, setOpen] = useState(true);
      return (
        <>
          {open && <Layer onClose={() => setOpen(false)} />}
          <button data-testid="x" onClick={() => setOpen(false)}>x</button>
        </>
      );
    }
    const { getByTestId } = render(<One />);
    await flush();
    expect(h.calls).toEqual(['push']);

    await act(async () => { getByTestId('x').click(); });
    await flush();
    // Removed, or the next Back would spend itself on bookkeeping and look dead.
    expect(h.calls).toEqual(['push', 'back']);
  });

  it('closes on a real Back', async () => {
    const h = fakeHistory();
    const onClose = vi.fn();
    render(<Layer onClose={onClose} />);
    await flush();

    await act(async () => { h.pressBack(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the tab is a layer too', () => {
  beforeEach(() => { cleanup(); __resetBackButtonForTests(); });

  // Back used to leave the app from any tab: the tabs are React state, so the
  // last real history entry was whatever came before the app — the Hub. The tab
  // joins the SAME stack rather than pushing an entry of its own, because a
  // second writer races the one already there.

  /** The page: a tab layer, and a chat that may be open inside it. */
  function Page({ start, chatFrom }: { start: 'home' | 'messages'; chatFrom?: boolean }) {
    const [tab, setTab] = useState(start);
    const [chat, setChat] = useState(!!chatFrom);
    useBackButton(tab !== 'home', () => {
      if (chat) { setChat(false); return; }
      setTab('home');
    });
    return (
      <>
        {/* The child — React runs its effect BEFORE the parent's. */}
        {tab === 'messages' && chat && <Layer onClose={() => setChat(false)} />}
        <span data-testid="state">{tab}/{chat ? 'chat' : '-'}</span>
        <button data-testid="go" onClick={() => setTab('messages')}>go</button>
        <button data-testid="open" onClick={() => setChat(true)}>open</button>
      </>
    );
  }

  it('Back returns to Home instead of leaving the app', async () => {
    const h = fakeHistory();
    const { getByTestId } = render(<Page start="home" />);
    await flush();
    expect(h.calls).toEqual([]);            // Home holds no entry: Back leaves, rightly

    await act(async () => { getByTestId('go').click(); });
    await flush();
    expect(h.calls).toEqual(['push']);      // one entry, for the tab

    await act(async () => { h.pressBack(); });
    await flush();
    expect(getByTestId('state').textContent).toBe('home/-');
  });

  it('closes the chat first, then the tab — one entry for both', async () => {
    const h = fakeHistory();
    const { getByTestId } = render(<Page start="home" />);
    await flush();
    await act(async () => { getByTestId('go').click(); });
    await act(async () => { getByTestId('open').click(); });
    await flush();
    // The tab and the chat share ONE entry — that is what makes a transition
    // between them free of history churn.
    expect(h.calls.filter((c) => c === 'push')).toHaveLength(1);

    await act(async () => { h.pressBack(); });
    await flush();
    expect(getByTestId('state').textContent).toBe('messages/-');   // chat only

    await act(async () => { h.pressBack(); });
    await flush();
    expect(getByTestId('state').textContent).toBe('home/-');
  });

  it('still closes the chat first when both open in the SAME commit', async () => {
    // The invite link does exactly this: it sets the tab and the open thread
    // together. React runs the child's effect before the parent's, so the layers
    // register inverted — the tab's lands on TOP of the chat's. Back must still
    // take the chat first, or arriving on an invite would skip the conversation
    // it just joined.
    const h = fakeHistory();
    const { getByTestId } = render(<Page start="messages" chatFrom />);
    await flush();
    expect(h.calls.filter((c) => c === 'push')).toHaveLength(1);

    await act(async () => { h.pressBack(); });
    await flush();
    expect(getByTestId('state').textContent).toBe('messages/-');
  });
});

describe('two overlays stacked', () => {
  beforeEach(() => { cleanup(); __resetBackButtonForTests(); });

  it('Back closes only the TOP one, and the one below keeps its entry', async () => {
    const h = fakeHistory();
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    function Stacked() {
      const [inner, setInner] = useState(true);
      return (
        <>
          <Layer onClose={closeOuter} />
          {inner && <Layer onClose={() => { setInner(false); closeInner(); }} />}
        </>
      );
    }
    render(<Stacked />);
    await flush();
    // ONE entry for both — not one each. That is what makes a transition free.
    expect(h.calls.filter((c) => c === 'push')).toHaveLength(1);

    await act(async () => { h.pressBack(); });
    await flush();

    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    // The outer layer is still open, so the entry it needs is put back.
    expect(h.depth()).toBe(1);
  });
});
