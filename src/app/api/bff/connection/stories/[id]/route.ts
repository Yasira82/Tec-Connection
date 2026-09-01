import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// DELETE /api/bff/connection/stories/<id> — remove one of your own before it
// expires. The service decides whether it is yours; this route claims nothing.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardConnection(req, 'DELETE', `/api/identity/connection/stories/${encodeURIComponent(id)}`);
}
