import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET  /api/bff/connection/following → the usernames the caller follows (C-107; session-scoped).
// POST /api/bff/connection/following → follow a Pi username.
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/following');
}

const FollowSchema = z.object({
  username: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const parsed = FollowSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/follow', parsed.data);
}
