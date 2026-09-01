import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/<id>/hide — remove a conversation from
// MY list. Not a delete for the other person, and a new message brings it back.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/hide`, {});
}
