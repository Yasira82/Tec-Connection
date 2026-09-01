import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET  /api/bff/connection/stories  → the statuses this session may see
// POST /api/bff/connection/stories  → post a text-only status
//
// The audience is never asked for and never sent: identity-service derives it
// from the follow graph. A status WITH a photo goes through ./upload, which has
// to hold the bytes.
const Schema = z.object({ caption: z.string().trim().min(1).max(300) });

export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/stories');
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/stories', parsed.data);
}
