/** The deployed policy is defined once in vercel.json; local verification uses the same headers. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
  headers: HeaderRule[];
};
const rule = config.headers?.find((entry) => entry.source === '/(.*)');
if (!rule) throw new Error('Missing site-wide security headers');
export const SECURITY_HEADERS = Object.fromEntries(
  rule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
);
