import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// PUT { role: 'ADMIN' | 'MEMBER' } → promote or demote. OWNER only.
//
// The owner check lives in the service, not here. A copy of it in this route
// would be a second place for the rule to drift, and the weaker of the two —
// this route cannot see who owns the group without asking anyway.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; username: string }> }) {
  const { id, username } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return forwardConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(username)}/role`,
    { role: body?.role },
  );
}
