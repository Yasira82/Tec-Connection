import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// DELETE → remove someone from a group. Owner or admin; which of the two, and
// whom they may remove, is the service's rule (an admin cannot remove another
// admin, nobody removes the owner, nobody removes themselves).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; username: string }> }) {
  const { id, username } = await ctx.params;
  return forwardConnection(
    req, 'DELETE',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(username)}`,
  );
}
