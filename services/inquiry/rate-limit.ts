/**
 * 送信回数の制限。鍵は接続元をハッシュにした値で、IP アドレスそのものは持たない。
 * メモリ実装はインスタンスごとに数えるので、サーバーレスで複数インスタンスになる本番では
 * 配備先の共有ストア（KV・Redis など）や、配備先のレート制限機能で同じインターフェースを実装する（ADR 0032）。
 */

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  hit(key: string, now: Date): Promise<RateDecision>;
}

export class FixedWindowRateLimiter implements RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor({ limit, windowMs }: { limit: number; windowMs: number }) {
    if (limit < 1 || windowMs < 1) throw new Error('Rate limit must be positive');
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  async hit(key: string, now: Date): Promise<RateDecision> {
    const at = now.getTime();
    for (const [k, w] of this.#windows) if (at - w.start >= this.#windowMs) this.#windows.delete(k);
    const window = this.#windows.get(key) ?? { start: at, count: 0 };
    window.count += 1;
    this.#windows.set(key, window);
    if (window.count <= this.#limit) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.start + this.#windowMs - at) / 1000)),
    };
  }
}
