/** Fail the build if active content or private files reach the static publishing directory. */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ROOT } from '../paths';
import { unsafeMarkup } from './markup';
import { SECURITY_HEADERS } from './policy';

const root = join(ROOT, 'out');
const allowed = new Set([
  '.html',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.txt',
  '.xml',
]);
const problems: string[] = [];
let count = 0;
function walk(directory: string, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = prefix + entry.name;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      problems.push(`${file}: symbolic link`);
      continue;
    }
    if (entry.name.startsWith('.')) problems.push(`${file}: hidden publishing artifact`);
    if (entry.isDirectory()) {
      walk(path, file + '/');
      continue;
    }
    count++;
    if (!allowed.has(extname(file))) problems.push(`${file}: unexpected publishing file type`);
    if (['.html', '.svg'].includes(extname(file)))
      for (const issue of unsafeMarkup(readFileSync(path, 'utf8')))
        problems.push(`${file}: ${issue}`);
  }
}
walk(root);
const csp = SECURITY_HEADERS['content-security-policy'] ?? '';
for (const directive of [
  "default-src 'none'",
  "script-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
])
  if (
    !csp
      .split(';')
      .map((s) => s.trim())
      .includes(directive)
  )
    problems.push(`CSP missing: ${directive}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else
  console.log(`Security: ${count} publishing files checked; strict static-site CSP configured`);
