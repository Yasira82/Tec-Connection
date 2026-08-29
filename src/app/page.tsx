// The landing is a SERVER component so two things are true in the delivered HTML:
// the public directory (C-107) is present without a session, and the page is in
// the VISITOR'S LANGUAGE — resolved from their cookie, then Accept-Language.
// Neither is possible from a client component: a server render cannot read a
// client context, which is why the front door used to be English-only.
//
// The interactive half (auth bounce + Pi sign-in) lives in <Landing>.
//
// Failure is silent by design: resolveDirectory() returns [] when the backend is
// unreachable, and <Landing> omits the strip. The front door must never depend on
// the directory being up, and it must never show invented people.
import { resolveDirectory } from '@/lib/connection/discovery';
import { getI18n } from '@/lib/i18n/server';
import { Landing } from '@/components/landing/Landing';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [profiles, { locale, t }] = await Promise.all([resolveDirectory(), getI18n()]);
  return <Landing profiles={profiles.slice(0, 5)} t={t.public} locale={locale} />;
}
