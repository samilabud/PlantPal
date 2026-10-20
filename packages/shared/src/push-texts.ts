import type { AppLanguage } from './identify';

/**
 * Texts of the server's daily "overdue" push, per language. They live here (not in the app's
 * JSON) because the server sends them; the app's own local reminders use its translation files.
 * A Record over AppLanguage, so a missing language is a compile error.
 */
export const OVERDUE_PUSH: Record<
  AppLanguage,
  {
    oneTitle: (name: string) => string;
    oneBody: string;
    manyTitle: (count: number) => string;
    andMore: (count: number) => string;
  }
> = {
  en: {
    oneTitle: (name) => `🪴 ${name} needs water`,
    oneBody: "It's past its watering day. Tap to open it.",
    manyTitle: (count) => `🪴 ${count} plants need water`,
    andMore: (count) => ` and ${count} more`,
  },
  es: {
    oneTitle: (name) => `🪴 ${name} necesita agua`,
    oneBody: 'Ya pasó su día de riego. Toca para abrirla.',
    manyTitle: (count) => `🪴 ${count} plantas necesitan agua`,
    andMore: (count) => ` y ${count} más`,
  },
};
