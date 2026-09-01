import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// PUT { posting: 'EVERYONE' | 'ADMINS' } → make a group announcement-only, or
// open it again. Owner only (service-enforced).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'PUT',
    `/api/identity/connection/conversations/${encodeURIComponent(id)}/posting`,
    { posting: body?.posting },
  );
  return NextResponse.json(data, { status });
}
