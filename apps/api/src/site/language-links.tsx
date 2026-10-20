import Link from 'next/link';

import { pagePath, type SiteLang } from './lang';

/** "English | Español" at the top of each page, linking to the same page in the other language. */
export function LanguageLinks({ lang, path }: { lang: SiteLang; path: string }) {
  return (
    <p style={{ textAlign: 'right', fontSize: 14 }}>
      {lang === 'en' ? <strong>English</strong> : <Link href={pagePath('en', path)}>English</Link>}
      {' | '}
      {lang === 'es' ? <strong>Español</strong> : <Link href={pagePath('es', path)}>Español</Link>}
    </p>
  );
}
