import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// PUT { emoji, on } → react to a message, or take the reaction back.
//
// `on` is forwarded as sent, not defaulted. The whole reason the API takes an
// end state rather than a toggle is that a retry must be harmless; a route that
// filled in a missing value would reintroduce exactly the guesswork that design
// removes.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/reactions`,
    { emoji: body?.emoji, on: body?.on },
  );
  return NextResponse.json(data, { status });
}
