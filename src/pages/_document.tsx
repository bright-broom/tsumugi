import { Html, Head, Main, NextScript } from 'next/document';
import { LOCALE } from '@/i18n/catalog';
import tokens from '@/styles/design.tokens.json';

/**
 * ページに依らない head。ページごとの head は layouts/Base.tsx（next/head）。
 *
 * NextScript は置いてあるが、各ページが `export const config = { unstable_runtimeJS: false }` を
 * 宣言しているので script タグは1つも出ない。宣言を忘れたページは scripts/postbuild.ts でビルドが落ちる。
 */
export default function Document() {
  return (
    <Html lang={LOCALE.language}>
      <Head>
        <meta name="theme-color" content={tokens.color.main.$value} />
        <link rel="icon" href="/og/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/og/apple-touch-icon.png" />
        <link rel="stylesheet" href="/theme.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
