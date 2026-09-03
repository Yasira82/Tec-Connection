'use client';

// TEC Connection (C-107) — Collaboration: shared collections. Create a collection,
// open it to add items + invite people you're connected to. Own-or-member scope.
import { useState } from 'react';
import { C } from '@/lib-client/palette';
import { useTranslation } from '@/lib/i18n';
import { useCollections, useCollection } from '@/lib-client/connection/useCollections';

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px' } as const;
const input = { flex: 1, minWidth: 0, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14 } as const;
const goldBtn = { background: C.gold, color: C.onGold, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' } as const;

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
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.subtext, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 10 }}>{a.backCollections}</button>
      {!detail ? (
        <p style={{ color: C.subtext, fontSize: 13, margin: 0 }}>{error ?? a.loading}</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>{detail.title}</h3>
            <span style={{ fontSize: 11, color: C.subtext }}>
              <bdi>{detail.role === 'owner' ? a.owner : a.member}</bdi>
              {' · '}<bdi>{detail.members.length} {a.members}</bdi>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input style={input} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitItem(); }} placeholder={a.addItemPlaceholder} maxLength={500} />
            <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submitItem} disabled={busy}>{a.add}</button>
          </div>

          <div style={{ marginTop: 12 }}>
            {detail.items.length === 0 ? (
              <p style={{ color: C.subtext, fontSize: 13 }}>{a.noItems}</p>
            ) : detail.items.map((it, i) => (
              <div key={it.id} style={{ padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, color: C.text }}>{it.text}</div>
                <div style={{ fontSize: 11, color: C.subtext }}><bdi>@{it.by}</bdi></div>
              </div>
            ))}
          </div>

          {detail.role === 'owner' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <input style={input} value={invitee} onChange={(e) => setInvitee(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitInvite(); }} placeholder={a.invitePlaceholder} maxLength={100} autoCapitalize="none" />
              <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} onClick={submitInvite} disabled={busy}>{a.invite}</button>
            </div>
          )}
          {error && <p style={{ color: C.error, fontSize: 13, marginTop: 10 }}>{error}</p>}
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
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{a.collaboration}</h2>
        <span style={{ fontSize: 12, color: C.subtext }}>{a.sharedCollections}</span>
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
          {error && <p style={{ color: C.error, fontSize: 13, marginTop: 10 }}>{error}</p>}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <p style={{ color: C.subtext, fontSize: 13 }}>{a.loading}</p>
            ) : collections.length === 0 ? (
              <p style={{ color: C.subtext, fontSize: 13 }}>{a.noCollections}</p>
            ) : collections.map((c, i) => (
              <button key={c.id} onClick={() => setOpenId(c.id)}
                style={{ width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                         background: 'none', border: 'none', cursor: 'pointer', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: C.subtext }}>
                    <bdi>{c.role === 'owner' ? a.owner : a.member}</bdi>
                    {' · '}<bdi>{c.items} {a.items}</bdi>
                    {' · '}<bdi>{c.members} {a.members}</bdi>
                  </span>
                </span>
                <span style={{ color: C.subtext, fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
