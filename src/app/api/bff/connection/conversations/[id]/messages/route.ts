import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/<id>/messages → send.
// The sender is the session, never the body. The 2000-char cap matches the
// service's own limit, so an oversized message is refused before a round trip.
//
// `reply_to` is NAMED here because zod drops every key a schema does not name:
// until it was, every reply reached the service as a plain message with its
// quote thrown away (reported from a phone, 2026-09-28). Whether the target is
// in this conversation is the service's check, not this route's.
const Schema = z.object({
  body:     z.string().min(1).max(2000),
  reply_to: z.string().min(1).max(64).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages`, parsed.data);
}
