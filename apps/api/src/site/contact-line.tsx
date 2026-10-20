import { contact } from './contact';
import type { SiteLang } from './lang';

/** "email us at …" when an email is configured, otherwise the GitHub issues link. */
export function ContactLine({ lang = 'en' }: { lang?: SiteLang }) {
  if (contact.email) {
    return (
      <>
        {lang === 'es' ? 'escribe a ' : 'email '}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </>
    );
  }
  return (
    <>
      {lang === 'es' ? 'abre un issue en ' : 'open an issue at '}
      <a href={contact.issues}>{contact.issues.replace('https://', '')}</a>
    </>
  );
}
