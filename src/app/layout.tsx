import { PiWarmup } from '@/components/pi/PiWarmup';
import { RefCapture } from '@/components/referral/RefCapture';
import { RefApply } from '@/components/referral/RefApply';
import { LocaleProvider } from '@/lib/i18n';
import { THEME_BOOT_SCRIPT } from '@/lib-client/theme';
import { getI18n } from '@/lib/i18n/server';
import { HUB_HOSTS } from '@/lib/pi-network';
import type { Metadata } from 'next';
import '@/styles/tec-design-tokens.css';
// App-owned polish for the three public surfaces (landing · /discover · /u/<handle>).
// Kept out of tec-design-tokens.css on purpose: that file is synced with the tec-ui
// package across the fleet, so app-specific rules there become drift.
import '@/styles/public-surface.css';
import { ArrivalReport } from '@/components/pioneer/ArrivalReport';

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
        {/* The Pi SDK is NOT loaded here. It is injected below, and ONLY when
            this is not a Hub-owned session — see the note in that script. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                // ADR-007/C-12 §3: Hub-entered = Hub owns this Pi Browser
                // session — never Pi.init() here (it poisons the session and
                // breaks the Hub PaymentModal). The SSO landing persists the
                // flag; referrer covers direct hops.
                //
                // BOTH Hub hosts. The list is interpolated from
                // lib/pi-network.ts (HUB_HOSTS) because this script runs before
                // any module and cannot import — but it must not become a
                // second, drifting copy of the answer. It named only the
                // Mainnet Hub, so a hop from the Testnet Hub ran Pi.init() into
                // a session the Hub owns and every later Pi call went silent.
                var __hubHosts = ${JSON.stringify(HUB_HOSTS)};
                var __fromHub = false;
                try {
                  __fromHub = !!document.referrer &&
                    __hubHosts.indexOf(new URL(document.referrer).hostname.toLowerCase()) !== -1;
                } catch (e) {}
                try {
                  if (sessionStorage.getItem('__tec_hub_entry') === '1' || __fromHub) {
                    window.__TEC_PI_FOREIGN_SESSION = true;
                    window.__TEC_PI_READY = true;
                    window.dispatchEvent(new Event('tec-pi-ready'));
                    return;
                  }
                } catch(e) {}
                // Standalone session — load the SDK now, then init it. In a
                // Hub-owned session it is not merely left un-init'd, it is NOT
                // LOADED AT ALL: pulling pi-sdk.js opens Pi's bridge on this
                // origin regardless of init, and ADR-007 says an app in a
                // Hub-owned session must not touch Pi. Loading its SDK is
                // touching it.
                var __boot = function () {
                  if (typeof window.Pi === 'undefined') {
                    window.__TEC_PI_ERROR = true;
                    window.dispatchEvent(new Event('tec-pi-error'));
                    return;
                  }
                  try {
                    var __isTestnetHost = /\\.vercel\\.app$/i.test(location.hostname)
                      || /-test\\.tecosystem\\.app$/i.test(location.hostname);
                    // SANDBOX IS NOT TESTNET. They are different axes, and
                    // conflating them cost a day:
                    //
                    //   the HOST   decides which Pi APP the visitor is in, and
                    //              so which network the server approves against
                    //   "sandbox"  tells the SDK to talk to Pi's SANDBOX
                    //              environment, which is a third thing entirely
                    //
                    // A paired Testnet app in Pi Browser is a normal app on its
                    // own domain — NOT the sandbox. Setting sandbox:true there
                    // left the Pi bridge silent: "Pi auth failed: Messaging
                    // promise with id 1 timed out after 120000ms", its first
                    // message never answered. With the same host and the same
                    // build and only this flag false, the wallet opened and the
                    // payment reached approve. One clean A/B, one trial.
                    //
                    // So the default is FALSE everywhere, and ?pi_sandbox=1 is
                    // the way back in — honoured only on the Testnet host, so a
                    // Mainnet payment can never be put into sandbox mode by a
                    // query param.
                    //
                    // Either way this is the CLIENT's view and authorises
                    // nothing: what a payment is approved against is still
                    // derived server-side from the BFF's own Host header
                    // (metadata.testnet) and stays unforgeable.
                    var __q = null;
                    try { __q = new URLSearchParams(location.search).get('pi_sandbox'); } catch (e) {}
                    var __sandbox = __isTestnetHost
                      ? (__q === '1')
                      : ${process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'};
                    window.__TEC_PI_SANDBOX = __sandbox;
                    window.Pi.init({
                      version: '2.0',
                      // The SAME host rule the BFF uses, read here from the
                      // browser's own location. A .pi domain needs a Pi app,
                      // and Pi issues every app twice — a Mainnet one and a
                      // paired Testnet one, both pointing at THIS deployment on
                      // different hosts. One build serves both, so the build-time
                      // flag alone cannot answer which app the visitor is in.
                      //
                      // Two independent reads of one fact, rather than one side
                      // telling the other: the server decides from its Host
                      // header what the payment is approved against, and cannot
                      // be told otherwise by a client.
                      sandbox: __sandbox,
                    });
                    window.__TEC_PI_READY = true;
                    window.dispatchEvent(new Event('tec-pi-ready'));
                  } catch(e) {
                    window.__TEC_PI_ERROR = true;
                    window.dispatchEvent(new Event('tec-pi-error'));
                  }
                };

                if (typeof window.Pi !== 'undefined') { __boot(); return; }
                var __s = document.createElement('script');
                __s.src   = 'https://sdk.minepi.com/pi-sdk.js';
                __s.async = true;
                __s.onload  = __boot;
                __s.onerror = function () {
                  window.__TEC_PI_ERROR = true;
                  window.dispatchEvent(new Event('tec-pi-error'));
                };
                document.head.appendChild(__s);
              });
            `,
          }}
        />
      </head>
      <body>
        <PiWarmup />
        <ArrivalReport />
        <LocaleProvider initialLocale={locale}>
          <RefCapture />
          <RefApply />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
