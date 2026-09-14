import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { verifyPass } from '@/lib/measured';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('実測レポートの取り込み', () => {
  it('実際の整数件数を表示する', () => {
    vi.mocked(readFileSync).mockReturnValue('{"pass":581}');
    expect(verifyPass()).toBe(581);
  });
  it.each(['{}', '{"pass":"581"}', '{"pass":-1}', '{"pass":1.5}', 'broken'])(
    '不正な件数を実績にしない: %s',
    (value) => {
      vi.mocked(readFileSync).mockReturnValue(value);
      expect(verifyPass()).toBe('—');
    },
  );
  it('未計測なら数字を作らない', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(verifyPass()).toBe('—');
  });
});
