'use client';

// Handing someone your profile link.
//
// The link is the acquisition channel — a person shares it and whoever taps it
// lands on a card with a name, a headline and one button. But nothing on the
// page ever offered to share it: the reader had to notice the address bar,
// select the URL, and copy it by hand. On a phone, inside Pi Browser, almost
// nobody does that.
//
// `navigator.share` is tried FIRST, and it is the whole point: on a phone it
// opens the system sheet straight into WhatsApp, Telegram or Pi Chat, which is
// exactly the path the link is meant to travel. Clipboard is the fallback for a
// desktop browser, and a visible URL is the fallback for both — Pi Browser does
// not always grant clipboard access, and a share button that appears to do
// nothing is worse than no share button.
import { useState } from 'react';

export function ShareProfile({ username, labels }: {
  username: string;
  labels: { share: string; copied: string; title: string; text: string };
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  // Built from the browser's OWN origin. This app answers on two hostnames (the
  // domain and the Vercel one) and a hard-coded host would send half the people
  // who tap it somewhere their session is not — the same reason the group invite
  // link is built this way.
  const url = () => `${window.location.origin}/u/${encodeURIComponent(username)}`;

  const onShare = async () => {
    const link = url();
    // The native sheet. Not awaited for a result — a cancelled share resolves
    // and a dismissed one rejects, and neither is a failure worth reporting.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: labels.title, text: labels.text, url: link });
        return;
      } catch { /* cancelled, or unavailable in this context — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      return;
    } catch { /* no clipboard permission — show it instead */ }
    // Last resort: put the URL on screen so it can be selected by hand. A
    // button that silently does nothing is the failure this avoids.
    setShown(link);
  };

  return (
    <>
      <button
        onClick={() => { void onShare(); }}
        className="pub-secondary"
        style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
      >
        {copied ? labels.copied : `🔗 ${labels.share}`}
      </button>
      {shown && (
        <p
          dir="ltr"
          style={{
            fontSize: 11.5, color: 'rgba(255,255,255,0.55)', margin: '10px 0 0',
            wordBreak: 'break-all', userSelect: 'all',
          }}
        >{shown}</p>
      )}
    </>
  );
}
