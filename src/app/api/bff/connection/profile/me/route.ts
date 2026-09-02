import { NextRequest, NextResponse } from 'next/server';
import { resolveMyProfile, saveMyProfile, resolveProStatus, setDirectoryFeatured } from '@/lib/connection/discovery';

// The caller's OWN Discover profile (C-107). Identity is the session — the backend
// resolves the username from the Bearer token, never a client field (P6). GET also
// reconciles FEATURED with the caller's LIVE subscription (Connection Pro = reach
// only, P5): a lapsed Pro clears featured; a new Pro lights it up. PUT saves the
// editable fields (headline/category/published) — verified/featured are never
// client-settable. CSRF is enforced in middleware only (C-12 §11) — never here.

function token(req: NextRequest): string | null {
  return req.cookies.get('tec_access_token')?.value ?? null;
}

export async function GET(req: NextRequest) {
  const tok = token(req);
  if (!tok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await resolveMyProfile(tok);
  if (!profile) return NextResponse.json({ profile: null, isPro: false }, { status: 200 });

  // Reconcile featured with live Pro when it has drifted (best-effort; never blocks).
  const isPro = await resolveProStatus(tok);
  if (Boolean(profile.featured) !== isPro && profile.published) {
    await setDirectoryFeatured(tok, isPro);
    profile.featured = isPro;
  }
  return NextResponse.json({ profile, isPro }, { headers: { 'Cache-Control': 'private, max-age=15' } });
}

export async function PUT(req: NextRequest) {
  const tok = token(req);
  if (!tok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    headline?: unknown; category?: unknown; published?: unknown; show_followers?: unknown;
  };
  const input = {
    headline:  typeof body.headline === 'string' ? body.headline : undefined,
    category:  typeof body.category === 'string' ? body.category : undefined,
    published: body.published === true,
    // Forwarded ONLY when it is actually a boolean. Absent means "leave it
    // alone" upstream, and coercing a missing field here would turn a headline
    // edit into a silent privacy change (C-107 §14.5).
    ...(typeof body.show_followers === 'boolean' && { show_followers: body.show_followers }),
  };
  const profile = await saveMyProfile(tok, input);
  if (!profile) return NextResponse.json({ error: 'Could not save your profile.' }, { status: 502 });

  // Keep featured aligned right after publishing (Pro syncs; non-Pro stays off).
  if (profile.published) {
    const isPro = await resolveProStatus(tok);
    if (Boolean(profile.featured) !== isPro) {
      await setDirectoryFeatured(tok, isPro);
      profile.featured = isPro;
    }
  }
  return NextResponse.json({ profile, ok: true });
}
