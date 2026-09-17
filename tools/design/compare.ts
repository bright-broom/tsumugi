/** Compare two built sites in the same browser; never replaces its own baseline. */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { chromium, type Page } from 'playwright';
import { ROOT } from '../paths';

const [beforeArg, afterArg = 'out', reportArg = '.artifacts/design/comparison'] =
  process.argv.slice(2);
if (!beforeArg)
  throw new Error(
    'Usage: npm run design:compare -- <before-directory> [after-directory] [report-directory]',
  );
const before = await realpath(resolve(ROOT, beforeArg));
const after = await realpath(resolve(ROOT, afterArg));
const report = resolve(ROOT, reportArg);
if (before === after) throw new Error('Before and after must be different directories.');
if ([before, after].some((dir) => report === dir || report.startsWith(dir + sep)))
  throw new Error('Reports must be outside both site directories.');
const widths = [320, 390, 768, 1440];
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
async function files(dir: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await files(join(dir, entry.name), `${name}/`)));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
const fileLists = await Promise.all([files(before), files(after)]);
const fileSet = [...new Set(fileLists.flat())].sort();
const hashes = await Promise.all(
  fileSet.map(async (file) => {
    const values = await Promise.all(
      [before, after].map(async (dir) => {
        try {
          return createHash('sha256')
            .update(await readFile(join(dir, file)))
            .digest('hex');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw error;
        }
      }),
    );
    return { file, before: values[0], after: values[1], same: values[0] === values[1] };
  }),
);
const pages = fileSet.filter((file) => file.endsWith('.html'));
if (!pages.length) throw new Error('No built HTML pages found. Build both sites first.');
await mkdir(report, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const side = req.headers.host?.startsWith('localhost:') ? before : after;
    // Both origins have root-relative assets and links; serve each from its own Host.
    let path = resolve(side, '.' + pathname);
    if (path !== side && !path.startsWith(side + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const actual = await realpath(path);
    if (!actual.startsWith(side + sep)) {
      res.writeHead(403).end();
      return;
    }
    res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((ok, fail) => {
  server.once('error', fail);
  server.listen(0, '127.0.0.1', ok);
});
const port = (server.address() as AddressInfo).port;
const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
async function settle(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Page unavailable: ${url}`);
  await page.evaluate(async () => {
    // Full-page captures also need off-screen lazy images decoded.
    for (const image of document.images) image.loading = 'eager';
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    await document.fonts.ready;
  });
}
const browser = await chromium.launch();
const results: {
  file: string;
  width: number;
  same: boolean;
  beforeImage: string;
  afterImage: string;
  overflow: number[];
}[] = [];
const failures: string[] = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      javaScriptEnabled: false,
      reducedMotion: 'reduce',
      colorScheme: 'light',
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });
    // No external requests: compare the same local assets, without analytics or third-party flakiness.
    await context.route('**/*', (route) =>
      origins.includes(new URL(route.request().url()).origin) ? route.continue() : route.abort(),
    );
    try {
      const page = await context.newPage();
      for (const file of pages) {
        const images: Buffer[] = [];
        const overflow: number[] = [];
        const names = ['before', 'after'].map(
          (side) => `${file.replaceAll('/', '--')}-${width}-${side}.png`,
        );
        try {
          for (const [index, origin] of origins.entries()) {
            await settle(page, `${origin}/${file}`);
            overflow.push(
              await page.evaluate(() =>
                Math.max(0, document.documentElement.scrollWidth - innerWidth),
              ),
            );
            images.push(
              await page.screenshot({
                path: join(report, names[index]!),
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
              }),
            );
          }
          const same = images[0]!.equals(images[1]!);
          results.push({
            file,
            width,
            same,
            beforeImage: names[0]!,
            afterImage: names[1]!,
            overflow,
          });
          if (!same) failures.push(`${file} @ ${width}: screenshot changed`);
          if (overflow[1]! > 0)
            failures.push(`${file} @ ${width}: ${overflow[1]}px document overflow`);
        } catch (error) {
          failures.push(`${file} @ ${width}: ${String(error)}`);
        }
      }
      console.log(`design:compare ${width}px: ${pages.length} pages checked`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise<void>((ok, fail) => server.close((error) => (error ? fail(error) : ok())));
}
const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
await writeFile(
  join(report, 'report.json'),
  JSON.stringify(
    { before, after, browser: chromium.executablePath(), widths, hashes, results, failures },
    null,
    2,
  ),
);
await writeFile(
  join(report, 'index.html'),
  `<!doctype html><html lang="ja"><meta charset="utf-8"><title>デザイン変更比較</title>
<style>body{font:16px system-ui;margin:32px;background:#f7f7f7;color:#222}summary{padding:16px;cursor:pointer}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;height:auto}details{background:white;margin:12px 0}pre{white-space:pre-wrap}</style>
<h1>デザイン変更比較</h1><p>${results.filter((r) => r.same).length} / ${pages.length * widths.length} 表示一致。ファイルの変更は report.json を参照。</p>
<pre>${escape(failures.join('\n'))}</pre>${results.map((r) => `<details${r.same ? '' : ' open'}><summary>${escape(r.file)} / ${r.width} px — ${r.same ? '一致' : '変更あり'}</summary><section><div>変更前<img loading="lazy" src="${escape(r.beforeImage)}" alt="変更前"></div><div>変更後<img loading="lazy" src="${escape(r.afterImage)}" alt="変更後"></div></section></details>`).join('')}</html>`,
);
console.log(
  `design:compare ${results.filter((r) => r.same).length}/${pages.length * widths.length} identical; ${failures.length} failures. Report: ${report}`,
);
if (failures.length) process.exitCode = 1;
