/** Exercise deployed CSP in a real browser, including deliberate blocked payloads. */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from '../paths';
import { SECURITY_HEADERS } from './policy';

const root = join(ROOT, 'out');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.html') ? [path] : [];
  });
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
const server = createServer((req, res) => {
  res.setHeaders(new Headers(SECURITY_HEADERS));
  if (req.url === '/security-probe.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      `<script>window.injected=true</script><button onclick="window.injected=true">probe</button><iframe src="/index.html"></iframe><form action="/submitted" method="post"><button>submit probe</button></form>`,
    );
    return;
  }
  try {
    const path = resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname),
    );
    if (!path.startsWith(root + sep) || !statSync(path).isFile()) throw new Error('not found');
    res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No listening port');
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const state = window as unknown as { securityViolations: string[] };
    state.securityViolations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      state.securityViolations.push(event.effectiveDirective),
    );
  });
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  const pages = files(root);
  for (const file of pages) {
    const response = await page.goto(base + file.slice(root.length), { waitUntil: 'networkidle' });
    if (
      response?.headers()['content-security-policy'] !== SECURITY_HEADERS['content-security-policy']
    )
      throw new Error('Security headers were not served');
    if (violations.length) throw new Error(`${file}: ${violations.join('\n')}`);
  }
  await page.goto(base + '/security-probe.html', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'probe', exact: true }).click();
  // A blocked form must not wait for a navigation that will never complete.
  await page
    .getByRole('button', { name: 'submit probe', exact: true })
    .click({ noWaitAfter: true });
  await page.waitForFunction(() => document.readyState === 'complete');
  if (await page.evaluate(() => 'injected' in window)) throw new Error('Injected script executed');
  if (!page.url().endsWith('/security-probe.html')) throw new Error('Blocked form navigated');
  await page.waitForFunction(() =>
    (window as unknown as { securityViolations: string[] }).securityViolations.includes(
      'form-action',
    ),
  );
  const blocked = await page.evaluate(
    () => (window as unknown as { securityViolations: string[] }).securityViolations,
  );
  for (const directive of ['script-src-elem', 'script-src-attr', 'frame-src', 'form-action'])
    if (!blocked.includes(directive))
      throw new Error(`Missing blocked directive: ${directive}; observed ${blocked.join(', ')}`);
  console.log(
    `Security browser: ${pages.length} pages without CSP violations; injected script, event, frame and form blocked`,
  );
} finally {
  await browser.close();
  await new Promise<void>((ok) => server.close(() => ok()));
}
