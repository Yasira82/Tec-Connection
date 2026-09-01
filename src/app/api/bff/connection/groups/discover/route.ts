import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/groups/discover?q=
//
// Public groups, searchable. What comes back is deliberately thin — title,
// description, member COUNT, and whether the caller is in it or has already
// asked. Never a member list, never a message: a listed group's existence is
// public, its contents are not, and that line is drawn in the service.
//
// `q` is forwarded, not interpreted. Deciding here what counts as a match would
// put half the search in one repo and half in another.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 120);
  return forwardConnection(
    req, 'GET',
    `/api/identity/connection/conversations/discover${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  );
}
