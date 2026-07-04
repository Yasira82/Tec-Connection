import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/presence { usernames } → realtime /presence/sync:
// marks the caller online + returns which of those usernames are online (C-107
// §13 live layer). Server-scoped by session (fail closed).
const Schema = z.object({ usernames: z.array(z.string()).max(500).optional() });

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/realtime/presence/sync', parsed.data);
}
