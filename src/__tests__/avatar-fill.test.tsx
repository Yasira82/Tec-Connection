import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from '@/components/public/Avatar';

// The photo must FILL the disc, at every size and for any aspect ratio.
//
// This is pinned because the way it broke was invisible to every other kind of
// test. `.pub-avatar` is `display: grid` with `place-items: center`, which sets
// the item's align/justify-self to `center` — and a centred grid item sizes to
// its CONTENT rather than stretching to fill the cell.
//
// A SQUARE photo hides that completely: its natural aspect already matches the
// disc, so it looks correct. Every profile photo tested was square, so the bug
// shipped. The first WIDE photo — a group picture — showed a different crop at
// 44px than at 66px, which is the giveaway: a real `cover` crop of a square
// container is scale-invariant, so two square discs MUST show the same region.
//
// Asserting the declared style rather than the painted pixels, because jsdom
// does no layout. That is enough: the failure was a missing rule, not a
// rendering subtlety.

describe('Avatar photo fill', () => {
  it('takes the photo out of the grid flow so its size cannot depend on content', () => {
    const { container } = render(<Avatar username="tec" size={44} tryPhoto />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.style.position).toBe('absolute');
    expect(img!.style.objectFit).toBe('cover');
    expect(img!.style.width).toBe('100%');
    expect(img!.style.height).toBe('100%');
  });

  it('gives the img a positioned containing block to fill', () => {
    // Without this the absolute img escapes to the nearest positioned ancestor
    // — some card several levels up — and the disc renders empty.
    const { container } = render(<Avatar username="tec" size={44} tryPhoto />);
    const disc = container.querySelector('.pub-avatar') as HTMLElement;
    expect(disc.style.position).toBe('relative');
    expect(disc.style.overflow).toBe('hidden');
  });

  it('declares the same fill at every size — a square crop is scale-invariant', () => {
    // The symptom that exposed the bug was two different crops of one image at
    // two sizes. Nothing about the fill may vary with `size`.
    const small = render(<Avatar username="tec" size={44} tryPhoto />);
    const large = render(<Avatar username="tec" size={66} tryPhoto />);
    const style = (r: ReturnType<typeof render>) => {
      const i = r.container.querySelector('img')!;
      return [i.style.position, i.style.objectFit, i.style.width, i.style.height].join('|');
    };
    expect(style(small)).toBe(style(large));
  });

  it('still renders the initial when there is no photo', () => {
    // The grid centering exists for THIS, and the fix must not disturb it.
    const { container } = render(<Avatar username="magy888" size={44} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('M');
  });

  it('uses an explicit photoSrc when given, for a group', () => {
    const src = '/api/bff/connection/conversations/g1/avatar';
    const { container } = render(<Avatar username="TEC" size={44} tryPhoto photoSrc={src} />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe(src);
  });
});
