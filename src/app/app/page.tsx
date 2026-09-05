'use client';

// TEC Connection — System of Record (Relationships). C-107.
//
// ── The information architecture, and why it changed ─────────────────────────
// Each tab now has ONE job and says it ONCE. The previous version repeated the
// screen's name three times (page title → section heading → tab label), opened
// the Discover tab with the user's own profile FORM rather than with people, and
// ended every card with a paragraph explaining the product's principles. The
// result read as documentation with buttons in it.
//
// The rules applied here:
//   · The page header is the only title. Sections no longer repeat it.
//   · Discover is for finding people. Editing your own card is a Settings task,
//     so it moved there — a tab called Discover should not be half a form.
//   · Principles (verification is presented, Featured is reach only) are stated
//     once per screen, small, at the bottom — not after every card.
import { useEffect, useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { C, errorA, goldA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useMe } from '@/lib-client/hooks/useMe';
import { InviteCard } from '@/components/referral/InviteCard';
import { BottomNav, type ConnTab } from './components/BottomNav';
import { SettingsView } from './components/SettingsView';
import { Connections } from './components/Connections';
import { Discover } from './components/Discover';
import { NetworkInsights } from './components/NetworkInsights';
import { Trust } from './components/Trust';
import { Notifications } from './components/Notifications';
import { Collaboration } from './components/Collaboration';
import { Messages } from './components/Messages';
import { useConversations } from '@/lib-client/connection/useMessages';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import { joinByInvite } from '@/lib-client/connection/useInvite';

/**
 * Where an unredeemed invite waits.
 *
 * sessionStorage, not the URL: the code is stripped from the address bar
 * on arrival (a screenshot of it would be a working key to the group), and
 * this survives the SSO round trip while dying with the tab.
 */
const PENDING_INVITE = '__tec_pending_invite';

export default function ConnectionHome() {
  const { user, isLoading } = usePiAuth();
  const me = useMe(); // server-resolved Pi username (Pi Browser hides tec_user from client JS — C-123 §3)
  const { t } = useTranslation();
  const [tab, setTab] = useState<ConnTab>('home');
  // The poll lives HERE, not inside <Messages/>. Owned by the tab, the unread
  // badge would only update while you were already looking at Messages — which
  // is the one moment you do not need it.
  const convo = useConversations();
  // The open thread lives here, not inside <Messages/>, so Discover can open one:
  // finding a person and writing to them are two tabs apart, and the page is the
  // only place that sees both.
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const chatOpen = openChatId !== null;
  const [inviteState, setInviteState] = useState<'idle' | 'joining' | 'failed' | 'needsAuth'>('idle');

  // The phone's Back button, on a tab that is not Home.
  //
  // The tabs are React state, so the history knew nothing about them: someone on
  // Messages or Settings pressed Back and left the app, because the last real
  // history entry was whatever came before the app — usually the Hub.
  //
  // This registers the tab as a LAYER in the overlay stack rather than pushing a
  // history entry of its own. A second writer would race the one that is already
  // there: an entry pushed on top of an open chat's entry is the one Back pops,
  // while `onPop` closes the chat and leaves the other stranded — and switching
  // tabs unmounts <Messages/>, whose cleanup calls `history.back()` on an entry
  // that is no longer the top one. As a layer it composes by construction: Back
  // closes the innermost thing, and the tab is simply the outermost of them.
  //
  // Back therefore returns to Home rather than walking the whole tab path. That
  // is the deliberate trade for having one history writer: Home is the app's
  // front door, and the next Back from there leaves — which is correct.
  useBackButton(tab !== 'home', () => {
    // Layer order follows the order effects run in, and React runs a CHILD's
    // effect before its parent's — so a commit that opens a tab and a chat at
    // once (the invite link below does exactly that) registers them inverted,
    // with this layer on top of the chat's. Closing the chat first here makes
    // the outcome the same either way instead of depending on that ordering.
    if (chatOpen) { setOpenChatId(null); return; }
    setTab('home');
  });

  // Someone arrived on an invite link.
  //
  // Redeemed HERE rather than on a page of its own: joining needs the session,
  // and a dedicated /invite route would send anyone not yet signed in through
  // SSO and back to a URL whose code had already been consumed.
  //
  // The code is stripped from the address bar immediately. Leaving it there
  // means a refresh replays the join, and — worse — that a screenshot of this
  // screen is a working key to the group. It is kept in sessionStorage instead,
  // which survives the SSO round trip and dies with the tab.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('invite');
    if (!code) return;
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
    try { sessionStorage.setItem(PENDING_INVITE, code); } catch { /* ignore */ }
    setInviteState('joining');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Redeem it once the session is KNOWN.
   *
   * This used to fire on mount, before `/api/auth/me` had answered. Arriving on
   * an invite link means arriving without a session yet, so the join was made
   * logged-out, the service answered 401, and the screen said "That link is not
   * valid any more" — about a link that was perfectly good. Meanwhile the code
   * had already been stripped from the address bar, so there was nothing left
   * to retry with. The report was exactly that: the link did not join the group,
   * and the group was nowhere to be seen.
   *
   * Waiting for `me.loading` to clear costs one render and makes the message
   * true. Not signed in is now its own state — an invitation to sign in, with
   * the code held — rather than a dead link.
   */
  useEffect(() => {
    if (me.loading) return;
    let code = '';
    try { code = sessionStorage.getItem(PENDING_INVITE) ?? ''; } catch { /* ignore */ }
    if (!code) return;

    if (!me.authenticated) { setInviteState('needsAuth'); return; }

    setInviteState('joining');
    void joinByInvite(code).then((res) => {
      // Spent either way: a successful join must not replay, and a genuinely
      // dead code must not re-fail on every visit for the rest of the session.
      try { sessionStorage.removeItem(PENDING_INVITE); } catch { /* ignore */ }
      if (!res) { setInviteState('failed'); return; }
      setInviteState('idle');
      setTab('messages');
      setOpenChatId(res.id);
      void convo.reload();
    });
    // `convo.reload` is stable; this runs when the session resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.authenticated]);

  const messagePerson = async (username: string) => {
    const res = await convo.openDirect(username);
    if ('id' in res) { setOpenChatId(res.id); setTab('messages'); }
    // A failure leaves you on Discover rather than dropping you into an empty
    // Messages tab with no explanation of why nothing opened.
  };

  const piName = me.username ?? user?.piUsername ?? null;
  const name = piName ? `@${piName}` : '';

  // One title, one subtitle, per screen. The subtitle says what the tab is FOR
  // in a few words — it is not a place to explain the platform.
  const heading: Record<ConnTab, { title: string; sub: string }> = {
    home:     { title: isLoading || !name ? t.connection.welcome : name, sub: t.connection.nav.homeSub },
    messages: { title: t.app.messages,            sub: t.app.messagesSub },
    discover: { title: t.connection.nav.discover, sub: t.connection.nav.discoverSub },
    trust:    { title: t.connection.nav.trust,    sub: t.connection.nav.trustSub },
    settings: { title: t.connection.nav.settings, sub: '' },
  };
  const { title, sub } = heading[tab];

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px calc(96px + env(safe-area-inset-bottom))' }}>
        {/* Arriving on an invite link. Said out loud, because a link that opens
            the app and then appears to do nothing reads as a broken link — and
            a revoked one has to say so rather than leaving someone waiting. */}
        {inviteState !== 'idle' && (
          <div style={{
            margin: '0 0 16px', padding: '10px 14px', borderRadius: 12,
            background: inviteState === 'failed' ? errorA(0.1) : goldA(0.078),
            // `needsAuth` is not an error — it is the next step, and painting it
            // red tells somebody their good link is broken.
            border: `1px solid ${inviteState === 'failed' ? errorA(0.3) : goldA(0.267)}`,
            fontSize: 13, lineHeight: 1.5,
            color: inviteState === 'failed' ? C.error : C.text,
          }}>
            {inviteState === 'failed'    ? t.app.inviteInvalid
             : inviteState === 'needsAuth' ? t.app.inviteNeedsAuth
             : t.app.joiningByInvite}
          </div>
        )}

        {/* An open chat owns the screen, the way it does in every messaging app
            people already know. Keeping the page header above it left the
            conversation in a box under a title that repeated its own name. */}
        {!(tab === 'messages' && chatOpen) && (
        /* ── The band ───────────────────────────
           The Hub frames every inner page with a solid band that has rounded
           BOTTOM corners; the tabs here opened on exactly the same flat ground
           as each other, so switching between them felt like nothing had
           happened. Same shape, same token, same radius as the Hub — one frame
           across the fleet rather than a per-app flourish.

           `tec-on-band` re-scopes the palette for this subtree: the band is
           dark in BOTH themes, so on a light page the ink inside it has to stay
           light. Anything dropped in here is correct without knowing that. */
        <header className="tec-on-band" style={{
          background: 'var(--tec-topbar)',
          borderRadius: '0 0 var(--tec-topbar-radius) var(--tec-topbar-radius)',
          // Bleeds to the edges: the band frames the screen, not the column, so
          // it cancels the page gutter and restores it as its own padding.
          //
          // The Hub's band is `12px 20px 16px`, and the first version here was
          // 28/18 around a 26px title — which made a band nearly half again as
          // tall as the one it was copied from, on the screen where the two are
          // compared by tapping between them. A curve on a taller band reads as
          // a BIGGER curve at the same radius, so the fix is the height, not the
          // token.
          margin: '-28px -20px 18px',
          padding: 'calc(12px + env(safe-area-inset-top)) 20px 16px',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.subtext, textTransform: 'uppercase', fontWeight: 700 }}>
            {t.connection.brand}
          </div>
          {/* 22px, not 26. Chrome, not a hero — but still above the ~20px
              section headings below it, which an 18px title (the Hub's, where it
              sits in a ROW beside a back button) would have inverted. */}
          {/* <bdi>: on the Home tab the title is a Latin @handle. Inside an
              Arabic (RTL) document the '@' is bidi-neutral and resolves against
              the paragraph — it rendered as "yas55eR82@". */}
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.gold, margin: '2px 0 0', letterSpacing: '-0.02em' }}>
            <bdi>{title}</bdi>
          </h1>
          {sub && (
            <p style={{ fontSize: 12.5, color: C.subtext, margin: '3px 0 0', lineHeight: 1.45 }}>{sub}</p>
          )}
        </header>
        )}

        {/* HOME — what happened, and who you follow. Nothing to configure here. */}
        {tab === 'home' && (
          <>
            <Notifications />
            <Connections />
            <InviteCard />
          </>
        )}

        {/* MESSAGES — direct threads and groups. `me` comes from the server-
            resolved session username, so "is this mine?" is decided by the same
            identity the backend scoped the thread to. */}
        {tab === 'messages' && (
          <Messages
            me={piName ?? ''}
            conversations={convo.conversations}
            loading={convo.loading}
            openDirect={convo.openDirect}
            createGroup={convo.createGroup}
            openId={openChatId}
            setOpenId={setOpenChatId}
          />
        )}

        {/* DISCOVER — people. The profile editor lives in Settings. */}
        {tab === 'discover' && (
          <>
            <Discover onMessage={messagePerson} />
            <NetworkInsights />
          </>
        )}

        {/* TRUST — what real activity says, plus shared collections. */}
        {tab === 'trust' && (
          <>
            <Trust />
            <Collaboration />
          </>
        )}

        {/* SETTINGS — your card, Pro, your language, your account. */}
        {tab === 'settings' && <SettingsView />}
      </div>

      <BottomNav active={tab} onSelect={setTab} badges={{ messages: convo.unreadTotal }} />
    </main>
  );
}
