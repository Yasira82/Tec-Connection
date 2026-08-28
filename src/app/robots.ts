// Nothing here was crawlable before, because nothing here was public. Now that the
// landing, /discover and /u/<handle> render without a session, they are the only
// paths worth indexing — and the authenticated app plus every API route explicitly
// are not: /app is a personal graph behind a session, and an indexed BFF path is
// noise at best.
import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://connection.tecosystem.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow:     ['/', '/discover', '/u/'],
      disallow:  ['/api/', '/app', '/dashboard', '/profile', '/settings'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
