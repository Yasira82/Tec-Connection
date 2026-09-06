import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// PUT { silenced: boolean } → stop someone posting in a group, or lift it.
// Owner or admin; the service decides which, and refuses the owner as a target.
//
// The rule is not copied here. This route cannot see who owns the group without
// asking anyway, so a check here would be the weaker of two copies — and the
// weaker copy is the one that ends up disagreeing.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; username: string }> }) {
  const { id, username } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return forwardConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(username)}/silenced`,
    { silenced: body?.silenced === true },
  );
}
