/**
 * 問い合わせの受け口。Web 標準の Request を受け取り Response を返すだけの関数で、
 * Cloudflare Workers・Vercel Functions・任意の Node サーバーに載せられる（ADR 0032）。
 *
 * 流れ: 方式と形式の確認 → 送信回数の制限 → 入力の検証 → 受付番号の発行と保存 → 通知の開始 → 結果の HTML
 * 保存に失敗したら 503 を返し、利用者に電話とメールの代替導線を示す（受け付けたと誤認させない）。
 */
import { INQUIRY_DUPLICATE_WINDOW_MINUTES, INQUIRY_LIMITS } from '@/content/inquiry';
import type { BusinessCalendar } from './calendar';
import {
  formatLocalDateTime,
  renderAccepted,
  renderInvalid,
  renderLimited,
  renderRejected,
  renderUnavailable,
  type InquiryPresentation,
} from './html';
import { createReceiptId, sha256Hex } from './ids';
import { initialNotifications } from './outbox';
import type { RateLimiter } from './rate-limit';
import type { ChannelId, InquiryRecord, InquiryStore } from './records';
import { createSubmissionParser, telDigits } from './schema';

export interface InquiryHandlerOptions {
  store: InquiryStore;
  presentation: InquiryPresentation;
  calendar: BusinessCalendar;
  channels: readonly ChannelId[];
  rateLimiter?: RateLimiter;
  /** 指定した場合、Origin ヘッダーが別のサイトを示す送信を拒否する */
  allowedOrigins?: readonly string[];
  /** レート制限の鍵にする接続元。配備先のヘッダーから取り出す（例: CF-Connecting-IP） */
  clientAddress?: (request: Request) => string | null;
  now?: () => Date;
  /** 新しく受け付けた記録の通知を始める（例: outbox.dispatch）。応答を待たせない */
  afterAccept?: (record: InquiryRecord) => Promise<unknown>;
  /** 応答後も処理を続けさせる仕組み（Workers の ctx.waitUntil など）。未指定なら待たずに進める */
  schedule?: (task: Promise<unknown>) => void;
  onError?: (error: unknown, stage: 'store' | 'deadline' | 'after-accept') => void;
}

const MINUTE = 60_000;

async function readBody(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createInquiryHandler(options: InquiryHandlerOptions) {
  const { store, presentation: p, calendar } = options;
  const now = options.now ?? (() => new Date());
  const onError = options.onError ?? (() => undefined);
  const parse = createSubmissionParser({
    industries: p.industries,
    industryPlaceholder: p.industryPlaceholder,
  });
  initialNotifications('INQ-CHECK', options.channels, new Date(0)); // 設定の誤りを起動時に止める
  const stylesheetOrigin = p.links.stylesheet ? new URL(p.links.stylesheet).origin : "'none'";

  const respond = (request: Request, body: string, status: number, headers: Record<string, string> = {}) =>
    new Response(body, {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': `default-src 'none'; style-src ${stylesheetOrigin}; form-action ${new URL(request.url).origin}; base-uri 'none'; frame-ancestors 'none'`,
        ...headers,
      },
    });

  return async function handleInquiry(request: Request): Promise<Response> {
    if (request.method !== 'POST')
      return respond(request, renderRejected(p), 405, { allow: 'POST' });

    const origin = request.headers.get('origin');
    // Origin: null（参照元を送らない設定など）は判定できないので拒否しない
    if (options.allowedOrigins && origin && origin !== 'null' && !options.allowedOrigins.includes(origin))
      return respond(request, renderRejected(p), 403);

    const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (type !== 'application/x-www-form-urlencoded')
      return respond(request, renderRejected(p), 415);
    if (Number(request.headers.get('content-length') ?? 0) > INQUIRY_LIMITS.bodyBytes)
      return respond(request, renderRejected(p), 413);
    const body = await readBody(request, INQUIRY_LIMITS.bodyBytes);
    if (!body) return respond(request, renderRejected(p), 413);
    const form = new URLSearchParams(new TextDecoder().decode(body));

    const receivedAt = now();
    if (options.rateLimiter) {
      const key = await sha256Hex(`rate:${options.clientAddress?.(request) ?? 'unknown'}`);
      const decision = await options.rateLimiter.hit(key, receivedAt);
      if (!decision.allowed)
        return respond(request, renderLimited(p, decision), 429, {
          'retry-after': String(decision.retryAfterSeconds),
        });
    }

    const parsed = parse(form);
    if (!parsed.ok)
      return respond(
        request,
        renderInvalid(p, { action: request.url, values: parsed.values, errors: parsed.errors }),
        422,
      );

    let deadline: string | null = null;
    try {
      deadline = calendar.replyDeadline(receivedAt).toISOString();
    } catch (error) {
      onError(error, 'deadline'); // 期限を計算できなくても受付は止めない
    }

    const id = createReceiptId(receivedAt, calendar.config.utcOffsetMinutes);
    const iso = receivedAt.toISOString();
    const { fields } = parsed;
    const disposition = parsed.honeypotFilled ? 'suspected-spam' : 'accepted';
    const record: InquiryRecord = {
      id,
      receivedAt: iso,
      fingerprint: await sha256Hex(
        JSON.stringify([
          fields.name,
          fields.business,
          fields.industry,
          telDigits(fields.tel),
          fields.email?.toLowerCase() ?? null,
          fields.message,
        ]),
      ),
      disposition,
      fields,
      // 迷惑投稿の疑いは担当者に通知せず、返信期限も数えない
      notifications:
        disposition === 'accepted' ? initialNotifications(id, options.channels, receivedAt) : [],
      response: {
        deadline: disposition === 'accepted' ? deadline : null,
        firstReplyAt: null,
        firstReplyChannel: null,
      },
      contract: { status: 'prospect', changedAt: iso, endedAt: null },
      lastActivityAt: iso,
      legalHold: null,
      version: 0,
    };

    let result;
    try {
      result = await store.createOrGetRecent(
        record,
        new Date(receivedAt.getTime() - INQUIRY_DUPLICATE_WINDOW_MINUTES * MINUTE),
      );
    } catch (error) {
      onError(error, 'store');
      return respond(request, renderUnavailable(p, { values: parsed.values }), 503, {
        'retry-after': '300',
      });
    }

    const stored = result.record;
    if (result.created && stored.disposition === 'accepted' && options.afterAccept) {
      const task = options.afterAccept(stored).catch((error) => onError(error, 'after-accept'));
      if (options.schedule) options.schedule(task);
    }

    const shownDeadline = stored.response.deadline ?? deadline;
    return respond(
      request,
      renderAccepted(p, {
        receiptId: stored.id,
        received: formatLocalDateTime(p, calendar, new Date(stored.receivedAt)),
        deadline: shownDeadline ? formatLocalDateTime(p, calendar, new Date(shownDeadline)) : null,
        duplicate: !result.created,
      }),
      200,
    );
  };
}
