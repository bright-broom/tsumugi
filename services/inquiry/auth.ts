/**
 * 担当者のログインをサーバーで確定する（ADR 0079、監査 C06）。
 * Cloudflare Access が付ける Cf-Access-Jwt-Assertion を、チームの公開鍵（JWKS）で検証する。
 * 署名・発行元・対象アプリ（aud）・有効期限を確かめ、メールアドレスを担当者 ID に対応付ける。
 * 対応表は配備先の設定に置き、リポジトリに実在のメールアドレスを置かない。
 */

type Fetch = typeof globalThis.fetch;

interface Jwk extends JsonWebKey {
  kid?: string;
}

const decoder = new TextDecoder();

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url');
  const padded =
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const json = (part: string) =>
  JSON.parse(decoder.decode(base64UrlBytes(part))) as Record<string, unknown>;

export interface StaffIdentity {
  staffId: string;
}

export interface AccessVerifierOptions {
  /** 例: example.cloudflareaccess.com */
  teamDomain: string;
  /** Access アプリケーションの AUD タグ */
  audience: string;
  /** 小文字のメールアドレス → 担当者 ID（src/content/inquiry.ts の INQUIRY_STAFF の id） */
  staff: Readonly<Record<string, string>>;
  fetch?: Fetch;
  now?: () => Date;
  /** 公開鍵の保持時間 */
  cacheMs?: number;
}

export function createAccessVerifier(options: AccessVerifierOptions) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(options.teamDomain))
    throw new Error('Access team domain must be <team>.cloudflareaccess.com');
  if (!options.audience.trim()) throw new Error('Access audience is required');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const cacheMs = options.cacheMs ?? 600_000;
  const issuer = `https://${options.teamDomain}`;
  const staff = new Map(
    Object.entries(options.staff).map(([email, id]) => [email.toLowerCase(), id]),
  );
  let cached: { keys: Jwk[]; until: number } | null = null;

  async function keys(force: boolean): Promise<Jwk[]> {
    if (!force && cached && cached.until > now().getTime()) return cached.keys;
    const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Access certs unavailable: HTTP ${response.status}`);
    const body = (await response.json()) as { keys?: Jwk[] };
    cached = { keys: body.keys ?? [], until: now().getTime() + cacheMs };
    return cached.keys;
  }

  /** 検証できた担当者。トークンがない・不正・対応表にない場合は null。 */
  return async function verify(request: Request): Promise<StaffIdentity | null> {
    const token = request.headers.get('cf-access-jwt-assertion');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts as [string, string, string];
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    let signature: Uint8Array<ArrayBuffer>;
    try {
      header = json(h);
      payload = json(p);
      signature = base64UrlBytes(s);
    } catch {
      return null;
    }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    let jwk = (await keys(false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await keys(true)).find((k) => k.kid === header.kid); // 鍵の入れ替え直後
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!valid) return null;

    const seconds = now().getTime() / 1000;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== issuer || !aud.includes(options.audience)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= seconds) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return null;
    if (typeof payload.email !== 'string') return null;
    const staffId = staff.get(payload.email.toLowerCase());
    return staffId ? { staffId } : null;
  };
}
