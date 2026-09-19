import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  .scripts as Record<string, string>;

// PR の統合で手順が落ちた事故がある（CMS の取り込み）。ビルドと検証の順番を固定する（ADR 0080・0081）。
it('build は CMS の取り込み → 公開物の生成 → next build → 後始末 → 追加言語 → 言語の検査の順に行う', () => {
  expect(scripts.build!.split(' && ')).toEqual([
    'tsx tools/cms/pull.ts --if-configured',
    'tsx tools/scripts/build-tokens.ts --check',
    'tsx tools/scripts/build-public.ts',
    'next build',
    'tsx tools/scripts/postbuild.ts',
    'tsx tools/scripts/build-locales.ts',
    'tsx tools/scripts/check-locales.ts',
  ]);
});

it('validate は既定言語と追加言語の静的検査まで行う', () => {
  const steps = scripts.validate!.split(' && ');
  expect(steps.slice(-3)).toEqual([
    'npm run check:security',
    'npm run verify -- --static',
    'npm run verify:locales -- --static',
  ]);
  expect(steps).toContain('npm run build');
});

it('package.json に同じスクリプト名が重複していない（JSON は後の値で黙って上書きする）', () => {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const block = raw.slice(raw.indexOf('"scripts"'), raw.indexOf('}', raw.indexOf('"scripts"')));
  const names = [...block.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]);
  expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  expect(names.length).toBe(Object.keys(scripts).length);
});
