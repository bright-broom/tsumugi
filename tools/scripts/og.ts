import { spaceHtml } from '@/i18n/html-typography';
import { OG_CARDS } from '@/content/og';
import { getMessages } from '@/i18n/catalog';
const copy = getMessages().og;
/**
 * OGP画像を各ページぶん生成する（public/og/*.png）。
 *
 *     npm run og                    public/og/ に書き出す
 *     npm run og -- --out <dir>     別の場所に書き出す（差分の確認用）
 *
 * 営業の主経路は「電話 → URLを送る」で、地方ではそれが LINE になる。
 * リンクを貼ったときにカードが真っ白か、屋号と金額が出るかで開封率が変わるので、
 * これは装飾ではなく導線の一部として扱う。
 *
 * next build はこの生成物を配るだけにしてある（ビルドに Chromium を要求しない）。
 * 文面を変えたらこれを実行し、public/og/ の差分をコミットすること。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildStyles } from './build-styles';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import tokens from '@/styles/design.tokens.json';

import { ROOT } from '../paths';
import { BUILD_LOCALE, LOCALE_SETTINGS } from '@/lib/locale';
const outArg = process.argv.indexOf('--out');
const OUT =
  outArg >= 0 && process.argv[outArg + 1]
    ? resolve(process.argv[outArg + 1]!)
    : // 追加言語のカードは public/og/<言語>/（SITE_LOCALE=en npm run og、ADR 0081）
      join(ROOT, 'public', 'og', LOCALE_SETTINGS[BUILD_LOCALE].basePath.replace(/^\//, ''));
const W = 1200;
const H = 630;

// ページごとの見出し。ページの並び（NAV → 業種 → 会社・法務 → 404）と同じ順で持つ。
// 金額と返信の約束はページと同じ出所から引く（カードにだけ古い数字が残らないように）
const SHEET = OG_CARDS;

function pageHtml(quiet: string, loud: string, css: string): string {
  // 字数はコードポイントで数える（サロゲートペアの字も1字）
  const hs = [...quiet].length + [...loud].length <= 30 ? 54 : 46;
  // カードに出す金額は「入口の金額」にする。
  // リンクを開くかどうかは、いちばん小さい数字で決まる。
  return spaceHtml(`<!doctype html><meta charset="utf-8"><style>${css}</style>
<body class="og-card">
  <div class="top">
    <span class="mark">${C.BRAND}</span><span class="rd">${C.BRAND_READING}</span>
    <span class="bar"></span><span class="trade">${copy.trade}</span>
  </div>
  <h1 class="og-heading-${hs}"><span class="q">${quiet}</span><br>${loud}</h1>
  <div class="foot">
    <div class="pts">
      <span class="pt">${copy.ownership}</span>
      <span class="pt">${copy.source}</span>
      <span class="pt">${copy.term}</span>
    </div>
    <div class="amt"><div class="k">${copy.entry}</div>
      <div class="v"><b>${P.SINGLE.price.toLocaleString('en-US')}</b><i>${copy.yenFrom}</i></div></div>
  </div>
</body>`);
}

const favi = (n: number, m: string, css: string) =>
  `<!doctype html><meta charset="utf-8"><style>${css}</style><body class="og-icon og-icon-${n}"><span>${m}</span></body>`;

// SVG のファビコン。背景を塗って一文字を置くだけなので、字形はブラウザの書体に任せる
const faviSvg = (m: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  `<rect width="64" height="64" rx="12" fill="${tokens.color.accent.$value}"/>` +
  '<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ' +
  'font-family="Hiragino Sans, Noto Sans CJK JP, Meiryo, sans-serif" ' +
  `font-size="44" font-weight="700" fill="${tokens.color.sub.$value}">${m}</text></svg>`;

const ICONS = [
  [180, 'apple-touch-icon.png'],
  [512, 'icon-512.png'],
] as const;

async function main() {
  let css: string;
  const scratch = mkdtempSync(join(tmpdir(), 'tsumugi-og-styles-'));
  try {
    const sheet = join(scratch, 'og.css');
    await buildStyles('src/styles/og.css', sheet);
    css = readFileSync(sheet, 'utf8');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  // 出力先ごと消さずに上書きする（--out に既存のディレクトリを渡しても中身を巻き込まない）
  mkdirSync(OUT, { recursive: true });

  // 下書きの HTML はディスクに書かず、その場で配る
  const docs = new Map<string, string>();
  for (const [name, [q, l]] of Object.entries(SHEET)) docs.set(`/${name}`, pageHtml(q, l, css));
  for (const [n] of ICONS) docs.set(`/favi${n}.html`, favi(n, C.BRAND, css));
  writeFileSync(join(OUT, 'favicon.svg'), faviSvg(C.BRAND), 'utf8');

  const srv = createServer((req, res) => {
    const body = docs.get(req.url ?? '');
    if (body === undefined) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const { port } = srv.address() as AddressInfo;

  const report = (file: string) =>
    console.log(
      `  ${file.padEnd(22)}${(statSync(join(OUT, file)).size / 1024).toFixed(1).padStart(6)} KB`,
    );

  const browser = await chromium.launch();
  try {
    const pg = await browser.newPage({ viewport: { width: W, height: H } });
    for (const name of Object.keys(SHEET)) {
      const png = name.replace('.html', '.png');
      await pg.goto(`http://127.0.0.1:${port}/${name}`, { waitUntil: 'load' });
      await pg.screenshot({ path: join(OUT, png) });
      report(png);
    }
    for (const [n, file] of ICONS) {
      await pg.setViewportSize({ width: n, height: n });
      await pg.goto(`http://127.0.0.1:${port}/favi${n}.html`, { waitUntil: 'load' });
      await pg.screenshot({ path: join(OUT, file) });
      report(file);
    }
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(`生成: OGP ${Object.keys(SHEET).length}枚 ＋ ファビコン3種 -> ${OUT}`);
}

await main();
