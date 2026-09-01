import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// PUT { muted: boolean } → mute or unmute this conversation, for the CALLER
// alone. Any member may mute; there is nothing privileged about not wanting to
// be interrupted.
//
// The boolean is forwarded as-is rather than defaulted. The service rejects a
// missing one, and that refusal is the correct answer: a mute toggle that
// silently picks a side when the request is malformed is a toggle that can
// un-mute someone who asked for the opposite.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return forwardConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/mute`,
    { muted: body?.muted },
  );
}
