import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/stats → { following, followers } for the caller (C-107; session-scoped).
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/stats');
}
