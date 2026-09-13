import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * ビルドは静的書き出し（out/）。ページはフラットな .html（out/terms.html）で、
 * 内部リンクも href="terms.html" のまま。どのホスティングにも置ける。
 *
 * 開発サーバーは /terms で配るので、.html 付きのリンクを踏めるよう開発時だけ書き換える
 * （rewrites は output: 'export' と併用できないので、フェーズで分けている）。
 *
 * App Router ではなく Pages Router を使っている理由は README の「なぜ Pages Router か」。
 * 要点：App Router は静的書き出しでも全ページに約173KB（gzip）の JS を配り、減らせない。
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      async rewrites() {
        return [
          { source: '/index.html', destination: '/' },
          { source: '/:page.html', destination: '/:page' },
        ];
      },
    };
  }
  return { output: 'export' };
}
