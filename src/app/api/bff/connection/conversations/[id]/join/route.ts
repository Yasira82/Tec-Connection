import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST   → ask to join this group
// DELETE → withdraw your own request
//
// The requester is the session, never a body field (P6). Whether the group is
// joinable at all — public, not full, owner not blocked — is the service's
// call; this route claims nothing about it.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/join`, {});
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'DELETE', `/api/identity/connection/conversations/${encodeURIComponent(id)}/join`);
}
