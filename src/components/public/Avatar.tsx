// A person's mark on the public surfaces.
//
// There are no uploaded profile pictures in Connection, and inventing one would
// be worse than none. So identity is carried by the handle itself: a stable hash
// picks a hue, and the same person is the same colour on the landing, in the
// directory, and on their own page. That consistency is what makes a wall of
// initials read as a room full of people rather than a placeholder grid.
//
// The palette is confined to a warm-through-violet arc that belongs beside the
// Pi amber; a free 0–360 hue would put lime and teal circles next to the brand
// accent. Text is always dark on a light disc, so contrast is fixed by
// construction rather than per-colour luck.

const HUES = [38, 24, 12, 350, 320, 288, 262, 218, 196, 162];

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // `?? 38` is unreachable — the modulo is always in range — but the index
  // signature is `number | undefined` under noUncheckedIndexedAccess, and the
  // fallback is the brand amber rather than a silent NaN in a colour string.
  return HUES[h % HUES.length] ?? 38;
}

/**
 * The same person's disc, as a plain CSS value.
 *
 * Exported for the OG image route: Satori renders no stylesheet, so that card has
 * to build the identical gradient from inline styles. Sharing the function is what
 * keeps a person the same colour in a WhatsApp preview as on the page it links to.
 */
export function avatarGradient(username: string): string {
  const hue = hueFor(username.toLowerCase());
  return `linear-gradient(140deg, hsl(${hue} 92% 78%), hsl(${hue} 82% 58%))`;
}

export function Avatar({ username, size = 46 }: { username: string; size?: number }) {
  const hue = hueFor(username.toLowerCase());
  return (
    <div
      className="pub-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(140deg, hsl(${hue} 92% 78%), hsl(${hue} 82% 58%))`,
      }}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
