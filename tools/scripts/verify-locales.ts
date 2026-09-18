/**
 * 追加言語の納品検査（ADR 0081）。PUBLISHED_LOCALES の 2 番目以降を SITE_LOCALE に指定して、
 * 同じ引数で verify を実行する（例：npm run verify:locales -- --static）。言語が 1 つなら何もしない。
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PUBLISHED_LOCALES } from '@/content/config';
import { ROOT } from '../paths';

let failed = false;
for (const locale of PUBLISHED_LOCALES.slice(1)) {
  console.log(`verify:locales: ${locale}`);
  const result = spawnSync(
    join(ROOT, 'node_modules', '.bin', 'tsx'),
    ['tools/verify/verify.ts', ...process.argv.slice(2)],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, SITE_LOCALE: locale } },
  );
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
