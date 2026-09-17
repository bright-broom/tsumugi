/**
 * 公開サイトへの問い合わせ（HTTP・DNS・TLS）を1か所に閉じ込める。
 *
 * 検査の本体（site-checks.ts）はこの Probe だけを使うので、テストでは fetch などを差し替え、
 * 公開前のリハーサルでは out/ を読む模擬配信（distFetch）に差し替えられる。
 */
import { lookup } from 'node:dns/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { checkServerIdentity, connect } from 'node:tls';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface HttpResult {
  url: string;
  status: number;
  location: string | null;
  body: string;
  robotsTag?: string;
  headers?: Readonly<Record<string, string>>;
  /** 要求から本文の受信完了までのミリ秒 */
  ms: number;
}

export interface Certificate {
  /** 信頼できる発行元の連鎖で、かつホスト名と一致する */
  authorized: boolean;
  error: string | null;
  validTo: Date;
  issuer: string;
}

export interface Probe {
  /** false のときは DNS・証明書・HTTP→HTTPS の転送を確かめられない（模擬配信） */
  readonly network: boolean;
  get(url: string): Promise<HttpResult>;
  head(url: string): Promise<HttpResult>;
  lookup(host: string): Promise<string[]>;
  certificate(host: string): Promise<Certificate>;
}

interface ProbeOptions {
  fetch?: Fetch;
  network?: boolean;
  timeoutMs?: number;
  resolveHost?: (host: string) => Promise<string[]>;
  certificate?: (host: string, timeoutMs: number) => Promise<Certificate>;
}

const resolveWithSystem = async (host: string) =>
  (await lookup(host, { all: true })).map((entry) => entry.address);

function readCertificate(host: string, timeoutMs: number): Promise<Certificate> {
  return new Promise((ok, fail) => {
    // 期限切れ・名前不一致でも内容を読んで理由を報告するため、接続自体は拒否しない
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false });
    socket.setTimeout(timeoutMs, () =>
      socket.destroy(new Error(`${timeoutMs}ms で TLS 接続が完了しない`)),
    );
    socket.once('error', fail);
    socket.once('secureConnect', () => {
      const peer = socket.getPeerCertificate();
      socket.end();
      if (!peer.valid_to) return fail(new Error('証明書が返らない'));
      const identity = checkServerIdentity(host, peer);
      const chain = socket.authorizationError ? String(socket.authorizationError) : null;
      const issuer = peer.issuer?.O ?? peer.issuer?.CN ?? '';
      ok({
        authorized: socket.authorized && !identity,
        error: chain ?? identity?.message ?? null,
        validTo: new Date(peer.valid_to),
        issuer: Array.isArray(issuer) ? issuer.join(', ') : issuer,
      });
    });
  });
}

export function createProbe({
  fetch: fetchImpl = globalThis.fetch,
  network = true,
  timeoutMs = 15_000,
  resolveHost = resolveWithSystem,
  certificate = readCertificate,
}: ProbeOptions = {}): Probe {
  return {
    network,
    async get(url) {
      const started = performance.now();
      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'tsumugi-site-check' },
      });
      const body = await response.text();
      return {
        url,
        status: response.status,
        location: response.headers.get('location'),
        body,
        robotsTag: response.headers.get('x-robots-tag') ?? '',
        headers: Object.fromEntries(response.headers.entries()),
        ms: Math.round(performance.now() - started),
      };
    },
    async head(url) {
      const started = performance.now();
      const response = await fetchImpl(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'tsumugi-site-check' },
      });
      await response.body?.cancel();
      return {
        url,
        status: response.status,
        location: response.headers.get('location'),
        body: '',
        headers: Object.fromEntries(response.headers.entries()),
        ms: Math.round(performance.now() - started),
      };
    },
    lookup: resolveHost,
    certificate: (host) => certificate(host, timeoutMs),
  };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/**
 * out/ を静的ホスティングと同じ規則で返す fetch（ソケットを開かない）。
 * `/` は index.html、無いファイルは 404.html を 404 で返す。ディレクトリの外は読まない。
 */
export function distFetch(dir: string): Fetch {
  const root = resolve(dir);
  const find = (pathname: string) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const file = resolve(root, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
    return file.startsWith(root + sep) && existsSync(file) && statSync(file).isFile() ? file : null;
  };
  return async (url) => {
    const file = find(new URL(url).pathname);
    if (file)
      return new Response(new Uint8Array(readFileSync(file)), {
        status: 200,
        headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
      });
    const notFound = join(root, '404.html');
    return new Response(existsSync(notFound) ? readFileSync(notFound, 'utf8') : 'not found', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  };
}
