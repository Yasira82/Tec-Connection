import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST { approve: boolean } → decide one request. Owner only (service-enforced).
//
// `approve` is forwarded as given and is required upstream: a missing flag must
// not silently admit someone to a group.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; username: string }> }) {
  const { id, username } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return forwardConnection(
    req, 'POST',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/requests/${encodeURIComponent(username)}`,
    { approve: body?.approve === true },
  );
}
