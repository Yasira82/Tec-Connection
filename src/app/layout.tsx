import { RefCapture } from '@/components/referral/RefCapture';
import { RefApply } from '@/components/referral/RefApply';
import { LocaleProvider } from '@/lib/i18n';
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
    <html lang={locale} dir={dir}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Full-bleed dark shell — kill every source of the "white frame" around the
            dark app in Pi Browser. */}
        <meta name="theme-color" content="#050816" />
        <meta name="color-scheme" content="dark" />
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
