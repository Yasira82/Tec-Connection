import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

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
  return forwardConnection(
    req, 'DELETE',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}${query}`,
  );
}
