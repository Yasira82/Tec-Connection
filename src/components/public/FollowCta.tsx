'use client';

// The one button on a shared profile link.
//
// This page is the app's cheapest acquisition surface — someone pastes
// /u/<handle> into a group chat and strangers tap it. Until now the button on it
// said, in effect, "go and open the app": a `<Link href="/app">`. That is exactly
// the sentence a shared link exists to avoid. Whoever tapped it arrived in an
// empty app with no memory of who they had come to see.
//
// It performs the follow now, and it works from a cold start with no session:
//
//     tap  →  Pi sign-in  →  back to THIS profile  →  followed
//
// The intent rides in the URL (`?follow=1`) rather than in storage. The Hub
// preserves `pathname + search` of the sign-in target and hands it back to
// /api/auth/sso-callback as `redirect`, so the round trip returns to the same
// profile with the intent intact — no client storage to survive a redirect that
// Pi Browser is known to be rough with (C-123).
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';

type State = 'idle' | 'busy' | 'done' | 'self' | 'failed';

export function FollowCta({ username, labels }: {
  username: string;
  labels: {
    follow: string;      // "Follow @{name}", already filled
    following: string;   // after it worked
    signIn: string;      // shown when there is no session yet
    self: string;        // this profile is the visitor's own
    failed: string;
  };
}) {
  const { isAuthenticated, isLoading, user } = usePiAuth();
  const [state, setState] = useState<State>('idle');
  // The auto-follow must fire at most once. Auth resolves asynchronously and the
  // effect re-runs; without this a slow network turns one intent into several
  // POSTs, and the button flickers between states while they land.
  const fired = useRef(false);

  const norm = (u: string) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

  const follow = useCallback(async () => {
    setState('busy');
    try {
      const res = await fetch('/api/bff/connection/following', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      // 409 is "already following" — a success from where the visitor stands.
      setState(res.ok || res.status === 409 ? 'done' : 'failed');
    } catch {
      setState('failed');
    }
  }, [username]);

  useEffect(() => {
    if (isLoading || fired.current) return;

    // Your own profile. Said plainly rather than offering a button the service
    // will refuse — a shared link often comes back to the person who sent it.
    if (isAuthenticated && user?.piUsername && norm(user.piUsername) === norm(username)) {
      fired.current = true;
      setState('self');
      return;
    }

    const intent = new URLSearchParams(window.location.search).get('follow') === '1';
    if (!intent) return;

    // The intent is spent the moment it is read — before the request, not after.
    // Left in the address bar it replays on every refresh, and a shared
    // screenshot of this URL would follow on the reader's behalf.
    const url = new URL(window.location.href);
    url.searchParams.delete('follow');
    window.history.replaceState({}, '', url.toString());

    if (!isAuthenticated) return;   // came back without a session; the button still works
    fired.current = true;
    void follow();
  }, [isLoading, isAuthenticated, user?.piUsername, username, follow]);

  const onClick = () => {
    if (state === 'busy' || state === 'done' || state === 'self') return;
    if (!isAuthenticated) {
      // Back to THIS profile, carrying the intent — not to /app. Someone who
      // tapped Follow on a person wants to end up having followed that person.
      const back = `${window.location.origin}/u/${encodeURIComponent(username)}?follow=1`;
      ssoRedirect(HUB_URL, back);
      return;
    }
    void follow();
  };

  const label =
    state === 'done'   ? labels.following
    : state === 'self' ? labels.self
    : state === 'busy' ? '…'
    : isLoading || isAuthenticated ? labels.follow
    : labels.signIn;

  const inert = state === 'done' || state === 'self' || state === 'busy';

  return (
    <>
      <button
        onClick={onClick}
        disabled={inert}
        className="pub-cta"
        style={{
          border: 'none', cursor: inert ? 'default' : 'pointer',
          width: '100%', font: 'inherit',
          ...(state === 'done' && { opacity: 0.75 }),
        }}
      >
        <bdi>{label}</bdi>
      </button>
      {state === 'failed' && (
        <p style={{ fontSize: 12.5, color: '#EF4444', margin: '10px 0 0' }}>{labels.failed}</p>
      )}
    </>
  );
}
