import { NextRequest, NextResponse } from 'next/server';

// Server-only proxy to tec-identity-service (Connection store) through the API
// Gateway.
//   gateway: ${GW}/api/identity/connection/* → identity-service /identity/connection/*
//   auth:    the user's Bearer token (cookie) + x-internal-key. The follower is
//            the session — resolved server-side by the service from the token,
//            never a body/query param (C-107 / P6). Fail closed: no session → 401.
const GW = process.env.API_GATEWAY_URL ?? '';

const getUserId = (req: NextRequest): string => {
  try {
    const u = JSON.parse(decodeURIComponent(req.cookies.get('tec_user')?.value ?? ''));
    return u?.id ?? u?.sub ?? u?.piId ?? '';
  } catch { return ''; }
};

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Call the gateway and hand back the parsed body, WITHOUT turning it into the
 * response yet.
 *
 * Most routes want the passthrough below. A few must read the answer before the
 * browser does — a delete now returns the storage key it freed, and that key is
 * for this server to purge, not for a client to receive. Splitting the call from
 * the response is what makes "read it, act on it, then strip it" possible at all.
 */
export async function callConnection(
  req: NextRequest,
  method: Method,
  gatewayPath: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  if (!GW) return { status: 503, data: { error: 'Service unavailable' } };

  const token  = req.cookies.get('tec_access_token')?.value ?? '';
  const userId = getUserId(req);
  if (!token || !userId) return { status: 401, data: { error: 'Unauthorized' } };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-request-id': crypto.randomUUID(),
    'x-user-id':    userId,
  };
  if (process.env.INTERNAL_SECRET) headers['x-internal-key'] = process.env.INTERNAL_SECRET;

  const init: RequestInit = { method, headers, cache: 'no-store' };
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${GW}${gatewayPath}`, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[bff/connection] gateway error:', res.status, method, gatewayPath);
    return { status: res.status, data: (data ?? {}) as Record<string, unknown> };
  } catch (err) {
    console.error('[bff/connection] network error:', (err as Error).message, gatewayPath);
    return { status: 503, data: { error: 'Service unavailable' } };
  }
}

/** Forward an authenticated Connection request to the gateway, passing the response through. */
export async function forwardConnection(
  req: NextRequest,
  method: Method,
  gatewayPath: string,
  body?: unknown,
): Promise<NextResponse> {
  const { status, data } = await callConnection(req, method, gatewayPath, body);
  return NextResponse.json(data, { status });
}
