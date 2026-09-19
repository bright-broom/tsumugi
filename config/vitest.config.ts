import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Ops CLI tests start several real `node --import tsx` processes per test. On slower build
    // machines (the Vercel build runs `npm run validate`) that exceeds the 5 s default, so allow
    // 30 s; a hung test still fails, and no assertion is relaxed.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
