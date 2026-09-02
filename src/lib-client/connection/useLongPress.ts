'use client';

// Press and hold on a message, the way every messenger does it.
//
// The ⋯ button stays — it is how anyone discovers the menu exists, and it is the
// only way in on a desktop. But nobody taps a small glyph when they already know
// the gesture, and the gesture is the one people arrive with.
//
// Three details are the difference between this feeling native and feeling like
// a web page:
//
//   · The press must survive a little movement. A thumb held still still drifts
//     a few pixels, and cancelling on any movement at all makes the gesture feel
//     broken on exactly the people who hold hardest. It cancels on a real SCROLL
//     (>10px), which is the gesture it must not steal.
//
//   · The tap that follows must be swallowed. `touchend` after a long press
//     still produces a click, so without this the sheet opens AND the bubble's
//     own tap fires — opening the photo viewer behind it.
//
//   · The native callout has to be suppressed, or Android's own "copy / select"
//     menu appears on top of ours. That is `contextmenu` plus the CSS in the
//     caller; both are needed, and neither is enough alone.
import { useCallback, useRef } from 'react';

/** Long enough not to fire on a normal tap; short enough not to feel stuck. */
const HOLD_MS = 450;

/** A thumb drifts. This is a scroll, not a wobble. */
const MOVE_TOLERANCE_PX = 10;

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Set when the press fires, read by the click that follows it.
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    fired.current = false;
    start.current = { x: t.clientX, y: t.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      fired.current = true;
      onLongPress();
    }, HOLD_MS);
  }, [onLongPress]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const from = start.current;
    if (!t || !from) return;
    // Cancel only on a real scroll. Anything tighter cancels on the tremor of a
    // thumb being held still, which is the opposite of what a hold should do.
    if (Math.abs(t.clientX - from.x) > MOVE_TOLERANCE_PX
      || Math.abs(t.clientY - from.y) > MOVE_TOLERANCE_PX) clear();
  }, [clear]);

  /**
   * Spread onto the element. `onClickCapture` swallows the click that a long
   * press produces — without it the sheet opens and the bubble's own tap fires
   * underneath it, opening the photo viewer behind the menu.
   */
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // Desktop right-click, and the browser's own long-press menu on Android.
    // Suppressing it here is half the job; the CSS callout rules in the caller
    // are the other half, and neither works without the other.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fired.current) onLongPress();
    },
  };
}
