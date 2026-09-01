import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// PUT { visibility, description? } → list or un-list a group. Owner only
// (service-enforced).
//
// `description` is passed through ONLY when the caller sent it. Sending
// `undefined` as `null` would wipe the description every time the toggle is
// flipped — the service distinguishes the two and this must not collapse them.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const hasDescription = typeof body?.description === 'string' || body?.description === null;
  return forwardConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/visibility`,
    {
      visibility: body?.visibility,
      ...(hasDescription && { description: body.description }),
    },
  );
}
