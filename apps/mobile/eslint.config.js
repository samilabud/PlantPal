// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
  // Guardrail: every user-facing string in screens and components comes from src/i18n, so the
  // app can't ship a sentence that exists in only one language.
  {
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['label', 'placeholder', 'title', 'accessibilityLabel', 'accessibilityHint'],
          },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Alert'][callee.property.name='alert'] > Literal",
          message: 'Alert texts must come from t() (src/i18n).',
        },
      ],
    },
  },
]);
