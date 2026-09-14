/**
 * 偶数丸め（ちょうど .5 は偶数側へ）。
 * JS の Math.round は 0.5 を必ず切り上げるので、340 × 500,000 ÷ 800,000 = 212.5 が 213 になる。
 * 移行前の出力（212）と図・比較バーの幅を揃えるため、こちらを使う。
 */
export function rnd(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
