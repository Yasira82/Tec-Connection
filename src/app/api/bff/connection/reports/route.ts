import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// POST /api/bff/connection/reports — report a user, a message, or a status.
//
// The reporter is the session, never the body. The reasons are a fixed set,
// matching the service's own: a free-text reason makes a queue unsortable and
// lets someone write an accusation into a field nobody reviews.
//
// There is no GET here on purpose. The review queue is reachable with
// `x-internal-key` only — who reported whom is the most sensitive thing in this
// feature, and a BFF route with a session in front of it would be one edit away
// from exposing it.
const Schema = z.object({
  kind: z.enum(['user', 'message', 'story']),
  target: z.string().trim().min(1).max(200),
  reason: z.enum(['spam', 'scam', 'harassment', 'sexual', 'violence', 'other']),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  return forwardConnection(req, 'POST', '/api/identity/connection/reports', parsed.data);
}
