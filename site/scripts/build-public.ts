/**
 * public/ に、ビルドと開発サーバーの両方が配る生成物を用意する。
 *
 * - theme.css   … styles/*.css を1枚に束ねる。CSS の正本は styles/（public/theme.css は手で編集しない）
 * - robots.txt  … 固定文面
 * - sitemap.xml … ページ一覧から作る。404 は載せない。並びは NAV → 法務 → 業種
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN } from '@/content/config';
import { PUBLIC_ROUTES } from '@/routing/registry';

const ROOT = join(import.meta.dirname, '..');
const STYLES = join(ROOT, 'styles');
const PUB = join(ROOT, 'public');

const PARTS = ['tokens.css', 'index.css', 'components.css', 'guide.css'];
const PREAMBLE =
  '@layer base, components, screens, overrides;\n' + '@view-transition { navigation: auto; }\n';

mkdirSync(PUB, { recursive: true });

writeFileSync(
  join(PUB, 'theme.css'),
  PREAMBLE + PARTS.map((f) => readFileSync(join(STYLES, f), 'utf8')).join('\n'),
);

writeFileSync(
  join(PUB, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: https://${DOMAIN}/sitemap.xml\n`,
);

const FILES = PUBLIC_ROUTES.map((route) => route.file);
writeFileSync(
  join(PUB, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    FILES.map((f) => `  <url><loc>https://${DOMAIN}/${f}</loc></url>\n`).join('') +
    '</urlset>\n',
);

console.log(
  'public/ に theme.css / robots.txt / sitemap.xml を用意しました（CSS の正本は styles/）',
);
