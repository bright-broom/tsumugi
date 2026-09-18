/**
 * ブラウザ検証（Playwright + Chromium）。LCP・コントラスト・横スクロール・タップ領域・文字の下限・アイコン比。
 */
import { createReadStream, mkdirSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import type { Page, Route } from 'playwright';
import * as JS from './in-page';
import { tokyoDate } from '@/lib/verification-report';
import { SCREENSHOTS_DIR } from '../paths';
import { rec } from './results';
import { SECURITY_HEADERS } from '../security/policy';
import { localeScope } from './static';
import {
  CONTRAST_BODY, CONTRAST_LARGE, IC_RATIO_MAX, IC_RATIO_MIN, LCP_BUDGET_MS, MIN_FIG_TEXT, MIN_FONT_MB, MOBILE_W, TAP_MIN,
} from './thresholds';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** dist をそのまま配る小さな静的サーバー。ポートは空いているものを使う */
function serve(dist: string): Promise<{ server: Server; base: string }> {
  const root = resolve(dist);
  const server = createServer((req, res) => {
    let p = join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname));
    if (p !== root && !p.startsWith(root + sep)) return void res.writeHead(403).end();
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p) || !statSync(p).isFile()) return void res.writeHead(404).end();
    res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      ok({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

/** in-page.ts の関数（文字列）を、引数をつけてページの中で呼ぶ */
function run<T>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(`(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})`) as Promise<T>;
}

/** CSPのunsafe-evalを要求せず、検査側でCSSの読込みを待つ。 */
async function waitForStyles(page: Page): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await run<boolean>(page, JS.STYLES_READY)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`theme.css did not become ready: ${page.url()}`);
}

const need = (large: boolean) => (large ? CONTRAST_LARGE : CONTRAST_BODY);

/** 27 図解の文字も、SVG 上の値ではなく画面上の実寸で下限を測る（図のあるページだけ記録する） */
async function recFigText(page: Page, f: string, width: number): Promise<void> {
  const r = await run<{ seen: number; bad: { px: number; txt: string }[] }>(page, JS.FIG_TEXT, MIN_FIG_TEXT);
  if (!r.seen) return;
  rec(r.bad.length ? 'FAIL' : 'PASS', `27 図の文字の実寸 ${MIN_FIG_TEXT}px(${width}px)`, f,
    r.bad.length ? `${r.bad.length}件: ${JSON.stringify(r.bad.slice(0, 3))}` : `${r.seen}個`);
}

