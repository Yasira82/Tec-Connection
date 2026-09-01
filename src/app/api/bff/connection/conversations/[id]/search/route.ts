import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// GET ?q= → find a message inside THIS conversation.
//
// The query is arbitrary text a person typed and it travels through a URL, so
// it is encoded rather than interpolated raw. Everything else — what the caller
// may see, and what the search must never surface — is the service's rule; this
// route forwards and gets out of the way.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const { status, data } = await callConnection(
    req, 'GET',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`,
  );
  return NextResponse.json(data, { status });
}
