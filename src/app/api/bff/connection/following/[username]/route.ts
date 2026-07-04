import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// DELETE /api/bff/connection/following/:username → unfollow (session-scoped; C-107).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  return forwardConnection(
    req, 'DELETE',
    `/api/identity/connection/follow/${encodeURIComponent(username)}`,
  );
}
