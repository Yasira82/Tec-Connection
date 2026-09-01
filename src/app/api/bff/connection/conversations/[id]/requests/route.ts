import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET → the people waiting on a decision for this group. Owner only, enforced
// in the service — a check here would be a second copy of a rule this route
// does not own (P5), and the weaker of the two.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'GET', `/api/identity/connection/conversations/${encodeURIComponent(id)}/requests`);
}
