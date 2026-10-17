/**
 * Where people reach the developer. The email lives in the CONTACT_EMAIL environment variable
 * (Vercel dashboard), not in the repository; without it the pages point to GitHub issues.
 */
export const contact = {
  email: process.env.CONTACT_EMAIL || null,
  issues: 'https://github.com/samilabud/PlantPal/issues',
};

export const POLICY_DATE = 'October 17, 2026';
