'use client';

// The report queue — where filed reports actually get read.
//
// Reports were being written to a table with no reader. That is worse than
// having no report button: the sheet tells someone "a person will look at
// this", and until now nobody could.
//
// ── What it shows, and why grouped ──────────────────────────────────────────
// By the person REPORTED, not a flat list. Five reports about one account is a
// different fact from five reports about five accounts, and a flat list hides
// exactly that. The count is the first thing on the row for the same reason.
//
// ── What it deliberately does NOT do ────────────────────────────────────────
// There is no "delete this message" button. Moderation here records a DECISION;
// it does not reach into someone's conversation and edit it. Removing content is
// a heavier act with its own audit requirements, and wiring it to a one-tap
// button in a queue is how a review tool becomes a weapon. Blocking is the
// user's own tool and already exists.
//
// Whether the caller may see any of this is the SERVER's answer (404 for
// everyone else) — this component renders nothing until that answer arrives.
import { useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useModeration, type ReportRow, type ReportStatus } from '@/lib-client/connection/useModeration';

const TABS: ReportStatus[] = ['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED'];

/** The stored snapshot, rendered readably. It is what the content WAS at report
 *  time — the message may since have been deleted, which is the point of it. */
function Snapshot({ raw }: { raw: string }) {
  const { t } = useTranslation();
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const text = String(parsed.body ?? parsed.caption ?? '').trim();
  const media = parsed.media ?? (parsed.media_key ? 'image' : null);
  if (!text && !media) return null;
  return (
    <div style={{
      marginTop: 8, padding: '8px 11px', borderRadius: 10,
      background: TEC_COLORS.bg, border: `1px solid ${TEC_COLORS.border}`,
      fontSize: 12.5, color: TEC_COLORS.text, lineHeight: 1.55, wordBreak: 'break-word',
    }} dir="auto">
      {text || <span style={{ color: TEC_COLORS.subtext }}>{t.app.photo}</span>}
      {text && media ? <span style={{ color: TEC_COLORS.subtext }}> · {t.app.photo}</span> : null}
    </div>
  );
}

function ReportCard({ r, onResolve }: {
  r: ReportRow;
  onResolve: (id: string, next: Exclude<ReportStatus, 'OPEN'>) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const [busy, setBusy] = useState(false);

  const act = async (next: Exclude<ReportStatus, 'OPEN'>) => {
    setBusy(true);
    await onResolve(r.id, next);
    setBusy(false);
  };

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${TEC_COLORS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
          color: TEC_COLORS.gold, background: `${TEC_COLORS.gold}14`,
          border: `1px solid ${TEC_COLORS.gold}33`, borderRadius: 999, padding: '2px 9px',
        }}>{(a[`reason_${r.reason}` as keyof typeof a] as string) ?? r.reason}</span>
        <span style={{ fontSize: 11.5, color: TEC_COLORS.subtext }}>{r.kind}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: TEC_COLORS.subtext }}>
          <bdi>{new Date(r.created_at).toLocaleDateString()}</bdi>
        </span>
      </div>

      {/* The reporter's name is shown to the REVIEWER and to nobody else — the
          queue is unreachable with a normal session, which is what makes this
          safe to display at all. */}
      <p style={{ margin: '6px 0 0', fontSize: 12, color: TEC_COLORS.subtext }}>
        {a.reportedBy} <bdi>@{r.reporter_username}</bdi>
      </p>

      {r.note && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: TEC_COLORS.text, lineHeight: 1.55 }} dir="auto">
          {r.note}
        </p>
      )}

      <Snapshot raw={r.snapshot} />

      {r.status === 'OPEN' ? (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            onClick={() => void act('ACTIONED')} disabled={busy}
            style={{
              background: `${TEC_COLORS.error}14`, border: `1px solid ${TEC_COLORS.error}66`,
              color: TEC_COLORS.error, borderRadius: 999, padding: '7px 15px',
              fontSize: 12.5, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >{a.modActioned}</button>
          <button
            onClick={() => void act('REVIEWED')} disabled={busy}
            style={{
              background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.text,
              borderRadius: 999, padding: '7px 15px', fontSize: 12.5,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >{a.modReviewed}</button>
          <button
            onClick={() => void act('DISMISSED')} disabled={busy}
            style={{
              background: 'none', border: `1px solid ${TEC_COLORS.border}`, color: TEC_COLORS.subtext,
              borderRadius: 999, padding: '7px 15px', fontSize: 12.5,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >{a.modDismissed}</button>
        </div>
      ) : (
        // Already decided. The verdict stays visible rather than the row
        // disappearing — a queue you can only see the unresolved half of gives
        // no way to check what was decided, or by whom.
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: TEC_COLORS.subtext }} dir="auto">
          {(a[`modTab_${r.status}` as keyof typeof a] as string) ?? r.status}
        </p>
      )}
    </div>
  );
}

export function ModerationQueue() {
  const { t } = useTranslation();
  const a = t.app;
  const [tab, setTab] = useState<ReportStatus>('OPEN');
  const { allowed, groups, loading, resolve } = useModeration(tab);

  // null = the server has not answered yet; false = not a reviewer. Neither
  // renders anything — a moderation panel that flickers into view for everyone
  // and then disappears has already told them it exists.
  if (allowed !== true) return null;

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px', color: TEC_COLORS.subtext }}>
        <span style={{ fontSize: 15 }}>🛡️</span>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {a.modQueue}
        </span>
      </div>

      <div style={{
        background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: 6, padding: '12px 14px', flexWrap: 'wrap' }}>
          {TABS.map((s) => {
            const active = s === tab;
            return (
              <button
                key={s} onClick={() => setTab(s)} aria-pressed={active}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '6px 13px', borderRadius: 999,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  color: active ? '#0a0800' : TEC_COLORS.subtext,
                  background: active
                    ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`
                    : 'transparent',
                  border: `1px solid ${active ? 'transparent' : TEC_COLORS.border}`,
                }}
              >{(a[`modTab_${s}` as keyof typeof a] as string) ?? s}</button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: TEC_COLORS.subtext }}>{a.loading}</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: TEC_COLORS.subtext }}>{a.modEmpty}</div>
        ) : groups.map((g) => (
          <div key={g.author} style={{ borderTop: `1px solid ${TEC_COLORS.border}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              background: TEC_COLORS.surface2,
            }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: TEC_COLORS.text }}>
                <bdi>@{g.author}</bdi>
              </span>
              {/* The count is the pattern. One report is a complaint; six about
                  the same account is a case. */}
              <span style={{
                fontSize: 12, fontWeight: 800, borderRadius: 999, padding: '3px 10px',
                color: g.count > 1 ? TEC_COLORS.error : TEC_COLORS.subtext,
                background: g.count > 1 ? `${TEC_COLORS.error}14` : 'transparent',
                border: `1px solid ${g.count > 1 ? `${TEC_COLORS.error}44` : TEC_COLORS.border}`,
              }}>{g.count}</span>
            </div>
            {g.reports.map((r) => (
              <ReportCard key={r.id} r={r} onResolve={resolve} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
