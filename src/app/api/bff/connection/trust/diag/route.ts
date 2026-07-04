import { NextRequest } from 'next/server';
import { forwardConnection } from '@/lib/bff/connectionGateway';

// GET /api/bff/connection/trust/diag → Trust pipeline liveness (authenticated).
// Confirms order.paid.v1 is flowing commerce→Redis→identity, even with one account.
export async function GET(req: NextRequest) {
  return forwardConnection(req, 'GET', '/api/identity/connection/trust/diag');
}
