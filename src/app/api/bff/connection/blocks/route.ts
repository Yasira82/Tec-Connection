import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// The block list (C-107 "right to disconnect / block"). With no automated content
// moderation, this is the one lever a person has to end contact, so it is a real
// endpoint rather than a settings flag.
//
//   GET    → who the caller has blocked
//   POST   → block a username
//   DELETE → unblock (service route is POST /blocks/remove)
const Schema = z.object({ username: z.string().min(1).max(100) });

export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/blocks');
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/blocks', parsed.data);
}

export async function DELETE(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/blocks/remove', parsed.data);
}
