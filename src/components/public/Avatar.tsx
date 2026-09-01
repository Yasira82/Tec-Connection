'use client';

import { useState } from 'react';

// A person's mark on the public surfaces.
//
// Two states, and the fallback is the important one. When someone has uploaded a
// photo it is shown; otherwise identity is carried by the handle itself — a
// stable hash picks a hue, and the same person is the same colour on the
// landing, in the directory, and on their own page. That consistency is what
// makes a wall of initials read as a room full of people rather than a
// placeholder grid, and it means a missing or slow photo degrades to something
// deliberate instead of a grey blank.
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

/** Same-origin photo URL. The storage bucket is private; this route streams it. */
export const avatarSrc = (username: string): string =>
  `/api/avatar/${encodeURIComponent(username)}`;

export function Avatar({
  username, size = 46, hasPhoto = false, tryPhoto = false, photoSrc,
}: {
  username: string; size?: number; hasPhoto?: boolean;
  /**
   * Where the photo lives, when it is not a person's.
   *
   * A group's picture is keyed by the CONVERSATION, not by a handle, so it
   * cannot be found from `username` alone. Everything else — the tinted disc
   * underneath, the initial fallback, the 404 handling — is identical, and
   * duplicating this component to change one URL is how two avatar
   * implementations start drifting apart.
   */
  photoSrc?: string;
  /**
   * Attempt the photo without being told there is one.
   *
   * The directory knows `hasAvatar` because it queries for it; the messaging
   * surfaces do NOT — a conversation carries a peer's handle and nothing else.
   * Rather than thread a flag through every message payload, this asks the
   * avatar route, which 404s cleanly when there is no photo, and falls back to
   * the coloured initial on error. That is why a profile photo used to appear
   * only in Settings.
   */
  tryPhoto?: boolean;
}) {
  const hue = hueFor(username.toLowerCase());
  const [failed, setFailed] = useState(false);
  const show = (hasPhoto || tryPhoto) && !failed;

  return (
    <div
      className="pub-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        overflow: 'hidden',
        // The containing block for the photo below.
        //
        // `.pub-avatar` is `display: grid` with `place-items: center`, which
        // sets the item's justify/align-self to `center` — and a centered grid
        // item sizes to its CONTENT instead of stretching to the cell. A SQUARE
        // photo hides that completely (its natural aspect already matches the
        // disc), which is why this went unnoticed: every profile photo tested
        // was square. A WIDE photo does not, and the region that ends up
        // visible then changes with the disc size — the same group picture
        // showed a different crop at 44px than at 66px.
        position: 'relative',
        // The tinted disc stays underneath a photo, so the frame is never a grey
        // hole while the image loads or if it 404s.
        background: `linear-gradient(140deg, hsl(${hue} 92% 78%), hsl(${hue} 82% 58%))`,
      }}>
      {show ? (
        // A plain <img> on purpose: next/image would proxy through the optimizer
        // for a route that is already ours and already cached hard. `lazy` covers
        // the directory list; `decoding="async"` keeps a slow decode off the main
        // thread on a phone.
        <img
          src={photoSrc ?? avatarSrc(username)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          // No photo is a 404, not an image — falling back here is what makes
          // `tryPhoto` safe to use where `hasAvatar` is unknown.
          onError={() => setFailed(true)}
          // Taken OUT of the grid flow entirely, so the fill does not depend on
          // how a grid item happens to be sized. `inset: 0` + `cover` is a
          // centre-crop of any aspect ratio into the disc, identically at every
          // size. The centering above still governs the initial fallback, which
          // is what it was written for.
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        username.charAt(0).toUpperCase()
      )}
    </div>
  );
}
