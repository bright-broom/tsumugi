// CSS の正本は ../svc/native/ のまま。ここでコピーを作らない。
// 2つのビルド（Python版 / Astro版）が同じ1枚のCSSを見ている状態を保つための橋。
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NATIVE = join(here, '..', '..', 'svc', 'native');
const PUB = join(here, '..', 'public');

const PARTS = ['tokens.css', 'index.css', 'components.css', 'guide.css'];
const PREAMBLE =
  '@layer base, components, screens, overrides;\n' +
  '@view-transition { navigation: auto; }\n';

mkdirSync(PUB, { recursive: true });
writeFileSync(
  join(PUB, 'theme.css'),
  PREAMBLE + PARTS.map((f) => readFileSync(join(NATIVE, f), 'utf8')).join('\n'),
);
for (const dir of ['fonts', 'og']) {
  if (existsSync(join(NATIVE, dir))) {
    cpSync(join(NATIVE, dir), join(PUB, dir), { recursive: true });
  }
}
console.log('theme.css / fonts / og を public/ に用意しました（正本は svc/native/）');
