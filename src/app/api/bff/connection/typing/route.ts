import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/typing { conversationId, usernames }
// → realtime /presence/typing: mark ME typing in this thread and return who else
// is. Ephemeral (Redis, 8s TTL) — the System of Engagement, never the record.
const Schema = z.object({
  conversationId: z.string().min(1).max(100),
  usernames: z.array(z.string()).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/realtime/presence/typing', parsed.data);
}
