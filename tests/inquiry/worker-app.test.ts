import { describe, expect, it } from 'vitest';
import { createWorker, type WorkerEnv } from '../../services/inquiry/app';
import { INQUIRY_FIELDS, INQUIRY_RATE_LIMIT } from '@/content/inquiry';
import { getMessages } from '@/i18n/catalog';
import { sqliteD1 } from './sqlite-d1';

const SITE = 'https://site.example.invalid';
const SERVICE = 'https://inquiry.example.invalid';
const TEAM = 'sample.cloudflareaccess.com';
const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const form = (message = 'Sample inquiry body') =>
  new URLSearchParams({
    [INQUIRY_FIELDS.name]: 'Sample Person',
    [INQUIRY_FIELDS.business]: '',
    [INQUIRY_FIELDS.industry]: getMessages().contact.option,
    [INQUIRY_FIELDS.tel]: '000-0000-0000',
    [INQUIRY_FIELDS.email]: 'sample@example.com',
    [INQUIRY_FIELDS.message]: message,
    [INQUIRY_FIELDS.honeypot]: '',
  });

async function setup() {
  let current = new Date('2026-09-15T01:00:00.000Z');
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const line: Request[] = [];
  let lineStatus = 200;
  const mails: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const db = sqliteD1();
  const env: WorkerEnv = {
    DB: db,
    SITE_ORIGIN: SITE,
    MAIL_FROM: 'notify@example.jp',
    MAIL_TO: 'staff@example.jp',
    LINE_CHANNEL_ACCESS_TOKEN: 'token',
    LINE_TO: 'U0',
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: 'aud-1',
    STAFF_ACCESS: JSON.stringify({
      'admin@example.jp': 'member-1',
      'responder@example.jp': 'member-2',
    }),
  };
  const worker = createWorker({
    sendRaw: () => async (mail) => void mails.push(mail.raw),
    now: () => new Date(current),
    log: (entry) => void logs.push(entry),
    fetch: async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
      if (url === 'https://api.line.me/v2/bot/message/push') {
        line.push(new Request(url, init));
        return new Response('{}', { status: lineStatus });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  const tasks: Promise<unknown>[] = [];
  const ctx = { waitUntil: (task: Promise<unknown>) => void tasks.push(task) };
  const call = async (request: Request) => {
    const response = await worker.fetch(request, env, ctx);
    await Promise.all(tasks.splice(0));
    return response;
  };
  const submit = (body = form(), ip = '192.0.2.1') =>
    call(
      new Request(`${SERVICE}/inquiry`, {
        method: 'POST',
        headers: {
          origin: SITE,
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': ip,
        },
        body,
      }),
    );
  const token = async (email: string) => {
    const at = current.getTime() / 1000;
    const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
    const body = b64url(
      JSON.stringify({ iss: `https://${TEAM}`, aud: ['aud-1'], email, exp: at + 600 }),
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      ),
    );
    return `${head}.${body}.${b64url(sig)}`;
  };
  const admin = async (path: string, email: string | null, init: RequestInit = {}) =>
    call(
      new Request(`${SERVICE}${path}`, {
        ...init,
        headers: {
          ...(email ? { 'cf-access-jwt-assertion': await token(email) } : {}),
          ...(init.headers as Record<string, string>),
        },
      }),
    );
  const post = (path: string, email: string, body: Record<string, string>, origin = SERVICE) =>
    admin(path, email, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
  const records = () =>
    db.raw.prepare('SELECT id, record FROM inquiries').all() as { id: string; record: string }[];
  return {
    env,
    worker,
    call,
    submit,
    admin,
    post,
    records,
    line,
    mails,
    logs,
    setLine: (status: number) => void (lineStatus = status),
    advance: (ms: number) => void (current = new Date(current.getTime() + ms)),
  };
}

describe('受付サービスの Worker', () => {
  it('受け付けて D1 に保存し、メールと LINE の両方へ通知する', async () => {
    const s = await setup();
    const response = await s.submit();
    expect(response.status).toBe(200);
    const [row] = s.records();
    expect(row).toBeDefined();
    expect(await response.text()).toContain(row!.id);
    expect(s.line).toHaveLength(1);
    expect(s.mails).toHaveLength(1);
    expect(s.mails[0]).toContain('To: staff@example.jp');
    const stored = JSON.parse(s.records()[0]!.record);
    expect(stored.notifications.map((n: { status: string }) => n.status)).toEqual([
      'delivered',
      'delivered',
    ]);

    const again = await s.submit();
    expect(again.status).toBe(200);
    expect(s.records()).toHaveLength(1);
    expect(s.line).toHaveLength(1);
    expect((await s.call(new Request(`${SERVICE}/status`))).status).toBe(200);
  });

  it('接続元ごとの送信回数を D1 で数えて制限する', async () => {
    const s = await setup();
    for (let i = 0; i < INQUIRY_RATE_LIMIT.submissions; i++)
      expect((await s.submit(form(`message ${i}`))).status).toBe(200);
    expect((await s.submit(form('one more'))).status).toBe(429);
    expect((await s.submit(form('other address'), '192.0.2.2')).status).toBe(200);
  });

  it('LINE の失敗は再送し、使えなければ状態確認を 503 にする', async () => {
    const s = await setup();
    s.setLine(503);
    await s.submit();
    let stored = JSON.parse(s.records()[0]!.record);
    expect(
      stored.notifications.find((n: { channel: string }) => n.channel === 'line'),
    ).toMatchObject({ status: 'pending', attempts: 1 });
    s.setLine(200);
    s.advance(61_000);
    await s.worker.scheduled({}, s.env);
    stored = JSON.parse(s.records()[0]!.record);
    expect(stored.notifications.every((n: { status: string }) => n.status === 'delivered')).toBe(
      true,
    );
    expect(s.logs.at(-1)).toMatchObject({ event: 'scheduled', delivered: 1 });

    s.setLine(401);
    await s.submit(form('second'));
    const status = await s.call(new Request(`${SERVICE}/status`));
    expect(status.status).toBe(503);
    const body = await status.json();
    expect(body).toEqual({
      ok: false,
      notifications: { 'channel-failed': 1, 'all-channels-failed': 0, delayed: 0 },
    });
    expect(JSON.stringify(body)).not.toContain('Sample');
  });

  it('担当者画面はログインを確かめ、同じ origin からの操作だけを受けて履歴に残す', async () => {
    const s = await setup();
    await s.submit();
    const id = s.records()[0]!.id;
    expect((await s.admin('/admin', null)).status).toBe(401);
    expect((await s.admin('/admin', 'stranger@example.jp')).status).toBe(401);
    const list = await s.admin('/admin', 'admin@example.jp');
    expect(list.status).toBe(200);
    const html = await list.text();
    expect(html).toContain(id);
    expect(html).not.toMatch(/<script/i);
    expect(list.headers.get('content-security-policy')).toContain("default-src 'none'");

    const detail = await s.admin(`/admin/inquiries/${id}`, 'responder@example.jp');
    expect(await detail.text()).toContain('sample@example.com');

    const path = `/admin/inquiries/${id}/reply`;
    expect(
      (await s.post(path, 'responder@example.jp', { channel: 'email' }, 'https://evil.example'))
        .status,
    ).toBe(403);
    const replied = await s.post(path, 'responder@example.jp', { channel: 'email' });
    expect(replied.status).toBe(303);
    expect(JSON.parse(s.records()[0]!.record).response.firstReplyChannel).toBe('email');

    expect((await s.admin('/admin/audit', 'responder@example.jp')).status).toBe(403);
    expect(
      (await s.post(`/admin/inquiries/${id}/hold`, 'responder@example.jp', { reason: '紛争' }))
        .status,
    ).toBe(403);
    const audit = await (await s.admin('/admin/audit', 'admin@example.jp')).text();
    expect(audit).toContain('record-first-reply');
    expect(audit).toContain('denied');

    expect((await s.post(`/admin/inquiries/${id}/erase`, 'admin@example.jp', {})).status).toBe(400);
    expect(
      (await s.post(`/admin/inquiries/${id}/erase`, 'admin@example.jp', { confirm: 'yes' })).status,
    ).toBe(303);
    expect(s.records()).toHaveLength(0);
  });

  it('保持期限は確認画面では削除せず、確認後の実行で削除する', async () => {
    const s = await setup();
    await s.submit();
    s.advance(400 * 86_400_000);
    const preview = await (await s.admin('/admin/retention', 'admin@example.jp')).text();
    expect(preview).toMatch(/削除の対象 ?1 ?件/);
    expect(s.records()).toHaveLength(1);
    expect((await s.post('/admin/retention', 'admin@example.jp', { confirm: 'yes' })).status).toBe(
      200,
    );
    expect(s.records()).toHaveLength(0);
  });

  it('設定が欠けていれば受け付けず 503 を返す', async () => {
    const s = await setup();
    const response = await s.worker.fetch(
      new Request(`${SERVICE}/inquiry`, { method: 'POST' }),
      { ...s.env, LINE_TO: '' },
      { waitUntil: () => {} },
    );
    expect(response.status).toBe(503);
    expect(s.logs.at(-1)).toMatchObject({ event: 'config-error' });
    expect((await s.call(new Request(`${SERVICE}/unknown`))).status).toBe(404);
  });
});
