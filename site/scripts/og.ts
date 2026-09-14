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
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import * as C from '@/content/config';
import * as P from '@/content/prices';

const ROOT = join(import.meta.dirname, '..');
const outArg = process.argv.indexOf('--out');
const OUT =
  outArg >= 0 && process.argv[outArg + 1]
    ? resolve(process.argv[outArg + 1]!)
    : join(ROOT, 'public', 'og');
const W = 1200;
const H = 630;

// ページごとの見出し。ページの並び（NAV → 業種 → 会社・法務 → 404）と同じ順で持つ。
// 金額と返信の約束はページと同じ出所から引く（カードにだけ古い数字が残らないように）
const SHEET = OG_CARDS;

const css = (hs: number) => `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0B0B0D;color:#fff;
  font-family:"Noto Sans CJK JP","Hiragino Sans",sans-serif;
  display:flex;flex-direction:column;justify-content:space-between;
  padding:68px 76px;font-feature-settings:"palt" 1}
.top{display:flex;align-items:baseline;gap:16px}
.mark{font-size:64px;font-weight:700;letter-spacing:.05em;line-height:1}
.rd{font-size:17px;letter-spacing:.22em;color:#A8AEB8}
.bar{width:1px;height:38px;background:rgba(255,255,255,.28);margin-inline:8px}
.trade{font-size:18px;color:#A8AEB8;letter-spacing:.04em}
h1{font-size:${hs}px;font-weight:700;line-height:1.46;letter-spacing:-.01em}
h1 .q{color:#A8AEB8}
.foot{display:flex;align-items:flex-end;justify-content:space-between;gap:40px}
.pts{display:flex;gap:12px;flex-wrap:wrap}
.pt{font-size:17px;font-weight:700;padding:9px 18px;border-radius:999px;
  border:1px solid rgba(255,255,255,.3);color:#fff;white-space:nowrap}
.amt{text-align:right;line-height:1;white-space:nowrap}
.amt .k{font-size:15px;color:#A8AEB8;letter-spacing:.04em}
.amt .v{font-size:58px;font-weight:700;letter-spacing:-.02em;margin-top:8px}
.amt .v i{font-size:22px;font-style:normal;font-weight:600;margin-left:4px}
.amt .v b{color:#42D083}
`;

function pageHtml(quiet: string, loud: string): string {
  // 字数はコードポイントで数える（サロゲートペアの字も1字）
  const hs = [...quiet].length + [...loud].length <= 30 ? 54 : 46;
  // カードに出す金額は「入口の金額」にする。
  // リンクを開くかどうかは、いちばん小さい数字で決まる。
  return `<!doctype html><meta charset="utf-8"><style>${css(hs)}</style>
<body>
  <div class="top">
    <span class="mark">${C.BRAND}</span><span class="rd">${C.BRAND_READING}</span>
    <span class="bar"></span><span class="trade">${copy.trade}</span>
  </div>
  <h1><span class="q">${quiet}</span><br>${loud}</h1>
  <div class="foot">
    <div class="pts">
      <span class="pt">${copy.ownership}</span>
      <span class="pt">${copy.source}</span>
      <span class="pt">${copy.term}</span>
    </div>
    <div class="amt"><div class="k">${copy.entry}</div>
      <div class="v"><b>${P.SINGLE.price.toLocaleString('en-US')}</b><i>${copy.yenFrom}</i></div></div>
  </div>
</body>`;
}

const favi = (n: number, f: number, m: string) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0}
body{width:${n}px;height:${n}px;background:#0B0B0D;color:#fff;display:flex;
  align-items:center;justify-content:center;
  font-family:"Noto Sans CJK JP","Hiragino Sans",sans-serif}
span{font-size:${f}px;font-weight:700;line-height:1}
</style><body><span>${m}</span></body>`;

// SVG のファビコン。背景を塗って一文字を置くだけなので、字形はブラウザの書体に任せる
const faviSvg = (m: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="12" fill="#0B0B0D"/>' +
  '<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ' +
  'font-family="Hiragino Sans, Noto Sans CJK JP, Meiryo, sans-serif" ' +
  `font-size="44" font-weight="700" fill="#FFFFFF">${m}</text></svg>`;

const ICONS = [
  [180, 118, 'apple-touch-icon.png'],
  [512, 336, 'icon-512.png'],
] as const;

async function main() {
  // 出力先ごと消さずに上書きする（--out に既存のディレクトリを渡しても中身を巻き込まない）
  mkdirSync(OUT, { recursive: true });

  // 下書きの HTML はディスクに書かず、その場で配る
  const docs = new Map<string, string>();
  for (const [name, [q, l]] of Object.entries(SHEET)) docs.set(`/${name}`, pageHtml(q, l));
  for (const [n, f] of ICONS) docs.set(`/favi${n}.html`, favi(n, f, C.BRAND));
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
    for (const [n, , file] of ICONS) {
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
