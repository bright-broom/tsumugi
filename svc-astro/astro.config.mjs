import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://example.jp',
  // build.format: 'file' で src/pages/terms.astro → dist/terms.html になる。
  // 'directory'（既定）だと dist/terms/index.html になり、
  // いまの内部リンク（href="terms.html"）と verify.py の検査が両方壊れる。
  build: { format: 'file', assets: '_a' },
  integrations: [react()],
  // 画像の最適化はビルド時のみ。実行時のプログラムを増やさない。
  devToolbar: { enabled: false },
});
