import { RefCapture } from '@/components/referral/RefCapture';
import { RefApply } from '@/components/referral/RefApply';
import { LocaleProvider } from '@/lib/i18n';
import { THEME_BOOT_SCRIPT } from '@/lib-client/theme';
import { getI18n } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import '@/styles/tec-design-tokens.css';
// App-owned polish for the three public surfaces (landing · /discover · /u/<handle>).
// Kept out of tec-design-tokens.css on purpose: that file is synced with the tec-ui
// package across the fleet, so app-specific rules there become drift.
import '@/styles/public-surface.css';

export const metadata: Metadata = {
  title:       'TEC Connection',
  description: 'TEC Connection — your economic relationship graph on Pi Network',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved per request from the cookie, then Accept-Language. Setting `lang`
  // and `dir` HERE — rather than from the client provider after hydration —
  // means an Arabic visitor gets a right-to-left document in the first byte of
  // HTML instead of a left-to-right flash, and a crawler sees the real language.
  const { locale, dir } = await getI18n();

  return (
    // `suppressHydrationWarning` because the boot script STAMPS `data-theme`
    // and `style.color-scheme` on this element before React hydrates. That is
    // the point of the script — the alternative is a flash of the wrong theme
    // on every load — so the mismatch it causes is expected and only here.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* One theme-color per scheme, so the browser chrome above the page
            matches the page. A single dark value leaves a black bar sitting on
            top of a light app.

            These stay HEX LITERALS by necessity: a `theme-color` meta is read
            by the browser's own chrome, outside the document's style
            resolution, so `var(--tec-bg)` there is simply ignored. Same class
            of constraint as the SSO landing HTML and `next/og`. */}
        <meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#101014" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f3f1" />
        {/* `color-scheme` is NOT declared here any more. It has to follow the
            reader's stored choice, which only the boot script knows — a static
            `dark` meta made light mode paint dark scrollbars and dark form
            controls, which is how a theme ends up looking half-finished. */}
        {/* Applies the stored theme BEFORE first paint. Inline and synchronous
            on purpose: anything deferred means the page renders dark and then
            snaps to light on every load — a flash worse than not offering the
            choice at all. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script
          src="https://sdk.minepi.com/pi-sdk.js"
          async
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                // ADR-007/C-12 §3: Hub-entered = Hub owns this Pi Browser
                // session — never Pi.init() here (it poisons the session and
                // breaks the Hub PaymentModal). The SSO landing persists the
                // flag; referrer covers direct hops.
                try {
                  if (sessionStorage.getItem('__tec_hub_entry') === '1' ||
                      document.referrer.toLowerCase().indexOf('hub.tecosystem.app') !== -1) {
                    window.__TEC_PI_FOREIGN_SESSION = true;
                    window.__TEC_PI_READY = true;
                    window.dispatchEvent(new Event('tec-pi-ready'));
                    return;
                  }
                } catch(e) {}
                if (typeof window.Pi !== 'undefined') {
                  try {
                    window.Pi.init({
                      version: '2.0',
                      sandbox: ${process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'},
                    });
                    window.__TEC_PI_READY = true;
                    window.dispatchEvent(new Event('tec-pi-ready'));
                  } catch(e) {
                    window.__TEC_PI_ERROR = true;
                    window.dispatchEvent(new Event('tec-pi-error'));
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>
          <RefCapture />
          <RefApply />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
