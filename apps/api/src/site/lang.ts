export type SiteLang = 'en' | 'es';

/** English pages keep their original URLs (the store listings link to them); Spanish is /es/... */
export const pagePath = (lang: SiteLang, path: string) => (lang === 'es' ? `/es${path}` : path);
