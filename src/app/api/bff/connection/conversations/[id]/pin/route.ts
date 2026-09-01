import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// PUT { messageId } → pin a message. `messageId: null` takes the pin down.
//
// Null is forwarded as null rather than dropped. The service distinguishes "no
// field" (a malformed request) from "explicitly nothing" (un-pin), and
// collapsing them here would turn a bad request into a silent un-pin.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/pin`,
    { messageId: body?.messageId === null ? null : body?.messageId },
  );
  return NextResponse.json(data, { status });
}
