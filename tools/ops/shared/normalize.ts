/** 電話・URL・名前の正規化。営業リスト（#24）と GBP の突き合わせ（#30）で共有する。 */

/** 全角英数・半角カナを NFKC でそろえ、前後と連続する空白を詰める。 */
export const nfkc = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ');

/** 数字だけにする。+81 は 0 に戻す。形式が国内の固定・携帯の桁数（10〜11 桁）でなければ valid: false。 */
export function normalizePhone(raw: string | undefined): { digits: string; valid: boolean } | null {
  if (!raw || !raw.trim()) return null;
  let text = raw.normalize('NFKC').replace(/[^\d+]/g, '');
  if (text.startsWith('+81')) text = `0${text.slice(3)}`;
  const digits = text.replace(/\D/g, '');
  return { digits, valid: /^0\d{9,10}$/.test(digits) };
}

export interface CanonicalUrl {
  href: string;
  host: string;
  /** 比較用：www. を除いたホスト＋末尾の / を除いたパス。クエリとフラグメントは捨てる。 */
  key: string;
}

export function canonicalUrl(raw: string | undefined): CanonicalUrl | 'invalid' | null {
  if (!raw || !raw.trim()) return null;
  const text = raw.normalize('NFKC').trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  return {
    href: `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`,
    host,
    key: `${host}${path}`,
  };
}
