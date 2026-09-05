import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from '@/lib/i18n/locales';
import { LocaleProvider, useTranslation } from '@/lib/i18n';

// The language has to survive leaving the app.
//
// It did not, and the reason was one missing attribute. The cookie was written
// in TWO places with two different sets of attributes: the server route set
// `Partitioned`, and the client provider hand-built a `document.cookie` string
// that could not. A browser keeps partitioned and unpartitioned cookies of the
// same name in SEPARATE jars — so inside Pi Browser, which is an embedded
// context, the in-app picker wrote to a jar nothing reads. The language changed
// on screen and came back as it was on the next visit.
//
// Two things are pinned here, and the first is the one that broke:
//   · the cookie has exactly ONE writer, and its attributes satisfy C-123 LAW 3;
//   · a choice still survives a browser that refuses the cookie entirely.

function Switcher() {
  const { locale, setLocale } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale('ar')}>ar</button>
    </div>
  );
}

describe('the locale cookie contract', () => {
  it('is None + Secure + Partitioned — all three, per C-123 LAW 3', () => {
    // Dropping `partitioned` is what broke this, and it breaks silently: the
    // write is simply ignored in an embedded context, with no error anywhere.
    expect(LOCALE_COOKIE_OPTIONS).toMatchObject({
      sameSite: 'none', secure: true, partitioned: true, path: '/',
    });
    // Readable by the client provider, which keeps React in step with the
    // server render. It is a display preference, not a credential.
    expect(LOCALE_COOKIE_OPTIONS.httpOnly).toBe(false);
    expect(LOCALE_COOKIE_OPTIONS.maxAge).toBeGreaterThan(60 * 60 * 24 * 300);
  });
});

describe('choosing a language in the app', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ ok: true, locale: 'ar' }),
    })) as unknown as typeof fetch);
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('asks the SERVER to store it, instead of writing the cookie by hand', async () => {
    render(<LocaleProvider initialLocale="en"><Switcher /></LocaleProvider>);
    fireEvent.click(screen.getByText('ar'));

    await waitFor(() => {
      const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
        .find((c) => String(c[0]).includes('/api/locale'));
      expect(call).toBeTruthy();
      expect((call![1] as RequestInit).method).toBe('POST');
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ lang: 'ar' });
    });
    expect(screen.getByTestId('locale').textContent).toBe('ar');
  });

  it('still survives a browser that refuses the cookie', async () => {
    // The belt to the cookie's braces. If the write is rejected there is no
    // error to catch — the next load simply renders the default — so the
    // choice is kept locally too and re-sent on mount.
    render(<LocaleProvider initialLocale="en"><Switcher /></LocaleProvider>);
    fireEvent.click(screen.getByText('ar'));
    await waitFor(() => expect(localStorage.getItem('tec_locale')).toBe('ar'));

    cleanup();
    // A fresh visit: the server saw no cookie, so it rendered English.
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=`);
    render(<LocaleProvider initialLocale="en"><Switcher /></LocaleProvider>);
    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('ar'));
  });
});
