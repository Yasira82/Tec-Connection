import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';
import { purgeObjects, takeMediaKeys } from '@/lib/connection/purge';

// DELETE /api/bff/connection/stories/<id> — remove one of your own before it
// expires. The service decides whether it is yours; this route claims nothing.
//
// The service also hands back the storage key the deleted status held, so the
// photo goes with it. That key is purged HERE and stripped from the response:
// it exists for this server to act on, not for a browser to receive.
//
// The purge is awaited but its result never changes the answer — the status is
// already gone, which is what was asked for. A failed purge is a logged cleanup
// problem, not a failed delete.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, data } = await callConnection(
    req, 'DELETE', `/api/identity/connection/stories/${encodeURIComponent(id)}`,
  );

  if (status < 200 || status >= 300) return NextResponse.json(data, { status });

  const { keys, body } = takeMediaKeys(data);
  if (keys.length) await purgeObjects(keys);

  return NextResponse.json(body, { status });
}
