import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/<id>/clear — empty the transcript for
// ME. The conversation stays in my list; nothing changes for anyone else.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/clear`, {});
}
