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
import { HOME_HERO } from '@/content/hero';
import { getMessages } from '@/i18n/catalog';
import { esc } from '@/lib/raw';

const ROOT = join(import.meta.dirname, '..');
const STYLES = join(ROOT, 'styles');
const PUB = join(ROOT, 'public');

const PARTS = ['tokens.css', 'index.css', 'components.css', 'guide.css', 'home.css'];
const PREAMBLE =
  '@layer base, components, screens, overrides;\n' + '@view-transition { navigation: auto; }\n';

mkdirSync(PUB, { recursive: true });

// SVG は画像を内包する単体ファイル。元絵の文字は暫定のため描き込みのまま。
const hero = getMessages().home.hero;
const heroImage = readFileSync(join(ROOT, 'assets/hero/onokoro.webp')).toString('base64');
mkdirSync(join(PUB, 'images'), { recursive: true });
writeFileSync(
  join(PUB, HOME_HERO.src),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${HOME_HERO.width}" height="${HOME_HERO.height}" viewBox="0 0 ${HOME_HERO.width} ${HOME_HERO.height}" role="img" aria-labelledby="title description">` +
    `<title id="title">${esc(hero.heading + hero.heading2)}</title>` +
    `<desc id="description">${esc(hero.message + hero.message2 + hero.artworkAlt)}</desc>` +
    `<image width="${HOME_HERO.width}" height="${HOME_HERO.height}" href="data:image/webp;base64,${heroImage}"/></svg>`,
);

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
