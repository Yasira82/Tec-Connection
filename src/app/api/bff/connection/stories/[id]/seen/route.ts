import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/stories/<id>/seen — mark it viewed. Idempotent
// upstream, so a re-render cannot inflate the author's count.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'POST', `/api/identity/connection/stories/${encodeURIComponent(id)}/seen`, {});
}
