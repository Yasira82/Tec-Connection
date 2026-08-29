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
      setMsg('Use a JPEG, PNG or WebP image.'); return;
    }
    if (file.size > MAX_BYTES) {
      setMsg('That image is over 2MB. Try a smaller one.'); return;
    }

    setBusy(true); setMsg('');
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const signRes = await fetch('/api/bff/connection/avatar/upload-url', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type, size: file.size }),
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !sign?.uploadUrl || !sign?.key) {
        setMsg(sign?.message ?? 'Could not start the upload. Please retry.');
        setPreview(null); return;
      }

      // Straight to R2. `Content-Type` must match what the URL was signed for or
      // the signature is rejected.
      const put = await fetch(sign.uploadUrl, {
        method: 'PUT', body: file, headers: { 'Content-Type': file.type },
      });
      if (!put.ok) { setMsg('The upload did not complete. Please retry.'); setPreview(null); return; }

      const saveRes = await fetch('/api/bff/connection/avatar', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: sign.key }),
      });
      if (!saveRes.ok) { setMsg('Uploaded, but could not attach it. Please retry.'); setPreview(null); return; }

      setVersion(v => v + 1);
      onChange(true);
      setMsg('✅ Photo updated.');
    } catch {
      setMsg('Network error. Please retry.');
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
      if (!res.ok) { setMsg('Could not remove the photo. Please retry.'); return; }
      setPreview(null);
      setVersion(v => v + 1);
      onChange(false);
      setMsg('Photo removed.');
    } catch { setMsg('Network error. Please retry.'); }
    finally { setBusy(false); }
  };

  const shown = preview ?? src;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <button
        type="button" onClick={pick} disabled={busy}
        aria-label={hasPhoto ? 'Change your profile photo' : 'Add a profile photo'}
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
          {hasPhoto ? 'Profile photo' : 'Add a profile photo'}
        </div>
        <div style={{ fontSize: 11.5, color: TEC_COLORS.subtext, marginTop: 2, lineHeight: 1.45 }}>
          JPEG, PNG or WebP · up to 2MB. Shown publicly on your profile.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button type="button" onClick={pick} disabled={busy}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEC_COLORS.gold }}>
            {busy ? 'Working…' : hasPhoto ? 'Change' : 'Choose a photo'}
          </button>
          {hasPhoto && !busy && (
            <button type="button" onClick={remove}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: TEC_COLORS.subtext }}>
              Remove
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
