import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // CSS is compiled by a child process; pricing CLIs are discovered from package.json.
  entry: ['src/pages/**/*.{ts,tsx}!', 'src/styles/globals.css!', 'src/styles/og.css!'],
  // services/ is not a Next.js entry; it is exercised by tests and deployed separately (ADR 0032).
  project: [
    'src/**/*.{ts,tsx,css}',
    'tools/**/*.ts',
    'services/**/*.ts',
    'tests/**/*.{ts,tsx}',
    'config/*.ts',
  ],
  eslint: { config: ['config/eslint.config.ts'] },
  vitest: { config: ['config/vitest.config.ts'] },
};

export default config;
