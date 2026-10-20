/* eslint-disable import/no-named-as-default-member -- i18next's default export is the instance we configure */
// Plural rules ("1 plant / 2 plants") need Intl.PluralRules; this adds it only where missing.
import 'intl-pluralrules';

import type { AppLanguage } from '@plantpal/shared';
import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { create } from 'zustand';

import en from './en.json';
import es from './es.json';

export type LanguagePreference = 'system' | AppLanguage;

/**
 * The choice is a device setting, not an account one: it's stored in its own key-value file
 * (not the app database, which sign-out wipes), so the sign-in screen can already use it.
 */
const PREFERENCE_KEY = 'languagePreference';

/** The phone's language, reduced to the ones we have. Anything but Spanish gets English. */
export const systemLanguage = (): AppLanguage =>
  getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';

function readPreference(): LanguagePreference {
  try {
    const value = Storage.getItemSync(PREFERENCE_KEY);
    return value === 'en' || value === 'es' ? value : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (p: LanguagePreference): AppLanguage => (p === 'system' ? systemLanguage() : p);

const usePreferenceStore = create<{ preference: LanguagePreference }>(() => ({
  preference: readPreference(),
}));

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: resolve(usePreferenceStore.getState().preference),
  fallbackLng: 'en',
  // Synchronous: the resources are bundled, so the first frame is already translated.
  initAsync: false,
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
});

/** Switches immediately (every `useT` screen re-renders) and remembers the choice. */
export function setLanguagePreference(preference: LanguagePreference) {
  try {
    Storage.setItemSync(PREFERENCE_KEY, preference);
  } catch {
    // Not remembered, but still applied for this session.
  }
  usePreferenceStore.setState({ preference });
  i18n.changeLanguage(resolve(preference));
}

export const useLanguagePreference = () => usePreferenceStore((s) => s.preference);

/** The language the app is showing right now. */
export const currentLanguage = (): AppLanguage => (i18n.language === 'es' ? 'es' : 'en');

/** For Intl dates and numbers: neutral Latin American Spanish. */
export const currentLocale = () => (currentLanguage() === 'es' ? 'es-419' : 'en-US');

/** Calls `listener` whenever the app's language changes (push registration, local reminders). */
export function onLanguageChange(listener: (language: AppLanguage) => void) {
  const handler = (lng: string) => listener(lng === 'es' ? 'es' : 'en');
  i18n.on('languageChanged', handler);
  return () => i18n.off('languageChanged', handler);
}

// Android lets people change the phone's language without restarting apps.
AppState.addEventListener('change', (state) => {
  if (state !== 'active' || usePreferenceStore.getState().preference !== 'system') return;
  const language = systemLanguage();
  if (language !== i18n.language) i18n.changeLanguage(language);
});

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (value: string | number | Date) =>
  new Date(value).toLocaleDateString(currentLocale(), { dateStyle: 'medium' });

/** For code outside components (alerts, notifications, error messages). */
export const t = i18n.t.bind(i18n);
/** For components: re-renders when the language changes. */
export const useT = () => useTranslation().t;

export default i18n;
