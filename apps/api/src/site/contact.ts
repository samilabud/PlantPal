/**
 * Where people reach the developer. The email lives in the CONTACT_EMAIL environment variable
 * (Vercel dashboard), not in the repository; without it the pages point to GitHub issues.
 */
export const contact = {
  email: process.env.CONTACT_EMAIL || null,
  issues: 'https://github.com/samilabud/PlantPal/issues',
};

/** Date of the current privacy policy, as shown on each language's page. */
export const POLICY_DATE = { en: 'October 20, 2026', es: '20 de octubre de 2026' };
