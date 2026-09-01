import { NextRequest, NextResponse } from 'next/server';
import { callConnection } from '@/lib/bff/connectionGateway';

// POST { code } → join a group by its link, with no approval step.
//
// A wrong code comes back as 404, exactly like a code that was withdrawn. The
// service refuses to distinguish them, and this route must not add a message
// that does — telling the two apart is what turns this into a way to test codes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, data } = await callConnection(
    req, 'POST',
    '/api/identity/connection/conversations/join-by-invite',
    { code: body?.code },
  );
  return NextResponse.json(data, { status });
}
