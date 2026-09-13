// prices.ts の計算結果を JSON に落とす。
// verify.py はこの JSON を読んで、ページに出ている金額と突き合わせる。
// （Python 版を消したあとも「表示された金額」を機械で検査できるようにするための橋）
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'prices-'));
try {
  execFileSync('npx', ['tsc', join(here, '..', 'src', 'data', 'prices.ts'),
    '--outDir', out, '--target', 'ES2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM'], { stdio: 'inherit' });
  const P = await import(pathToFileURL(join(out, 'prices.js')).href);
  const rows = P.compareRows();
  writeFileSync(join(here, '..', 'prices.json'), JSON.stringify({
    single_price: P.SINGLE.price,
    monthly_std: P.monthlyAllIn('standard', 'run_standard'),
    compare_first: { sub_total: rows[0].sub_total, our_total: rows[0].our_total },
    subs_source: P.SUBS_SOURCE,
    build_prices: P.BUILD.map((b) => b.price),
    run_prices: P.RUN.map((r) => r.price),
  }, null, 2) + '\n');
  console.log('prices.json を書き出しました');
} finally {
  rmSync(out, { recursive: true, force: true });
}
