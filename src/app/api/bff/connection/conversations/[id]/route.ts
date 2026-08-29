import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/conversations/<id>?after=<iso> → one thread's messages.
//
// `after` is passed through so an open thread polls for only what it has not seen.
// The id is NOT an authorisation: the service answers 404 for a thread the caller
// does not belong to, so guessing an id reveals nothing (P6).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const after = req.nextUrl.searchParams.get('after');
  const qs = after ? `?after=${encodeURIComponent(after)}` : '';
  return forwardConnection(req, 'GET', `/api/identity/connection/conversations/${encodeURIComponent(id)}${qs}`);
}
