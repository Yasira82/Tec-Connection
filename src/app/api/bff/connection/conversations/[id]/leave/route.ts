import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';
import { purgeObjects, takeMediaKeys } from '@/lib/connection/purge';

// POST /api/bff/connection/conversations/<id>/leave → leave a group.
//
// When the LAST member leaves, the group is deleted and its messages cascade —
// but the photos and voice notes those messages pointed at live in storage, and
// cascade does not reach them. The service reports the keys it freed; this is
// the half that acts on them.
//
// It was missing: the backend was collecting the keys and this route forwarded
// them straight through, so nothing was purged AND every storage key in the
// group was handed to the browser. Both halves are needed or neither works.
//
// The purge never changes the answer — the person has left, which is what they
// asked for. A failed purge is a logged cleanup problem, not a failed leave.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, data } = await callConnection(
    req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/leave`, {},
  );

  if (status < 200 || status >= 300) return NextResponse.json(data, { status });

  const { keys, body } = takeMediaKeys(data);
  if (keys.length) await purgeObjects(keys);

  return NextResponse.json(body, { status });
}
