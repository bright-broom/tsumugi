import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // CSS is compiled by a child process; the pricing report is a documented standalone CLI.
  entry: [
    'src/pages/**/*.{ts,tsx}!',
    'src/styles/globals.css!',
    'src/styles/og.css!',
    'tools/pricing/report.mjs',
  ],
  project: ['src/**/*.{ts,tsx,css}', 'tools/**/*.{ts,mjs}', 'tests/**/*.{ts,tsx}', 'config/*.ts'],
  eslint: { config: ['config/eslint.config.ts'] },
  vitest: { config: ['config/vitest.config.ts'] },
};

export default config;
