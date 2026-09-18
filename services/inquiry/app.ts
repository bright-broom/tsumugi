/**
 * Cloudflare Workers に載せる受付サービス（ADR 0079）。worker.ts が Workers 固有の部品を渡して使う。
 *
 * - POST /inquiry：受付（保存 → 二重通知の開始 → 結果の画面）
 * - GET  /status：通知の失敗・遅延があれば 503。件数の区分だけを返し、個人情報を返さない（外部監視用）
 * - /admin：担当者の画面（Cloudflare Access のログインを検証してから）
 * - 定期実行：期限の来た通知の送信・再送、失敗と遅延の記録、送信回数の古い窓の削除
 *
 * 宛先・鍵・担当者の対応表は Workers の変数と Secret に置き、リポジトリに置かない。
 */
import { INQUIRY_RATE_LIMIT } from '@/content/inquiry';
import { createAdminRoutes } from './admin';
import { createAccessVerifier } from './auth';
import { emailChannel, lineChannel, type SendRawMail } from './channels';
import { D1AccessLog, D1InquiryStore, D1RateLimiter, type D1Database } from './d1';
import type { OutboxAlert } from './outbox';
import { createSiteInquiryService } from './site';

export interface WorkerEnv {
  DB: D1Database;
  /** 問い合わせフォームを置くサイト（https://<ドメイン>） */
  SITE_ORIGIN: string;
  /** フォームを置くほかのサイト。カンマ区切りの origin */
  ALLOWED_ORIGINS?: string;
  MAIL_FROM: string;
  MAIL_TO: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_TO: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** JSON：{"メールアドレス": "member-1"} */
  STAFF_ACCESS: string;
}

export interface WorkerContext {
  waitUntil(task: Promise<unknown>): void;
}

type Log = (entry: Record<string, unknown>) => void;

export interface WorkerDeps {
  /** Cloudflare の send_email で 1 通送る関数。環境ごとに作る */
  sendRaw: (env: WorkerEnv) => SendRawMail;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  log?: Log;
}

function required(env: WorkerEnv, name: keyof WorkerEnv): string {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Missing worker setting: ${name}`);
  return value.trim();
}

function staffMap(raw: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('STAFF_ACCESS must be a JSON object of email to staff id');
  for (const value of Object.values(parsed))
    if (typeof value !== 'string') throw new Error('STAFF_ACCESS values must be staff ids');
  return parsed as Record<string, string>;
}

/** 通知の失敗・遅延を区分ごとに数える。受付番号・内容は外へ出さない */
function countAlerts(alerts: readonly OutboxAlert[]) {
  const counts: Record<OutboxAlert['kind'], number> = {
    'channel-failed': 0,
    'all-channels-failed': 0,
    delayed: 0,
  };
  for (const a of alerts) counts[a.kind] += 1;
  return counts;
}

export function createWorker(deps: WorkerDeps) {
  const now = deps.now ?? (() => new Date());
  const log: Log = deps.log ?? ((entry) => console.error(JSON.stringify(entry)));

  function build(env: WorkerEnv, ctx?: WorkerContext) {
    const siteOrigin = new URL(required(env, 'SITE_ORIGIN')).origin;
    const store = new D1InquiryStore(env.DB);
    const rateLimiter = new D1RateLimiter(env.DB, {
      limit: INQUIRY_RATE_LIMIT.submissions,
      windowMs: INQUIRY_RATE_LIMIT.windowMinutes * 60_000,
    });
    const extra = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const service = createSiteInquiryService({
      store,
      accessLog: new D1AccessLog(env.DB),
      siteOrigin,
      allowedOrigins: [siteOrigin, ...extra],
      rateLimiter,
      clientAddress: (request) => request.headers.get('cf-connecting-ip'),
      notificationChannels: [
        emailChannel({
          from: required(env, 'MAIL_FROM'),
          to: required(env, 'MAIL_TO'),
          sendRaw: deps.sendRaw(env),
          now,
        }),
        lineChannel({
          channelAccessToken: required(env, 'LINE_CHANNEL_ACCESS_TOKEN'),
          to: required(env, 'LINE_TO'),
          fetch: deps.fetch,
        }),
      ],
      now,
      ...(ctx ? { schedule: (task: Promise<unknown>) => ctx.waitUntil(task) } : {}),
      onError: (error, stage) =>
        log({
          event: 'inquiry-error',
          stage,
          error: error instanceof Error ? error.name : 'Error',
        }),
      onAlert: (alert) => log({ event: 'notification-alert', kind: alert.kind }),
    });
    return { service, rateLimiter };
  }

  return {
    async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
      const path = new URL(request.url).pathname;
      let parts;
      try {
        parts = build(env, ctx);
      } catch (error) {
        log({ event: 'config-error', error: error instanceof Error ? error.message : 'Error' });
        return new Response('Service unavailable', {
          status: 503,
          headers: { 'retry-after': '300' },
        });
      }
      if (path === '/inquiry') return parts.service.handler(request);
      if (path === '/status' && request.method === 'GET') {
        const counts = countAlerts(await parts.service.outbox.inspect());
        const ok = Object.values(counts).every((n) => n === 0);
        return new Response(JSON.stringify({ ok, notifications: counts }), {
          status: ok ? 200 : 503,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      if (path === '/admin' || path.startsWith('/admin/')) {
        const admin = createAdminRoutes({
          desk: parts.service.desk,
          verify: createAccessVerifier({
            teamDomain: required(env, 'ACCESS_TEAM_DOMAIN'),
            audience: required(env, 'ACCESS_AUD'),
            staff: staffMap(required(env, 'STAFF_ACCESS')),
            fetch: deps.fetch,
            now,
          }),
          now,
        });
        return (await admin(request))!;
      }
      return new Response('Not found', { status: 404 });
    },

    /** Cron Trigger から呼ぶ。1 回の失敗が次の処理を止めないよう、段階ごとに記録する */
    async scheduled(_controller: unknown, env: WorkerEnv): Promise<void> {
      const { service, rateLimiter } = build(env);
      const outcomes = await service.outbox.dispatchDue();
      const alerts = await service.outbox.inspect();
      const purged = await rateLimiter.purge(now());
      log({
        event: 'scheduled',
        dispatched: outcomes.length,
        delivered: outcomes.filter((o) => o.result === 'delivered').length,
        alerts: countAlerts(alerts),
        purgedRateWindows: purged,
      });
    },
  };
}
