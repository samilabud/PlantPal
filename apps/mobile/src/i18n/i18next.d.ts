import 'i18next';

import type en from './en.json';

// Typed keys: `t('plants.ad')` is a compile error, so a typo can't ship as raw key text.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
    returnNull: false;
  }
}
