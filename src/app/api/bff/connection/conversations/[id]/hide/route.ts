import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/<id>/hide — remove a conversation from
// MY list.
//
// `{ permanent: true }` also clears the transcript, so the history does not come
// back with it. Without that flag a hidden conversation returns, in full, with
// the next message — which is not what "delete" means to anyone.
//
// Neither form can stop a NEW message arriving; only a block does that.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  // Only the flag is forwarded, and only as a real boolean — the body of this
  // request carries nothing else the service should read.
  const permanent = (body as { permanent?: unknown })?.permanent === true;
  return forwardConnection(
    req, 'POST',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/hide`,
    { permanent },
  );
}
