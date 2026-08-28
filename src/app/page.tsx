// The landing is now a SERVER component so the public directory (C-107) is in the
// delivered HTML — visible without a session, to a link preview, and to a crawler.
// The interactive half (auth bounce + Pi sign-in) lives in <Landing>.
//
// Failure is silent by design: resolveDirectory() returns [] when the backend is
// unreachable, and <Landing> simply omits the strip. The front door must never
// depend on the directory being up, and it must never show invented people.
import { resolveDirectory } from '@/lib/connection/discovery';
import { Landing } from '@/components/landing/Landing';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const profiles = await resolveDirectory();
  return <Landing profiles={profiles.slice(0, 5)} />;
}
