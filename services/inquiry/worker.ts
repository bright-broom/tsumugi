/**
 * Cloudflare Workers の入口（ADR 0079）。Workers 固有の部品（send_email）だけをここで渡す。
 * 処理の本体は app.ts（テスト対象）。設定は wrangler.example.toml を参照。
 */
import { EmailMessage } from 'cloudflare:email';
import { createWorker, type WorkerEnv } from './app';

interface Env extends WorkerEnv {
  /** wrangler の send_email 設定。確認済みの宛先（担当者）だけに送れる */
  NOTIFY_EMAIL: { send(message: EmailMessage): Promise<void> };
}

export default createWorker({
  sendRaw: (env) => async (mail) =>
    (env as Env).NOTIFY_EMAIL.send(new EmailMessage(mail.from, mail.to, mail.raw)),
});
