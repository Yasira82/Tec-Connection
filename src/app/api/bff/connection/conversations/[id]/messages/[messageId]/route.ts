import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';
import { purgeObjects, takeMediaKeys } from '@/lib/connection/purge';

// DELETE /api/bff/connection/conversations/<id>/messages/<messageId>?scope=me|everyone
//
//   me        remove it from the caller's copy only
//   everyone  clear it for both sides, leaving a tombstone (sender only)
//
// The scope is FORWARDED, never decided here. Which messages a person may
// retract for everybody is the service's rule to enforce, and a BFF route that
// second-guessed it would be a second place for that rule to live.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  const scope = req.nextUrl.searchParams.get('scope');
  // Pass through only the two known values. Anything else goes upstream absent,
  // where it takes the safe default rather than becoming a parameter the
  // service has to reject.
  const query = scope === 'me' || scope === 'everyone' ? `?scope=${scope}` : '';
  const { status, data } = await callConnection(
    req, 'DELETE',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}${query}`,
  );

  if (status < 200 || status >= 300) return NextResponse.json(data, { status });

  // A "delete for everyone" hands back the storage key the message held, so the
  // photo goes with the words. It is purged here and stripped from the response
  // — a client has no use for a storage key and should not be given one. A
  // 'me' delete frees nothing and returns null.
  const { keys, body } = takeMediaKeys(data);
  if (keys.length) await purgeObjects(keys);

  return NextResponse.json(body, { status });
}

// PUT { body } → rewrite one of your own messages, inside the edit window.
//
// The window, the ownership and the "attachments cannot be edited" rule are all
// the service's. This route forwards; it does not pre-judge. A BFF that guessed
// the window would be a second clock, and the two would disagree the first time
// one of them moved.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  const payload = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
    { body: payload?.body },
  );
  return NextResponse.json(data, { status });
}
