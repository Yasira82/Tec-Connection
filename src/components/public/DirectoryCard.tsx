// One person in the PUBLIC directory (C-107). Presentational only — no hooks, no
// fetch — so it renders in a server component (the public pages) and inside a
// client tree (the landing) without duplicating the markup.
//
// The badge treatment is a constitutional requirement, not a style choice:
// ✅ Verified is evidence PRESENTED from Zone / KYC and is never minted here,
// while Featured is a Connection Pro placement worth REACH and nothing else. So
// they are given different shapes and different colour families — green evidence
// vs a neutral grey label — because two weights of the same gold would let a paid
// placement read as verification. Trust is earned, never bought.
import Link from 'next/link';
import { Avatar } from './Avatar';

export interface DirectoryCardProfile {
  username:  string;
  headline:  string;
  category:  string;
  verified:  boolean;
  featured:  boolean;
  followers: number;
}

export function DirectoryCard({ profile, delay = 0 }: { profile: DirectoryCardProfile; delay?: number }) {
  return (
    <Link
      href={`/u/${encodeURIComponent(profile.username)}`}
      className="pub-card pub-in"
      style={{ animationDelay: `${delay}ms` }}>

      <Avatar username={profile.username} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            @{profile.username}
          </span>
          {profile.verified && (
            <span className="pub-badge-verified" title="Verified — presented from Zone / KYC, never minted by Connection">
              ✓ Verified
            </span>
          )}
        </div>

        {profile.headline && (
          <div style={{
            fontSize: 13.5, color: 'rgba(255,255,255,0.60)', marginTop: 3, lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{profile.headline}</div>
        )}

        {/* Featured sits on the META line, not beside the handle. Two reasons, and
            the second is the one that matters: on a 390px screen a second badge
            next to the name wrapped and made that one card taller than the rest —
            and Featured is a paid PLACEMENT, not something the person is, so it
            does not belong in the same row as their identity and their evidence.
            `capitalize` is scoped to the category alone; on the whole line it also
            title-cased the count — "Builder · 184 Followers". */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,0.38)', marginTop: 5 }}>
          <span>
            <span style={{ textTransform: 'capitalize' }}>{profile.category}</span>
            {' · '}{profile.followers} follower{profile.followers === 1 ? '' : 's'}
          </span>
          {profile.featured && (
            <span className="pub-badge-featured" style={{ fontSize: 9.5, padding: '1px 6px' }}
              title="Featured — a Connection Pro placement. Reach only; not verification.">
              Featured
            </span>
          )}
        </div>
      </div>

      <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 18, flexShrink: 0 }}>›</span>
    </Link>
  );
}
