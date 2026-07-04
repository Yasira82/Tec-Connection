import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET  /api/bff/connection/notifications      → the caller's own notifications + unread count
// POST /api/bff/connection/notifications      → mark read (all, or { id }) — C-107, session-scoped
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/notifications');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forwardConnection(req, 'POST', '/api/identity/connection/notifications/read', body);
}
