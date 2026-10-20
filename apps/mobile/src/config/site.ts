import { currentLanguage } from '@/i18n';

/** Public pages, the same for every build (the store listings link to them too). */
export const SITE = 'https://plantpal-api.vercel.app';
export const PRIVACY_URL = `${SITE}/privacy`;
export const SUPPORT_URL = `${SITE}/support`;

/** The same pages in the language the app is showing (Spanish lives under /es). */
const localized = (path: string) => `${SITE}${currentLanguage() === 'es' ? '/es' : ''}${path}`;
export const privacyUrl = () => localized('/privacy');
export const supportUrl = () => localized('/support');
