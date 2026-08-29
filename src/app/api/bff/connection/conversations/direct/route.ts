import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/conversations/direct → open (or reuse) the thread with
// one person. The service resolves the pair to a single canonical conversation,
// so calling this twice is not a way to create a second thread.
const Schema = z.object({ username: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/conversations/direct', parsed.data);
}
