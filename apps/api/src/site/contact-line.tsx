import { contact } from './contact';

/** "email us at …" when an email is configured, otherwise the GitHub issues link. */
export function ContactLine() {
  if (contact.email) {
    return (
      <>
        email <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </>
    );
  }
  return (
    <>
      open an issue at <a href={contact.issues}>{contact.issues.replace('https://', '')}</a>
    </>
  );
}
