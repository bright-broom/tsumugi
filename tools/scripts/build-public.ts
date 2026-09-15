/**
 * public/ に、ビルドと開発サーバーの両方が配る生成物を用意する。
 *
 * - theme.css   … src/styles/globals.css をTailwindでコンパイルする。CSS の正本は src/styles/（public/theme.css は手で編集しない）
 * - robots.txt  … 固定文面
 * - sitemap.xml … ページ一覧から作る。404 は載せない。並びは NAV → 法務 → 業種
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN } from '@/content/config';
import { PUBLIC_ROUTES } from '@/routing/registry';
import { HOME_HERO, heroSvg } from '@/content/hero';
import { getMessages } from '@/i18n/catalog';
import { buildStyles } from './build-styles';

import { ROOT } from '../paths';
const PUB = join(ROOT, 'public');

mkdirSync(PUB, { recursive: true });
await buildStyles();

// SVG は画像を内包する単体ファイル。背景画だけを内包し、コピーは HTML がカタログから描画する。
const hero = getMessages().home.hero;
const heroImage = readFileSync(join(ROOT, 'src/assets/hero/onokoro.webp')).toString('base64');
mkdirSync(join(PUB, 'images'), { recursive: true });
writeFileSync(join(PUB, HOME_HERO.src), heroSvg(hero.artworkAlt, heroImage));

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
  'public/ に theme.css / robots.txt / sitemap.xml を用意しました（CSS の正本は src/styles/）',
);
