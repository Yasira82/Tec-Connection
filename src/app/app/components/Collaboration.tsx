'use client';

// TEC Connection (C-107) — Collaboration: shared collections. Create a collection,
// open it to add items + invite people you're connected to. Own-or-member scope.
import { useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import { useCollections, useCollection } from '@/lib-client/connection/useCollections';

const card = { background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`, borderRadius: 16, padding: '20px 22px' } as const;
const input = { flex: 1, minWidth: 0, background: TEC_COLORS.bg, color: TEC_COLORS.text, border: `1px solid ${TEC_COLORS.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14 } as const;
const goldBtn = { background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, color: '#0a0800', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' } as const;

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  // Its own hook: Detail is a sibling component, not a child of Collaboration,
  // so it cannot borrow that one's `a`.
  const { t: tr } = useTranslation();
  const a = tr.app;
  const { detail, busy, error, addItem, invite } = useCollection(id);
  const [text, setText] = useState('');
  const [invitee, setInvitee] = useState('');

  const submitItem = async () => { const t = text.trim(); if (!t) return; setText(''); await addItem(t); };
  const submitInvite = async () => { const u = invitee.trim().replace(/^@+/, ''); if (!u) return; setInvitee(''); await invite(u); };

  return (
    <div style={{ ...card }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: TEC_COLORS.subtext, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 10 }}>← Collections</button>
      {!detail ? (
        <p style={{ color: TEC_COLORS.subtext, fontSize: 13, margin: 0 }}>{error ?? 'Loading…'}</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>{detail.title}</h3>
            <span style={{ fontSize: 11, color: TEC_COLORS.subtext }}>{detail.role} · {detail.members.length} {a.members}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input style={input} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitItem(); }} placeholder="Add an item…" maxLength={500} />
            <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submitItem} disabled={busy}>Add</button>
          </div>

          <div style={{ marginTop: 12 }}>
            {detail.items.length === 0 ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>No items yet.</p>
            ) : detail.items.map((it, i) => (
              <div key={it.id} style={{ padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
                <div style={{ fontSize: 14, color: TEC_COLORS.text }}>{it.text}</div>
                <div style={{ fontSize: 11, color: TEC_COLORS.subtext }}><bdi>@{it.by}</bdi></div>
              </div>
            ))}
          </div>

          {detail.role === 'owner' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${TEC_COLORS.border}` }}>
              <input style={input} value={invitee} onChange={(e) => setInvitee(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitInvite(); }} placeholder="Invite a @username" maxLength={100} autoCapitalize="none" />
              <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submitInvite} disabled={busy}>Invite</button>
            </div>
          )}
          {error && <p style={{ color: TEC_COLORS.error, fontSize: 13, marginTop: 10 }}>{error}</p>}
        </>
      )}
    </div>
  );
}

export function Collaboration() {
  const { t } = useTranslation();
  const a = t.app;
  const { collections, loading, busy, error, create } = useCollections();
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const submit = async () => { const t = title.trim(); if (!t) return; setTitle(''); await create(t); };

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>✨</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>{a.collaboration}</h2>
        <span style={{ fontSize: 12, color: TEC_COLORS.subtext }}>{a.sharedCollections}</span>
      </div>

      {openId ? (
        <Detail id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <div style={{ ...card }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={a.newCollection} maxLength={200} />
            <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>{a.create}</button>
          </div>
          {error && <p style={{ color: TEC_COLORS.error, fontSize: 13, marginTop: 10 }}>{error}</p>}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>Loading…</p>
            ) : collections.length === 0 ? (
              <p style={{ color: TEC_COLORS.subtext, fontSize: 13 }}>No collections yet. Create one to plan or build together with your connections.</p>
            ) : collections.map((c, i) => (
              <button key={c.id} onClick={() => setOpenId(c.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                         background: 'none', border: 'none', cursor: 'pointer', borderTop: i === 0 ? 'none' : `1px solid ${TEC_COLORS.border}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEC_COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: TEC_COLORS.subtext }}>{c.role} · {c.items} {a.items} · {c.members} {a.members}</span>
                </span>
                <span style={{ color: TEC_COLORS.subtext, fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
