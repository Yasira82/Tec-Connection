import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// Bearer from the Authorization header OR the HttpOnly `tec_access_token`
// cookie. The cookie is the reliable source in-browser (HttpOnly → client JS
// can't read it into a header); without this fallback the calls silently 401.
const resolveBearer = (req: NextRequest): string | null => {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header;
  const cookie = req.cookies.get('tec_access_token')?.value;
  return cookie ? `Bearer ${cookie}` : null;
};

// GET /api/referral — my referral code + stats
export async function GET(req: NextRequest) {
  const authHeader = resolveBearer(req);
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json({
      success: true,
      data: {
        referral: {
          code:  'TESTCODE',
          stats: { pending: 0, rewarded: 0, total: 0 },
          reward: { model: 'gift-subscription', bonusDays: 30, plan: 'PRO' },
        },
      },
    }, { status: 200 });
  }

  try {
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/referral/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  authHeader,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

// POST /api/referral — apply a referral code to MY account (body: { code })
export async function POST(req: NextRequest) {
  const authHeader = resolveBearer(req);
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }

  if (isE2eMode()) {
    return NextResponse.json(
      { success: true, data: { referral: { status: 'PENDING', code } } },
      { status: 200 },
    );
  }

  try {
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/referral/attribute`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  authHeader,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
