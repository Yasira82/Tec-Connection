import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// POST { to } → copy this message into another conversation.
//
// Both conversation ids travel to the service, which re-derives membership of
// each from the database. Nothing about the destination is trusted here: this
// is the one operation that deliberately moves words across a privacy boundary,
// so the boundary is checked where the data lives.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id, messageId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'POST',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/forward`,
    { to: body?.to },
  );
  return NextResponse.json(data, { status });
}
