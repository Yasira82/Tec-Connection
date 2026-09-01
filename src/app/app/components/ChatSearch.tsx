'use client';

// Finding a message in the thread you are already reading.
//
// It covers the transcript rather than sitting above it. A search bar wedged
// into the chat pushes the conversation down the screen and leaves the reader
// in two places at once; a panel is one thing at a time, and Back closes it.
//
// Tapping a result closes the panel and scrolls to that message — but only when
// it is actually loaded. A result whose message is above what has been fetched
// does nothing rather than jumping to the wrong place, and it says why.
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useBackButton } from '@/lib-client/connection/useBackButton';
import { useChatSearch, MIN_QUERY, type Hit } from '@/lib-client/connection/useChatSearch';

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * The matched run, marked inside the line it was found in.
 *
 * A plain substring match, because that is exactly what the server did — the
 * query is `contains`, case-insensitive, nothing more. Anything cleverer here
 * would highlight text the search did not actually match on.
 */
function Marked({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: TEC_COLORS.gold, fontWeight: 700 }}>{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

export function ChatSearch({ conversationId, onOpen, onClose }: {
  conversationId: string;
  /** Given a message id that IS loaded; the caller scrolls to it. */
  onOpen: (hit: Hit) => boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const { q, setQ, hits, searching, failed } = useChatSearch(conversationId);
  useBackButton(true, onClose);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 945,
      background: TEC_COLORS.bg, display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: `1px solid ${TEC_COLORS.border}`,
      }}>
        <button
          onClick={onClose} aria-label={a.closeLabel}
          style={{
            width: 34, height: 34, borderRadius: 999, flexShrink: 0,
            background: 'none', border: `1px solid ${TEC_COLORS.border}`,
            color: TEC_COLORS.text, fontSize: 15, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >✕</button>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={a.searchMessagesPlaceholder} maxLength={200} dir="auto"
          autoFocus autoCapitalize="none" autoCorrect="off"
          style={{
            // border-box, for the reason written down in
            // full-width-input-boxsizing.test.ts: this project has no global
            // border-box, so width:100% plus padding overflows — and in RTL the
            // overflow eats the FIRST character of what was typed.
            boxSizing: 'border-box',
            flex: 1, minWidth: 0, background: TEC_COLORS.surface, color: TEC_COLORS.text,
            border: `1px solid ${TEC_COLORS.border}`, borderRadius: 999,
            padding: '10px 14px', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        {q.trim().length < MIN_QUERY ? (
          <p style={{ padding: 16, fontSize: 13, color: TEC_COLORS.subtext, lineHeight: 1.6 }}>{a.searchMessagesHint}</p>
        ) : searching ? (
          <p style={{ padding: 16, fontSize: 13, color: TEC_COLORS.subtext }}>{a.loading}</p>
        ) : failed ? (
          <p style={{ padding: 16, fontSize: 13, color: TEC_COLORS.error }}>{a.searchMessagesFailed}</p>
        ) : hits.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: TEC_COLORS.subtext }}>{a.searchMessagesNone}</p>
        ) : hits.map((h) => (
          <button
            key={h.id}
            onClick={() => { if (onOpen(h)) onClose(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer',
              padding: '12px 16px', background: 'none', border: 'none',
              borderTop: `1px solid ${TEC_COLORS.border}`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEC_COLORS.gold, flexShrink: 0 }}>
                <bdi>@{h.by}</bdi>
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: TEC_COLORS.subtext, flexShrink: 0 }}><bdi>{clock(h.at)}</bdi></span>
            </span>
            <span style={{
              display: 'block', fontSize: 13.5, color: TEC_COLORS.text, marginTop: 3, lineHeight: 1.45,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} dir="auto">
              <Marked text={h.body} q={q.trim()} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
