// One person in the PUBLIC directory (C-107). Presentational only — no hooks, no
// fetch — so it renders in a server component (the public pages) and inside a
// client tree (the landing) without duplicating the markup.
//
// Ranking rule made visible: ✅ Verified is PRESENTED from Zone/KYC and is never
// minted here; ⭐ Featured is Connection Pro and is REACH ONLY. Featured must never
// look like verification — trust is earned, never bought (C-107).
import Link from 'next/link';
import { TEC_COLORS } from '@yasser172/tec-ui';

export interface DirectoryCardProfile {
  username:  string;
  headline:  string;
  category:  string;
  verified:  boolean;
  featured:  boolean;
  followers: number;
}

export function DirectoryCard({ profile }: { profile: DirectoryCardProfile }) {
  return (
    <Link
      href={`/u/${encodeURIComponent(profile.username)}`}
      style={{
        display: 'flex', gap: 14, alignItems: 'center', textDecoration: 'none',
        background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}22`,
        borderRadius: 16, padding: '16px 18px',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: TEC_COLORS.bg, border: `1px solid ${TEC_COLORS.gold}55`,
        color: TEC_COLORS.gold, fontSize: 18, fontWeight: 900,
      }}>{profile.username.charAt(0).toUpperCase()}</div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: TEC_COLORS.text }}>@{profile.username}</span>
          {profile.verified && (
            <span title="Verified — presented from Zone / KYC"
              style={{ fontSize: 10, fontWeight: 800, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '1px 7px' }}>
              ✅ Verified
            </span>
          )}
          {profile.featured && <span title="Featured — Connection Pro placement (reach only)" style={{ fontSize: 12, color: TEC_COLORS.gold }}>⭐</span>}
        </div>
        {profile.headline && (
          <div style={{
            fontSize: 13, color: TEC_COLORS.subtext, marginTop: 3, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{profile.headline}</div>
        )}
        <div style={{ fontSize: 11, color: TEC_COLORS.gold, marginTop: 4, textTransform: 'capitalize' }}>
          {profile.category} · {profile.followers} follower{profile.followers === 1 ? '' : 's'}
        </div>
      </div>
    </Link>
  );
}
