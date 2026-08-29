// One person in the PUBLIC directory (C-107). Presentational only — no hooks, no
// fetch — so it renders in a server component (the public pages) and inside a
// client tree (the landing) without duplicating the markup.
//
// All copy arrives as props rather than being read from a context: these cards
// appear on server-rendered pages where a client locale context does not exist,
// and the category slug (`builder`, `merchant`, …) comes from the backend and has
// to be looked up in the caller's dictionary. `labels` is required, so adding a
// language can never leave a card half-translated.
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

export interface DirectoryCardLabels {
  verified:     string;
  verifiedHint: string;
  featured:     string;
  featuredHint: string;
  follower:     string;
  followers:    string;
}

export function DirectoryCard({
  profile, labels, categoryLabel, delay = 0,
}: {
  profile: DirectoryCardProfile;
  labels: DirectoryCardLabels;
  categoryLabel?: string;
  delay?: number;
}) {
  const followerWord = profile.followers === 1 ? labels.follower : labels.followers;

  return (
    <Link
      href={`/u/${encodeURIComponent(profile.username)}`}
      className="pub-card pub-in"
      style={{ animationDelay: `${delay}ms` }}>

      <Avatar username={profile.username} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {/* <bdi>, not <span>. A Latin handle inside an Arabic paragraph is a
              bidi island: the '@' is a NEUTRAL character, so the bidi algorithm
              resolves it against the surrounding RTL run and renders
              "sara_builds@". Seen in an RTL screenshot, not in review. <bdi>
              isolates the handle so it always reads "@sara_builds", in any
              language the page is displayed in. */}
          <bdi style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            @{profile.username}
          </bdi>
          {profile.verified && (
            <span className="pub-badge-verified" title={labels.verifiedHint}>✓ {labels.verified}</span>
          )}
        </div>

        {/* `dir="auto"` because the headline is USER content: a person writes it
            in their own language, which need not match the page's. Without it an
            English headline on an Arabic page truncates from the wrong end. */}
        {profile.headline && (
          <div dir="auto" style={{
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
            <span style={{ textTransform: 'capitalize' }}>{categoryLabel ?? profile.category}</span>
            {' · '}{profile.followers} {followerWord}
          </span>
          {profile.featured && (
            <span className="pub-badge-featured" style={{ fontSize: 9.5, padding: '1px 6px' }}
              title={labels.featuredHint}>
              {labels.featured}
            </span>
          )}
        </div>
      </div>

      <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 18, flexShrink: 0 }}>›</span>
    </Link>
  );
}
