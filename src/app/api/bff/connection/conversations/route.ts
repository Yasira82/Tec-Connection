import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/conversations → the caller's threads (C-107; session-scoped).
// Membership is resolved server-side from the session token — this route passes
// no identity of its own, so it cannot widen what the caller may see (P6).
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/conversations');
}
