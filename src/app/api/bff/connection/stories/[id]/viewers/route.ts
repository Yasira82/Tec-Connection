import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/stories/<id>/viewers — who saw one of MY statuses.
// Scoped to the author upstream: a non-author gets 404, not a list.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'GET', `/api/identity/connection/stories/${encodeURIComponent(id)}/viewers`);
}