/** LCP の最悪値と測ったページ数を返す。測れなかったら null */
export async function checkBrowser(
  dist: string, root: string, writeBack: boolean,
): Promise<{ worstMs: number; pages: number } | null> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    rec('WARN', 'ブラウザ検証', '-', 'playwright が入っていません。--static で実行してください');
    return null;
  }

  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const { server, base } = await serve(dist);
  // ビルドした言語のページだけを、その言語のパスで開く（ADR 0081）
  const scope = localeScope(dist);
  const at = (f: string) => `${base}${scope.urlPrefix}/${f}`;
  const lcps = new Map<string, number>();
  const blocked: string[] = [];

  /** 検証環境は外部に出られないので、サードパーティは遮断して自前のバイトだけを測る。
      font-display:swap を指定しているため、本番でも文字はフォールバックで即描画され、
      LCPはフォント取得を待たない。この測定値は本番の下限として扱う。 */
  const blockExternal = (route: Route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    blocked.push(u.split('/')[2] ?? u);
    return route.abort();
  };

  try {
    const br = await chromium.launch({ args: ['--no-sandbox'] });
    try {
      // ── デスクトップ：LCP・コントラスト・コンソール
      const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
      await pg.route('**/*', blockExternal);
      const errs: string[] = [];
      pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      pg.on('pageerror', (x) => errs.push(String(x)));

      for (const f of scope.files) {
        await pg.goto(at(f), { waitUntil: 'domcontentloaded' });
        const r = await run<{ lcp: number; el: string }>(pg, JS.LCP);
        lcps.set(f, r.lcp);
        rec(r.lcp <= LCP_BUDGET_MS ? 'PASS' : 'FAIL', '13 LCP 2.5秒以内', f, `${r.lcp.toFixed(0)}ms / 要素=${r.el}`);

        const w = await run<{ ratio: number; size: number; bold: boolean; text: string } | null>(pg, JS.FIG_CONTRAST);
        if (w) {
          const req = need(w.size >= 24 || (w.bold && w.size >= 18.66));
          rec(w.ratio >= req ? 'PASS' : 'FAIL', '図のコントラスト比 AA', f,
            `最悪 ${w.ratio}:1 (必要 ${req.toFixed(1)}, ${w.size}px) 「${w.text}」`);
        }
        await recFigText(pg, f, 1280);
      }

      const have = scope.files;
      const preferred = ['index.html', 'price.html', 'owned.html', 'flow.html'].filter((c) => have.includes(c));
      for (const cf of preferred.length ? preferred : [have[0]!]) {
        await pg.goto(at(cf), { waitUntil: 'domcontentloaded' });
        // Static pages have no deferred scripts to delay DOMContentLoaded until CSS is ready.
        // Measuring earlier intermittently counted hidden navigation and fallback-font text.
        await waitForStyles(pg);
        await pg.evaluate(() => document.fonts.ready.then(() => undefined));
        for (const c of await run<{ sel: string; ratio: number; size: number; large: boolean }[]>(pg, JS.CONTRAST)) {
          const req = need(c.large);
          rec(c.ratio >= req ? 'PASS' : 'FAIL', 'コントラスト比 AA', cf,
            `${c.sel} = ${c.ratio}:1 (必要 ${req.toFixed(1)}, ${c.size}px)`);
        }
      }

      // 自前で遮断した外部通信の ERR_FAILED は検証上のノイズなので除外する
      const real = errs.filter((x) => !x.includes('net::ERR_FAILED'));
      rec(real.length ? 'FAIL' : 'PASS', 'コンソールエラー', '-',
        real.length ? `${real.length}件: ${JSON.stringify(real.slice(0, 3))}` : `自前の遮断による ${errs.length - real.length}件を除外`);
      await pg.close();

      // ── モバイル：横スクロール・タップ領域・文字の下限・アイコン比
      const mp = await br.newPage({
        viewport: { width: MOBILE_W, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      });
      await mp.route('**/*', blockExternal);
      for (const f of scope.files) {
        await mp.goto(at(f), { waitUntil: 'domcontentloaded' });
        await waitForStyles(mp);

        const ov = await run<{ doc: number; view: number; offenders: unknown[] }>(mp, JS.OVERFLOW);
        const clean = !ov.offenders.length;
        rec(clean ? 'PASS' : 'FAIL', `横スクロールなし(${MOBILE_W}px)`, f,
          clean ? '' : `doc=${ov.doc} > view=${ov.view} / ${JSON.stringify(ov.offenders)}`);

        const bad = await run<unknown[]>(mp, JS.TAP, TAP_MIN);
        rec(bad.length ? 'FAIL' : 'PASS', `16 タップ領域 ${TAP_MIN}px`, f,
          bad.length ? `${bad.length}件: ${JSON.stringify(bad.slice(0, 3))}` : '');

        // 27 手に持つ画面での文字の下限。
        // ガイド06の寸法はPC向けなので、スマホでは別に測る。読み手が50〜60代
        // である前提はタップ領域44pxと同じで、文字にも同じ根拠で効かせる。
        const small = await run<unknown[]>(mp, JS.SMALL_TEXT, MIN_FONT_MB);
        rec(small.length ? 'FAIL' : 'PASS', `27 文字の下限 ${MIN_FONT_MB}px`, f,
          small.length ? `${small.length}件: ${JSON.stringify(small.slice(0, 3))}` : '');
        await recFigText(mp, f, MOBILE_W);

        // 28 アイコンと文字の大きさの比。
        // px で固定すると置き場所ごとに 0.88〜1.20 倍とばらつき、行の中で浮く。
        // em で決めているので、比は常に一定になるはず。崩れたら気づけるようにする。
        const ir = await run<{ key: string; ratio: number }[]>(mp, JS.ICON_RATIO);
        const off = ir.filter((x) => !(IC_RATIO_MIN <= x.ratio && x.ratio <= IC_RATIO_MAX));
        rec(off.length ? 'FAIL' : 'PASS', '28 アイコンと文字の比', f,
          off.length ? `外れ ${off.length}件: ${JSON.stringify(off.slice(0, 3))}`
            : `${ir.length}種すべて ${IC_RATIO_MIN}〜${IC_RATIO_MAX} 倍`);
      }

      const shot = existsSync(join(scope.root, 'index.html')) ? 'index.html' : scope.files[0]!;
      await mp.goto(at(shot), { waitUntil: 'domcontentloaded' });
      writeFileSync(join(SCREENSHOTS_DIR, 'shot-mobile.png'), await mp.screenshot({ fullPage: false }));
      await mp.close();

      const dp = await br.newPage({ viewport: { width: 1280, height: 900 } });
      await dp.route('**/*', blockExternal);
      await dp.goto(at(shot), { waitUntil: 'domcontentloaded' });
      writeFileSync(join(SCREENSHOTS_DIR, 'shot-desktop.png'), await dp.screenshot({ fullPage: false }));
      if (existsSync(join(scope.root, 'price.html'))) {
        await dp.goto(at('price.html'), { waitUntil: 'domcontentloaded' });
        writeFileSync(join(SCREENSHOTS_DIR, 'shot-price.png'), await dp.screenshot({ fullPage: false }));
      }
      await dp.close();
    } finally {
      await br.close();
    }
  } finally {
    server.closeAllConnections();
    server.close();
  }

  if (blocked.length) {
    rec('WARN', '測定条件', '-',
      `サードパーティ遮断下で測定: ${JSON.stringify([...new Set(blocked)].sort())}。` +
      'font-display:swap のため本番でも文字はフォールバックで即描画されるが、' +
      '確定値は公開後にフィールドデータで再測定すること');
  }
  if (!lcps.size) return null;
  const worst = Math.max(...lcps.values());
  if (writeBack) {
    // サイトに出る数字（/spec・/works の LCP）を、いま測った値と記録日に揃える
    const recordedOn = tokyoDate(new Date());
    const txt = `${(worst / 1000).toFixed(2)}秒（全${lcps.size}ページの最大値・${recordedOn} 記録）`;
    const cfg = join(root, 'src', 'content', 'measurements.ts');
    writeFileSync(cfg, readFileSync(cfg, 'utf8')
      .replace(/^export const LCP_SECONDS = .*$/m, `export const LCP_SECONDS = ${(worst / 1000).toFixed(2)};`)
      .replace(/^export const LCP_PAGE_COUNT = .*$/m, `export const LCP_PAGE_COUNT = ${lcps.size};`)
      .replace(/^export const LCP_RECORDED_ON = .*$/m, `export const LCP_RECORDED_ON = '${recordedOn}';`));
    console.log(`\nmeasurements.ts の実測値 を ${txt} に更新しました。コミットしてから再ビルドしてください。`);
  }
  return { worstMs: worst, pages: lcps.size };
}
