import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// GET  → the group's current invite code. Owner only (service-enforced).
// PUT { enabled } → mint a FRESH code, or revoke the link.
//
// The code is a credential: it lets anyone holding it into the group without
// the owner's approval. It is therefore only ever fetched on demand by the
// owner, and never rides along in the conversation payload every member polls.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, data } = await callConnection(
    req, 'GET',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/invite`,
  );
  return NextResponse.json(data, { status });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/invite`,
    { enabled: body?.enabled },
  );
  return NextResponse.json(data, { status });
}
