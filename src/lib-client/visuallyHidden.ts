/**
 * Hide a control from sight WITHOUT removing it from the layout.
 *
 * Every file picker in this app is a hidden `<input type="file">` that a
 * visible button clicks programmatically. All four were written as `hidden`,
 * which is `display: none` — and a `display: none` input is not merely
 * invisible, it is out of the layout entirely. Several Android WebViews, which
 * is what Pi Browser is, refuse to open the system picker for such an input:
 * `.click()` returns, nothing opens, nothing throws. The button simply does
 * nothing, on that browser only, which is why it looked like an account
 * problem rather than a code one.
 *
 * So the input stays in the layout at one pixel with zero opacity. It is the
 * standard visually-hidden recipe minus `display: none`, and deliberately NOT
 * `pointer-events: none` — a programmatic click is unaffected by that property
 * in every engine that matters, but there is no reason to hand a WebView one
 * more excuse.
 *
 * Pair it with `tabIndex={-1}` and `aria-hidden="true"`: the visible button is
 * the control, and the input must not become a second stop for a keyboard or a
 * screen reader.
 */
export const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  border: 0,
  padding: 0,
  margin: -1,
  whiteSpace: 'nowrap',
} as const;
