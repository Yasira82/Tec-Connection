import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/collections/:id → items + members (member-only; C-107)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardConnection(req, 'GET', `/api/identity/connection/collections/${encodeURIComponent(id)}`);
}
