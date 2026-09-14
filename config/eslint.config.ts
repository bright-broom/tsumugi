import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // 静的 HTML と CSS を配り、next/link・next/image のランタイムを使わない。
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
      '@next/next/no-css-tags': 'off',
    },
  },
  globalIgnores([
    '.artifacts/**',
    '.next/**',
    'out/**',
    '.vercel/**',
    'coverage/**',
    'next-env.d.ts',
    'public/**',
  ]),
]);
