'use client';

import { useEffect }               from 'react';
import { useRouter }               from 'next/navigation';
import { usePiAuth, ssoRedirect }  from '@yasser172/tec-auth';
import { TEC_COLORS }              from '@yasser172/tec-ui';

const HUB_URL   = process.env.NEXT_PUBLIC_HUB_URL   ?? 'https://hub.tecosystem.app';
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL   ?? 'https://connection.tecosystem.app';
const APP_NAME  = process.env.NEXT_PUBLIC_APP_NAME  ?? 'TEC Connection';
const APP_EMOJI = process.env.NEXT_PUBLIC_APP_EMOJI ?? '🔗';

export default function HomePage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/app');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => {
    ssoRedirect(HUB_URL, `${APP_URL}/app`);
  };

  return (
    <div style={{
      minHeight:      '100vh',
      background:     TEC_COLORS.bg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        24,
      fontFamily:     'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{APP_EMOJI}</div>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>
          TEC · Your network
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: TEC_COLORS.gold, margin: '6px 0 12px' }}>
          {APP_NAME}
        </div>
        <p style={{ fontSize: 14, color: TEC_COLORS.subtext, lineHeight: 1.6, marginBottom: 32 }}>
          Your economic relationship graph on Pi. Follow people and businesses,
          build trust from real activity, and collaborate across the ecosystem —
          your connections are yours.
        </p>
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            padding:      '14px 32px',
            background:   `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            border:       'none',
            borderRadius: 16,
            color:        '#0a0800',
            fontSize:     15,
            fontWeight:   800,
            cursor:       isLoading ? 'not-allowed' : 'pointer',
            opacity:      isLoading ? 0.6 : 1,
          }}>
          {isLoading ? '…' : 'Continue with Pi'}
        </button>
      </div>
    </div>
  );
}
