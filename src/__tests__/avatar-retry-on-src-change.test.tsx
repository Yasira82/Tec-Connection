import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Avatar } from '@/components/public/Avatar';

// A group's photo was missing from the chat header and the chat list, and
// correct inside the info sheet — the same picture, the same route, one screen
// apart.
//
// The header renders before the thread has loaded. At that moment the component
// does not yet know it is looking at a GROUP, so it is handed a placeholder
// handle and no `photoSrc`, asks `/api/avatar/<placeholder>`, and is answered
// 404. When the thread arrives a render later and `photoSrc` becomes the real
// group URL, `failed` is already true — and `failed` gated the <img> out of the
// tree entirely, so the working URL was never requested.
//
// The info sheet escaped it by mounting fresh with the answer already in hand.
//
// A failure belongs to the URL that failed, not to the component.

const first  = '/api/avatar/G';
const second = '/api/bff/connection/conversations/c1/avatar';

describe('a 404 does not disable the photo forever', () => {
  it('re-tries when the src changes', () => {
    const { container, rerender } = render(
      <Avatar username="G" size={40} tryPhoto />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain(first);

    // The placeholder handle has no photo. This is the normal answer, not an
    // error condition — which is exactly why it must not be sticky.
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();

    // The thread lands: now we know it is a group, and where its photo lives.
    rerender(<Avatar username="TEC" size={40} tryPhoto photoSrc={second} />);

    const retried = container.querySelector('img');
    expect(retried).not.toBeNull();
    expect(retried!.getAttribute('src')).toBe(second);
  });

  it('still falls back when the CURRENT src is the one that fails', () => {
    // The reset must not turn the fallback off. A handle with no photo has to
    // settle on the coloured initial and stay there.
    const { container } = render(<Avatar username="nobody" size={40} tryPhoto />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('N');
  });

  it('a re-render that does NOT change the src keeps the fallback', () => {
    // Otherwise every unrelated parent update would re-request a URL already
    // known to 404 — a retry loop driven by typing indicators and clocks.
    const { container, rerender } = render(
      <Avatar username="nobody" size={40} tryPhoto />,
    );
    fireEvent.error(container.querySelector('img')!);
    rerender(<Avatar username="nobody" size={44} tryPhoto />);
    expect(container.querySelector('img')).toBeNull();
  });
});
