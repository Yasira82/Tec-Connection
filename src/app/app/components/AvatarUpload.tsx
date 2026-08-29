'use client';

// Profile photo control for the "Your public profile" editor (C-107).
//
// Three steps, and the middle one is why this is more than a form field: the
// storage bucket is private, so the browser asks the BFF for a presigned URL,
// PUTs the file straight to R2, then tells the BFF the key. The file bytes never
// pass through Vercel — a 2MB image would otherwise be an upload into a
// serverless function and back out again.
//
// The preview is a local `URL.createObjectURL`, shown the instant a file is
// picked and kept until the save round-trip finishes. Waiting for the server to
// confirm before showing anything makes a phone upload feel broken; showing the
// local file makes it feel instant while still being honest, because a failure
// clears it and says so.
import { useRef, useState, useEffect } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT    = 'image/jpeg,image/png,image/webp';

export function AvatarUpload({
  username, hasPhoto, onChange,
}: {
  username: string;
  hasPhoto: boolean;
  /** Called after the server has confirmed, so the parent can refresh its copy. */
  onChange: (hasPhoto: boolean) => void;
}) {
  const { t } = useTranslation();
  const a = t.app;
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState('');
  // Bumped after a successful change so the <img> re-requests. Without it the
  // browser keeps serving the cached bytes of the OLD photo from the same URL,
  // and the user thinks the upload silently failed.
  const [version, setVersion] = useState(0);

  // Object URLs are a leak if they outlive the component.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const src = hasPhoto ? `/api/avatar/${encodeURIComponent(username)}?v=${version}` : null;

  const pick = () => fileRef.current?.click();

  const upload = async (file: File) => {
    // Checked here as well as in the BFF and in storage. Not redundancy for its
    // own sake: catching it in the browser means the user gets a sentence
    // instead of a failed round-trip, and a 5MB photo is never uploaded at all.
    if (!ACCEPT.split(',').includes(file.type)) {
      setMsg(a.photoWrongType); return;
    }
    if (file.size > MAX_BYTES) {
      setMsg(a.photoTooBig); return;
    }

    setBusy(true); setMsg('');
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      // ONE request, to our own origin. The previous version asked for a
      // presigned URL and PUT the file straight to R2 from the browser — which
      // needs a CORS policy on the bucket that does not exist, so every upload
      // died as an opaque "Network error" before a byte left the phone. The
      // server does the presign and the PUT now; see the route for the full note.
      const res = await fetch('/api/bff/connection/avatar/upload', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) {
        setMsg(out?.message ?? a.uploadFailed);
        setPreview(null); return;
      }

      setVersion(v => v + 1);
      onChange(true);
      setMsg(a.photoUpdated);
    } catch {
      setMsg(a.networkError);
      setPreview(null);
    } finally {
      setBusy(false);
      // Let the same file be chosen again after a failure.
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/bff/connection/avatar', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { setMsg(a.uploadFailed); return; }
      setPreview(null);
      setVersion(v => v + 1);
      onChange(false);
      setMsg(a.photoRemoved);
    } catch { setMsg(a.networkError); }
    finally { setBusy(false); }
  };

  const shown = preview ?? src;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <button
        type="button" onClick={pick} disabled={busy}
        aria-label={hasPhoto ? a.change : a.addPhoto}
        style={{
          width: 62, height: 62, borderRadius: 999, flexShrink: 0, padding: 0,
          overflow: 'hidden', position: 'relative', cursor: busy ? 'wait' : 'pointer',
          background: TEC_COLORS.surface2,
          border: `1px dashed ${TEC_COLORS.gold}66`,
          color: TEC_COLORS.gold, fontSize: 20, fontWeight: 900,
          display: 'grid', placeItems: 'center',
        }}>
        {/* A local object URL during upload, a same-origin dynamic route after —
            next/image handles neither without configuration it does not need. */}
        {shown
          ? <img src={shown} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span aria-hidden="true">＋</span>}
      </button>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 750, color: TEC_COLORS.text }}>
          {hasPhoto ? a.photoTitle : a.addPhoto}
        </div>
        <div style={{ fontSize: 11.5, color: TEC_COLORS.subtext, marginTop: 2, lineHeight: 1.45 }}>
          {a.photoHint}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button type="button" onClick={pick} disabled={busy}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEC_COLORS.gold }}>
            {busy ? a.working : hasPhoto ? a.change : a.choosePhoto}
          </button>
          {hasPhoto && !busy && (
            <button type="button" onClick={remove}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEC_COLORS.subtext }}>
              {a.remove}
            </button>
          )}
        </div>
        {msg && (
          <div style={{ fontSize: 11.5, marginTop: 6, color: msg.startsWith('✅') ? TEC_COLORS.gold : TEC_COLORS.error }}>
            {msg}
          </div>
        )}
      </div>

      <input
        ref={fileRef} type="file" accept={ACCEPT} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
    </div>
  );
}
