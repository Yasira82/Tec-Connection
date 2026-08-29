import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/group → create a group thread.
// The creator is the owner; the service adds them as the first member.
const Schema = z.object({
  title:   z.string().min(1).max(120),
  members: z.array(z.string().min(1).max(100)).max(50).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/conversations/group', parsed.data);
}
