import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n';
import { ProfileEditor } from '@/app/app/components/ProfileEditor';
import { DirectoryCard } from '@/components/public/DirectoryCard';

// A display name is a name BESIDE the handle, never instead of it.
//
// The handle is what a follow, a block, a report and a payout are keyed on, and
// it is the only half of an identity nobody else can claim. A name is
// free-text: two people may pick the same one, and "TEC Support" is typable.
// So every surface that prints a name must print the @handle with it — that is
// what makes the name safe to allow at all, and it is the thing a later layout
// tidy-up would quietly drop.

const PROFILE = {
  username: 'yas55er82', display_name: 'Yasser', headline: 'Building TEC',
  category: 'builder', published: true, verified: false, featured: false,
  hasAvatar: false, showFollowers: true,
};

describe('display name — the editor', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'PUT'
        ? { ok: true, profile: PROFILE }
        : { profile: PROFILE, isPro: false }),
      // Keep the shape honest even for calls this test does not care about.
      text: async () => '',
    })) as unknown as typeof fetch);
  });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  const editor = () => render(<LocaleProvider><ProfileEditor /></LocaleProvider>);

  it('loads the saved name into the field', async () => {
    editor();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Yasser')).toBeTruthy();
    });
  });

  it('prints the handle under the field, so a name is never mistaken for one', async () => {
    editor();
    await waitFor(() => {
      expect(screen.getByText('@yas55er82')).toBeTruthy();
    });
  });

  it('sends the name on save', async () => {
    editor();
    await waitFor(() => expect(screen.getByDisplayValue('Yasser')).toBeTruthy());

    fireEvent.change(screen.getByDisplayValue('Yasser'), { target: { value: '  Yasser Fox  ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const put = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
        .find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse(String((put![1] as RequestInit).body))).toMatchObject({
        display_name: 'Yasser Fox',
      });
    });
  });
});

describe('display name — the directory card', () => {
  const labels = {
    verified: 'Verified', verifiedHint: '', featured: 'Featured', featuredHint: '',
    follower: 'follower', followers: 'followers',
  };

  afterEach(() => { cleanup(); });

  it('shows the name AND the handle when a name is set', () => {
    const { container } = render(
      <DirectoryCard
        profile={{
          username: 'yas55er82', display_name: 'Yasser', headline: 'h',
          category: 'builder', verified: false, featured: false, followers: 3,
        }}
        labels={labels} />,
    );
    expect(within(container).getByText('Yasser')).toBeTruthy();
    expect(within(container).getByText('@yas55er82')).toBeTruthy();
  });

  it('falls back to the handle alone when no name is set', () => {
    const { container } = render(
      <DirectoryCard
        profile={{
          username: 'yas55er82', headline: 'h',
          category: 'builder', verified: false, featured: false, followers: 3,
        }}
        labels={labels} />,
    );
    expect(within(container).getByText('@yas55er82')).toBeTruthy();
  });
});

describe('saving without publishing', () => {
  // The bug this pins: the only button an UNLISTED profile had was "Publish",
  // so there was no way to save a name without joining the public directory —
  // and a person who did not want to be listed could not save at all.
  const UNLISTED = { ...PROFILE, display_name: '', published: false };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'PUT'
        ? { ok: true, profile: UNLISTED }
        : { profile: UNLISTED, isPro: false }),
    })) as unknown as typeof fetch);
  });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  const put = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');

  it('offers Save to an unlisted profile, and it does NOT publish them', async () => {
    render(<LocaleProvider><ProfileEditor /></LocaleProvider>);
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText(/Your name/i), { target: { value: 'Nour' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(put()).toBeTruthy();
      expect(JSON.parse(String((put()![1] as RequestInit).body)))
        .toMatchObject({ display_name: 'Nour', published: false });
    });
  });

  it('still offers Publish, as its own separate act', async () => {
    render(<LocaleProvider><ProfileEditor /></LocaleProvider>);
    await waitFor(() => expect(screen.getByText('Publish')).toBeTruthy());

    fireEvent.click(screen.getByText('Publish'));
    await waitFor(() => {
      expect(JSON.parse(String((put()![1] as RequestInit).body))).toMatchObject({ published: true });
    });
  });
});
