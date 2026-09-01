import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// DELETE /api/bff/connection/conversations/<id>/messages/<messageId>
//
// Soft delete of your OWN message. The service decides whether it is yours; this
// route carries no claim about who is asking.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  return forwardConnection(
    req, 'DELETE',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
  );
}
