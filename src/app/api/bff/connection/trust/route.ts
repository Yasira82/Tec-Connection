import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/trust → the caller's Trust Graph (C-107, session-scoped):
// given (sellers you've paid) + received (buyers who paid you). Derived, eventual.
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/trust');
}
