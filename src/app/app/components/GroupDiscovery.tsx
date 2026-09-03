'use client';

// Finding a group to join.
//
// Opens on a BROWSE, not an empty search box. Someone who does not yet know
// what exists cannot search for it, and a blank screen with a cursor in it is
// the fastest way to make a directory look empty.
//
// Each row says exactly one thing about where you stand with that group —
// Member, Pending, or a Join button — because the state is the server's answer,
// not a guess. A row that offers "Join" to someone who asked yesterday gets
// asked again, and it is the owner who deals with that.
import { useState } from 'react';
import { C, goldA, successA } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { Avatar } from '@/components/public/Avatar';
import { useGroupDiscovery, type PublicGroup } from '@/lib-client/connection/useGroupDiscovery';
import { useBackButton } from '@/lib-client/connection/useBackButton';

function Row({ g, busy, onJoin, onWithdraw }: {
  g: PublicGroup;
  busy: boolean;
  onJoin: () => void;
  onWithdraw: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderTop: `1px solid ${C.border}`,
    }}>
      <Avatar
        username={(g.title || '?').replace(/^@/, '')}
        size={44}
        tryPhoto={g.hasPhoto}
        photoSrc={`/api/bff/connection/conversations/${encodeURIComponent(g.id)}/avatar`}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14.5, fontWeight: 700, color: C.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <bdi dir="auto">{g.title}</bdi>
        </div>
        {g.description && (
          <div style={{
            fontSize: 12.5, color: C.subtext, marginTop: 2, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }} dir="auto">{g.description}</div>
        )}
        {/* A COUNT, never who. */}
        <div style={{ fontSize: 11.5, color: C.subtext, marginTop: 3 }}>
          <bdi>{g.members} {a.membersLabel}</bdi>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {g.joined ? (
          <span style={{
            fontSize: 12, fontWeight: 700, color: C.success,
            background: successA(0.1), border: `1px solid ${successA(0.25)}`,
            borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap',
          }}>{a.groupJoined}</span>
        ) : g.request === 'PENDING' ? (
          // Tappable, because a request you cannot withdraw is a request you
          // regret making.
          <button
            onClick={onWithdraw} disabled={busy}
            style={{
              fontSize: 12, fontWeight: 700, color: C.gold,
              background: goldA(0.078), border: `1px solid ${goldA(0.267)}`,
              borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >{a.groupPending}</button>
        ) : (
          <button
            onClick={onJoin} disabled={busy}
            style={{
              fontSize: 12.5, fontWeight: 700, color: C.onGold,
              background: C.gold,
              border: 'none', borderRadius: 999, padding: '7px 16px', whiteSpace: 'nowrap',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >{g.request === 'REJECTED' ? a.groupAskAgain : a.groupJoin}</button>
        )}
      </div>
    </div>
  );
}

export function GroupDiscovery({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const a = t.app;
  const { q, setQ, groups, loading, failed, busyId, toggleRequest } = useGroupDiscovery();
  const [notice, setNotice] = useState('');
  useBackButton(true, onClose);

  const ask = async (g: PublicGroup, withdraw: boolean) => {
    const ok = await toggleRequest(g.id, withdraw);
    // The one thing worth saying out loud: joining is not instant, and someone
    // who taps Join and sees nothing happen concludes it is broken.
    setNotice(ok ? (withdraw ? '' : a.groupRequestSent) : a.groupRequestFailed);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 940,
      background: C.bg, display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={onClose} aria-label={a.closeLabel}
          style={{
            width: 34, height: 34, borderRadius: 999, flexShrink: 0,
            background: 'none', border: `1px solid ${C.border}`,
            color: C.text, fontSize: 15, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >✕</button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, flex: 1 }}>
          {a.discoverGroups}
        </h3>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setNotice(''); }}
          placeholder={a.searchGroupsPlaceholder} maxLength={120} dir="auto"
          autoCapitalize="none" autoCorrect="off"
          style={{
            // border-box, and it is NOT optional here.
            //
            // This project has no platform-wide `* { box-sizing: border-box }`
            // — deliberately, per public-surface.css — so `width: 100%` plus
            // 16px of padding and a border makes the field 34px WIDER than the
            // column that holds it. It overflows the screen, and in a
            // right-to-left layout the overflow is on the LEADING edge: the
            // first character of what you typed is cut in half.
            boxSizing: 'border-box',
            width: '100%', background: C.surface, color: C.text,
            border: `1px solid ${C.border}`, borderRadius: 999,
            padding: '11px 16px', fontSize: 14, outline: 'none',
          }}
        />
        <p style={{ margin: '8px 4px 0', fontSize: 11.5, color: C.subtext, lineHeight: 1.5 }}>
          {a.groupJoinNotice}
        </p>
        {notice && (
          <p style={{ margin: '6px 4px 0', fontSize: 12, color: C.gold }}>{notice}</p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        {loading ? (
          <p style={{ padding: '16px', fontSize: 13, color: C.subtext }}>{a.loading}</p>
        ) : failed ? (
          <p style={{ padding: '16px', fontSize: 13, color: C.error }}>{a.groupSearchFailed}</p>
        ) : groups.length === 0 ? (
          // Two different situations, two different sentences. "No results" for
          // a search nobody matched is not the same as "nothing is listed yet".
          <p style={{ padding: '16px', fontSize: 13, color: C.subtext, lineHeight: 1.6 }}>
            {q ? a.groupNoResults : a.groupNoneListed}
          </p>
        ) : groups.map((g) => (
          <Row
            key={g.id} g={g} busy={busyId === g.id}
            onJoin={() => { void ask(g, false); }}
            onWithdraw={() => { void ask(g, true); }}
          />
        ))}
      </div>
    </div>
  );
}
