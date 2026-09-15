import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // CSS is compiled by a child process; pricing CLIs are discovered from package.json.
  entry: ['src/pages/**/*.{ts,tsx}!', 'src/styles/globals.css!', 'src/styles/og.css!'],
  project: ['src/**/*.{ts,tsx,css}', 'tools/**/*.ts', 'tests/**/*.{ts,tsx}', 'config/*.ts'],
  eslint: { config: ['config/eslint.config.ts'] },
  vitest: { config: ['config/vitest.config.ts'] },
};

export default config;
