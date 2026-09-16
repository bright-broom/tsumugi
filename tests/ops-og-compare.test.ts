import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OG_REFERENCE, compareDirs, isIdentical, referenceGaps } from '../tools/ops/og-compare';

const OG = join(import.meta.dirname, '..', 'public', 'og');
const FIXTURES = ['index.png', 'price.png', 'favicon.svg'];
const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** コミット済みの画像を写したディレクトリ（public/og/ は読むだけ） */
function copyOf(files = FIXTURES) {
  const dir = mkdtempSync(join(tmpdir(), 'tsumugi-og-fixture-'));
  scratch.push(dir);
  for (const file of files) copyFileSync(join(OG, file), join(dir, file));
  return dir;
}

describe('OGP 画像の再現性の比較', () => {
  it('同じ PNG 同士は一致', () => {
    const comparison = compareDirs(copyOf(), copyOf());
    expect(comparison.same).toEqual(['favicon.svg', 'index.png', 'price.png']);
    expect(isIdentical(comparison)).toBe(true);
  });

  it('1 バイトでも違えば差分として挙げる', () => {
    const generated = copyOf();
    const png = readFileSync(join(generated, 'price.png'));
    png.writeUInt8(png.readUInt8(png.length - 20) ^ 0x01, png.length - 20);
    writeFileSync(join(generated, 'price.png'), png);
    const comparison = compareDirs(copyOf(), generated);
    expect(comparison.different).toEqual([
      { file: 'price.png', expectedBytes: png.length, actualBytes: png.length },
    ]);
    expect(isIdentical(comparison)).toBe(false);
  });

  it('生成されなかったファイルと余分なファイルを挙げる', () => {
    const generated = copyOf(['index.png', 'favicon.svg']);
    copyFileSync(join(OG, 'faq.png'), join(generated, 'faq.png'));
    const comparison = compareDirs(copyOf(), generated);
    expect(comparison.missing).toEqual(['price.png']);
    expect(comparison.extra).toEqual(['faq.png']);
  });

  it('正本の環境との違いを原因の候補として出す', () => {
    const reference = {
      platform: OG_REFERENCE.platform,
      macOS: OG_REFERENCE.macOS,
      playwright: OG_REFERENCE.playwright,
      chromium: OG_REFERENCE.chromium,
    };
    expect(referenceGaps(reference)).toEqual([]);
    const linux = { ...reference, platform: 'linux', macOS: null, playwright: '1.64.0' };
    expect(referenceGaps(linux)).toEqual([
      expect.stringContaining('OS が linux'),
      expect.stringContaining('Playwright 1.64.0'),
    ]);
  });
});
