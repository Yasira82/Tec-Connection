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
import { joinByInvite } from '@/lib-client/connection/useInvite';

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
  const [inviteState, setInviteState] = useState<'idle' | 'joining' | 'failed'>('idle');

  // Someone arrived on an invite link.
  //
  // Redeemed HERE rather than on a page of its own: joining needs the session,
  // and a dedicated /invite route would send anyone not yet signed in through
  // SSO and back to a URL whose code had already been consumed.
  //
  // The code is stripped from the address bar either way. Leaving it there means
  // a refresh replays the join, and — worse — that a screenshot of this screen
  // is a working key to the group.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('invite');
    if (!code) return;
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());

    setInviteState('joining');
    void joinByInvite(code).then((res) => {
      if (!res) { setInviteState('failed'); return; }
      setInviteState('idle');
      setTab('messages');
      setOpenChatId(res.id);
      void convo.reload();
    });
    // Once, on arrival. `convo.reload` is stable and the code is read from the
    // URL at mount — re-running this would try to redeem a code already spent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            border: `1px solid ${inviteState === 'failed' ? errorA(0.3) : goldA(0.267)}`,
            fontSize: 13, lineHeight: 1.5,
            color: inviteState === 'failed' ? C.error : C.text,
          }}>
            {inviteState === 'failed' ? t.app.inviteInvalid : t.app.joiningByInvite}
          </div>
        )}

        {/* An open chat owns the screen, the way it does in every messaging app
            people already know. Keeping the page header above it left the
            conversation in a box under a title that repeated its own name. */}
        {!(tab === 'messages' && chatOpen) && (
        <header style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, color: C.subtext, textTransform: 'uppercase', fontWeight: 700 }}>
            {t.connection.brand}
          </div>
          {/* <bdi>: on the Home tab the title is a Latin @handle. Inside an
              Arabic (RTL) document the '@' is bidi-neutral and resolves against
              the paragraph — it rendered as "yas55eR82@". */}
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.gold, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            <bdi>{title}</bdi>
          </h1>
          {sub && (
            <p style={{ fontSize: 13.5, color: C.subtext, margin: '5px 0 0', lineHeight: 1.5 }}>{sub}</p>
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
