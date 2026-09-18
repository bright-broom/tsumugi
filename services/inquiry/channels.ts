/**
 * 通知の実送信アダプタ（ADR 0079）。担当者だけに送る。宛先・鍵は配備先の設定から渡し、リポジトリに置かない。
 *
 * - LINE：Messaging API の push。X-Line-Retry-Key に重複防止の鍵から作った UUID を付け、再送で二重に届かない。
 * - メール：Cloudflare Email Routing の送信（事前に確認した宛先だけに届く方式）。MIME を組み立てて渡す。
 *   同じ通知の再送は同じ Message-ID になり、メールソフト側でまとめられる（送信側に重複防止の仕組みはない）。
 *
 * 設定の誤り（認証・宛先・形式）は再試行しても直らないため PermanentNotificationError にする。
 * 通信障害・429・5xx は一時的な失敗として送信箱の再試行に任せる。
 */
import {
  type NotificationChannel,
  type NotificationMessage,
  PermanentNotificationError,
} from './outbox';

type Fetch = typeof globalThis.fetch;

/** 重複防止の鍵から決まる UUID（SHA-256 の先頭 16 バイトに版と変種を立てる）。 */
export async function uuidFromKey(key: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const LINE_TEXT_LIMIT = 5000;

export function lineChannel(options: {
  channelAccessToken: string;
  /** 通知を受け取る担当者またはグループの ID */
  to: string;
  fetch?: Fetch;
  timeoutMs?: number;
}): NotificationChannel {
  if (!options.channelAccessToken.trim() || !options.to.trim())
    throw new Error('LINE channel needs an access token and a recipient');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    id: 'line',
    async send(message: NotificationMessage, { idempotencyKey }) {
      const text = `${message.subject}\n\n${message.body}`;
      const response = await fetchImpl('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.channelAccessToken}`,
          'content-type': 'application/json',
          'x-line-retry-key': await uuidFromKey(idempotencyKey),
        },
        body: JSON.stringify({
          to: options.to,
          messages: [
            {
              type: 'text',
              text: text.length > LINE_TEXT_LIMIT ? `${text.slice(0, LINE_TEXT_LIMIT - 1)}…` : text,
            },
          ],
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
      await response.body?.cancel();
      // 同じ再送キーの送信は受付済み（409）。二重に届けず、配信済みとして扱う
      if (response.ok || response.status === 409) return;
      if (response.status === 429 || response.status >= 500)
        throw new Error(`LINE push failed temporarily: HTTP ${response.status}`);
      throw new PermanentNotificationError(`LINE push rejected: HTTP ${response.status}`);
    },
  };
}

const ADDRESS = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;

const base64 = (text: string) => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const wrap = (value: string, width = 76) =>
  value.match(new RegExp(`.{1,${width}}`, 'g'))?.join('\r\n') ?? '';

/** UTF-8 の件名・本文を base64 で包んだ、1 通分の RFC 5322 メッセージ。 */
export async function composeMail(options: {
  from: string;
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  date: Date;
}): Promise<string> {
  for (const address of [options.from, options.to])
    if (!ADDRESS.test(address)) throw new PermanentNotificationError('Invalid mail address');
  const domain = options.from.split('@')[1]!;
  return [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: =?UTF-8?B?${base64(options.subject)}?=`,
    `Message-ID: <${await uuidFromKey(options.idempotencyKey)}@${domain}>`,
    `Date: ${options.date.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(base64(options.body)),
    '',
  ].join('\r\n');
}

/** Cloudflare の send_email を包む関数。Worker の入口で EmailMessage を作って渡す。 */
export type SendRawMail = (mail: { from: string; to: string; raw: string }) => Promise<void>;

export function emailChannel(options: {
  from: string;
  to: string;
  sendRaw: SendRawMail;
  now?: () => Date;
}): NotificationChannel {
  if (!ADDRESS.test(options.from) || !ADDRESS.test(options.to))
    throw new Error('Mail channel needs valid from/to addresses');
  const now = options.now ?? (() => new Date());
  return {
    id: 'email',
    async send(message: NotificationMessage, { idempotencyKey }) {
      const raw = await composeMail({
        from: options.from,
        to: options.to,
        subject: message.subject,
        body: message.body,
        idempotencyKey,
        date: now(),
      });
      await options.sendRaw({ from: options.from, to: options.to, raw });
    },
  };
}
