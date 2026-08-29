// Language switch for the public surfaces.
//
// Plain links to /api/locale, not a client dropdown. Three reasons, and the
// second is the one that decides it:
//   · it works with JavaScript disabled and in any in-app browser;
//   · the choice must reach the SERVER, because these pages are server-rendered
//     — a client-only switch could not re-render them in the new language;
//   · a visitor who cannot read the page also cannot be expected to find and
//     operate a JS menu, so the options are all visible at once.
//
// Each option is written in its OWN language. Someone looking for their language
// is scanning for a word they recognise, not for a translation of it.
import Link from 'next/link';
import { LOCALES, type Locale } from '@/lib/i18n/locales';

export function LanguagePicker({ current, next }: { current: Locale; next: string }) {
  return (
    <nav aria-label="Language" style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {LOCALES.map(l => (
        <Link
          key={l.code}
          href={`/api/locale?lang=${l.code}&next=${encodeURIComponent(next)}`}
          hrefLang={l.code}
          aria-current={l.code === current ? 'true' : undefined}
          className="pub-lang"
          data-active={String(l.code === current)}>
          {l.native}
        </Link>
      ))}
    </nav>
  );
}
