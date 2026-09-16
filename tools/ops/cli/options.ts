/** 運用コマンドが共有する引数の読み取り。 */
import { resolve } from 'node:path';
import { createProbe, distFetch } from '../probe';

export function nonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`${flag} は 0 以上の整数で指定してください: ${value}`);
  return parsed;
}

/** `--dist <dir>` があれば out/ を読む模擬配信、なければ実ネットワーク。 */
export const probeFor = (dist: string | undefined) =>
  dist ? createProbe({ fetch: distFetch(resolve(dist)), network: false }) : createProbe();
