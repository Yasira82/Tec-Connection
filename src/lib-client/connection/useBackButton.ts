'use client';

// Make the phone's Back button close what is open.
//
// In a webview the hardware Back is browser history. An overlay — an open chat,
// a sheet, the photo viewer — is not a history entry, so Back skipped straight
// past all of them and left the app entirely. Someone three layers deep tapped
// Back expecting to step out of a photo and found themselves back in the Hub.
//
// ── Why this is a shared stack and not a per-layer entry ─────────────────────
//
// The first version gave EVERY layer its own history entry: push on mount,
// `history.back()` on cleanup. That is correct for one layer at a time and
// broken the moment one layer opens another, which is the normal case — the
// message sheet opens the forward picker, or the report sheet.
//
// Both happen in the SAME React commit: the old layer's cleanup runs, then the
// new layer's effect. So the sequence was
//
//     cleanup(sheet):  history.back()      ← ASYNCHRONOUS, no completion signal
//     effect(picker):  history.pushState()
//     …later:          popstate arrives
//
// and the `back()` landed AFTER the push — removing the picker's entry, not the
// sheet's, and delivering a popstate that the picker read as "the user pressed
// Back". The picker opened and closed itself in the same frame. From outside it
// looked exactly like "Forward does nothing".
//
// The fix is to stop making history churn during a transition at all:
//
//   · ONE throwaway entry exists while ANY overlay is open — not one each.
//   · Pushing and popping are COALESCED into a microtask, so a commit that
//     closes one layer and opens another computes its net effect once and does
//     nothing. There is no window for a back() to race a push.
//   · Back closes only the TOP layer; if layers remain below, the entry is
//     restored for them.
//
// No timers and no heuristics: the microtask is ordered after every effect in
// the commit that scheduled it, which is exactly the guarantee needed.
import { useEffect, useRef } from 'react';

/** Open layers, innermost last. Only the last one answers Back. */
const layers: number[] = [];
const closers = new Map<number, () => void>();
let nextId = 1;

/** Whether OUR throwaway entry is currently on the history stack. */
let entryPresent = false;
let syncScheduled = false;
let listening = false;

function sync() {
  if (syncScheduled || typeof window === 'undefined') return;
  syncScheduled = true;
  // A microtask, so every mount and unmount in the current commit has already
  // been applied. A transition that removes one layer and adds another arrives
  // here as a no-op rather than as back()-then-push.
  queueMicrotask(() => {
    syncScheduled = false;
    const wanted = layers.length > 0;
    if (wanted && !entryPresent) {
      entryPresent = true;
      window.history.pushState({ tecOverlay: Date.now() }, '');
    } else if (!wanted && entryPresent) {
      // Closed by a tap rather than by Back: the entry is still there. Remove
      // it, or the next Back would spend itself on bookkeeping and look dead.
      entryPresent = false;
      window.history.back();
    }
  });
}

function onPop() {
  // Someone else's entry, or ours already accounted for — not our business.
  if (!entryPresent) return;
  entryPresent = false;

  const top = layers[layers.length - 1];
  if (top === undefined) return;
  closers.get(top)?.();
  // If layers remain under it, `sync` puts the entry back for them; if that was
  // the last one, it stays off. Either way the decision is made after React has
  // finished unmounting, not guessed at here.
  sync();
}

export function useBackButton(active: boolean, onClose: () => void) {
  // Held in a ref so a new `onClose` identity on every render cannot re-run the
  // effect and register the layer twice.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const id = nextId++;
    layers.push(id);
    closers.set(id, () => closeRef.current());

    if (!listening) {
      listening = true;
      window.addEventListener('popstate', onPop);
    }
    sync();

    return () => {
      closers.delete(id);
      const at = layers.indexOf(id);
      if (at >= 0) layers.splice(at, 1);
      sync();
    };
  }, [active]);
}

/**
 * Reset the module state. TESTS ONLY — the stack is deliberately module-level
 * so that layers opened by different components share one history entry, and a
 * test file would otherwise carry one test's layers into the next.
 */
export function __resetBackButtonForTests() {
  layers.length = 0;
  closers.clear();
  entryPresent = false;
  syncScheduled = false;
}
