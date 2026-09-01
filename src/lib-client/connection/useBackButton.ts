'use client';

// Make the phone's Back button close what is open.
//
// In a webview the hardware Back is browser history. An overlay — an open chat,
// a sheet, the photo viewer — is not a history entry, so Back skipped straight
// past all of them and left the app entirely. Someone three layers deep tapped
// Back expecting to step out of a photo and found themselves back in the Hub.
//
// The fix is to give each layer a history entry of its own to consume: push a
// throwaway state when the layer opens, close the layer when that state is
// popped. Layers then unwind one at a time, in the order they were opened,
// which is what Back means everywhere else on the device.
//
// The subtlety is the OTHER way of closing. When a layer is dismissed by its own
// ✕ or backdrop, the entry it pushed is still on the stack — and the next Back
// would silently consume that instead of doing anything visible, so Back would
// appear broken exactly once per dismissal. Cleanup calls `history.back()` to
// take its own entry off again.
import { useEffect, useRef } from 'react';

export function useBackButton(active: boolean, onClose: () => void) {
  // Held in a ref so a new `onClose` identity on every render cannot re-run the
  // effect and push a second entry for the same layer.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    let ours = true;
    window.history.pushState({ tecOverlay: Date.now() }, '');

    const onPop = () => {
      // Back consumed our entry — it is already off the stack, so cleanup must
      // not try to remove it again.
      ours = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed by a tap rather than by Back: our entry is still there. Remove
      // it, or the next Back would spend itself on bookkeeping and look dead.
      // The listener is already detached, so this cannot re-enter onPop.
      if (ours) window.history.back();
    };
  }, [active]);
}
