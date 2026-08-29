import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/<id>/leave → leave a group.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/leave`, {});
}
