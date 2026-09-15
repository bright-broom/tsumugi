/** 受付番号・同一内容の指紋・レート制限の鍵。Web Crypto だけを使い、Workers / Node のどちらでも動く */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 日本時間の日付を含む受付番号。例: INQ-20260916-7K3M9QX2（32^8 通り） */
export function createReceiptId(receivedAt: Date, utcOffsetMinutes: number): string {
  const local = new Date(receivedAt.getTime() + utcOffsetMinutes * 60_000);
  const date = local.toISOString().slice(0, 10).replaceAll('-', '');
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, (b) => CROCKFORD[b % 32]).join('');
  return `INQ-${date}-${suffix}`;
}

export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
