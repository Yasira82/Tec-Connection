import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET  /api/bff/connection/collections → collections the caller owns or belongs to
// POST /api/bff/connection/collections → create one ({ title })
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/collections');
}

const CreateSchema = z.object({ title: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  return forwardConnection(req, 'POST', '/api/identity/connection/collections', parsed.data);
}
