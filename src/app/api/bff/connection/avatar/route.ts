import { NextRequest, NextResponse } from 'next/server';
import { resolveMyProfile, saveMyProfile } from '@/lib/connection/discovery';

// PUT    /api/bff/connection/avatar  { key }  — attach an uploaded photo
// DELETE /api/bff/connection/avatar           — remove it
//
// Step 3 of the upload (after minting a presigned URL and PUTting the file).
//
// ── Why this reads before it writes ──────────────────────────────────────────
// The backend's PUT /identity/connection/profile/me is a FULL REPLACE, not a
// patch: it defaults headline to '', category to 'builder' and published to
// false. Sending `{ avatar_key }` alone would therefore erase the person's
// headline and silently unlist them from the directory — a data-loss bug with
// no error message, triggered by setting a photo.
//
// So the current profile is read and resent alongside the new key. The window
// for a concurrent edit is a few hundred milliseconds on the caller's OWN
// profile, which is an acceptable trade against adding another backend endpoint;
// if profile editing ever becomes concurrent, this wants a real PATCH instead.
//
// Identity is the session throughout (P6) — the username is resolved from the
// Bearer token by the backend, never sent from here. CSRF is middleware-only
// (C-12 §11) and must not be re-checked in this handler.

function token(req: NextRequest): string | null {
  return req.cookies.get('tec_access_token')?.value ?? null;
}

async function setAvatarKey(tok: string, key: string | null) {
  const current = await resolveMyProfile(tok);
  if (!current) return null;
  return saveMyProfile(tok, {
    headline:   current.headline,
    category:   current.category,
    published:  current.published,
    avatar_key: key,
  });
}

export async function PUT(req: NextRequest) {
  const tok = token(req);
  if (!tok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key  = typeof body?.key === 'string' ? body.key.trim() : '';
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  // The key is NOT validated here beyond being present. It is validated where it
  // can actually be trusted: identity-service checks that the owner segment of
  // the key matches the JWT subject that storage minted it for. A check in the
  // BFF would be a duplicate of a rule it does not own (P5).
  const profile = await setAvatarKey(tok, key);
  if (!profile) return NextResponse.json({ error: 'Could not save your photo.' }, { status: 502 });
  return NextResponse.json({ profile, ok: true });
}

export async function DELETE(req: NextRequest) {
  const tok = token(req);
  if (!tok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await setAvatarKey(tok, null);
  if (!profile) return NextResponse.json({ error: 'Could not remove your photo.' }, { status: 502 });
  return NextResponse.json({ profile, ok: true });
}
