// The sitemap is generated from the live opt-in directory, so a person appears in
// it for exactly as long as they choose to be published (C-107 sovereignty) — no
// separate list to fall out of sync with the one the app actually serves.
//
// An unreachable backend yields the static pages alone rather than an error: a
// sitemap that 500s is worse than a short one.
import type { MetadataRoute } from 'next';
import { resolveDirectory } from '@/lib/connection/discovery';

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://connection.tecosystem.app';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`,         lastModified: now, changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE}/discover`, lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/privacy`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE}/terms`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];

  const profiles = await resolveDirectory().catch(() => []);

  return [
    ...staticPages,
    ...profiles.map(p => ({
      url:             `${SITE}/u/${encodeURIComponent(p.username)}`,
      lastModified:    now,
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    })),
  ];
}
