import { loadEnvConfig } from '@next/env';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // DB tests share one database, so test files run one at a time.
    fileParallelism: false,
  },
});
