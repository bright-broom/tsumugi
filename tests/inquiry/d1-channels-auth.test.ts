import { describe, expect, it } from 'vitest';
import { createAccessVerifier } from '../../services/inquiry/auth';
import {
  composeMail,
  emailChannel,
  lineChannel,
  uuidFromKey,
} from '../../services/inquiry/channels';
import { D1AccessLog, D1InquiryStore, D1RateLimiter } from '../../services/inquiry/d1';
import { PermanentNotificationError } from '../../services/inquiry/outbox';
import { makeRecord } from './fixtures';
import { sqliteD1 } from './sqlite-d1';

describe('D1 の保存先', () => {
  it('同じ内容の再送を期間内は同じ記録に寄せ、期間外は新しく保存する', async () => {
    const store = new D1InquiryStore(sqliteD1());
    const at = '2026-09-15T01:00:00.000Z';
    const first = await store.createOrGetRecent(makeRecord('INQ-1', at), new Date(0));
    expect(first).toMatchObject({ created: true, record: { id: 'INQ-1', version: 1 } });
    const dup = await store.createOrGetRecent(
      makeRecord('INQ-2', '2026-09-15T01:05:00.000Z', { fingerprint: 'fp-INQ-1' }),
      new Date('2026-09-15T00:55:00.000Z'),
    );
    expect(dup).toMatchObject({ created: false, record: { id: 'INQ-1' } });
    const later = await store.createOrGetRecent(
      makeRecord('INQ-3', '2026-09-15T02:00:00.000Z', { fingerprint: 'fp-INQ-1' }),
      new Date('2026-09-15T01:50:00.000Z'),
    );
    expect(later.created).toBe(true);
    await expect(
      store.createOrGetRecent(makeRecord('INQ-1', at, { fingerprint: 'other' }), new Date(0)),
    ).rejects.toThrow();
    expect((await store.list()).map((r) => r.id)).toEqual(['INQ-1', 'INQ-3']);
  });

  it('同時の受付でも同じ内容は1件だけ保存する', async () => {
    const store = new D1InquiryStore(sqliteD1());
    const at = '2026-09-15T01:00:00.000Z';
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        store.createOrGetRecent(makeRecord(`INQ-${n}`, at, { fingerprint: 'same' }), new Date(0)),
      ),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.record.id)).size).toBe(1);
    expect(await store.list()).toHaveLength(1);
  });

  it('version を比べて更新し、途中で別の更新が入ったら読み直す', async () => {
    const db = sqliteD1();
    const store = new D1InquiryStore(db);
    await store.createOrGetRecent(makeRecord('INQ-1', '2026-09-15T01:00:00.000Z'), new Date(0));
    let calls = 0;
    const updated = await store.update('INQ-1', (r) => {
      calls++;
      if (calls === 1)
        db.raw.prepare('UPDATE inquiries SET version = version + 1 WHERE id = ?').run('INQ-1');
      return { ...r, contract: { ...r.contract, status: 'contracted' } };
    });
    expect(calls).toBe(2);
    expect(updated).toMatchObject({ version: 3, contract: { status: 'contracted' } });
    expect(await store.get('INQ-1')).toMatchObject({
      version: 3,
      contract: { status: 'contracted' },
    });
    expect(await store.update('INQ-1', () => undefined)).toMatchObject({ version: 3 });
    expect(await store.update('missing', (r) => r)).toBeUndefined();
    await expect(store.update('INQ-1', (r) => ({ ...r, id: 'other' }))).rejects.toThrow(
      'cannot change',
    );
  });

  it('更新が競合し続けたら保存せずに失敗する', async () => {
    const db = sqliteD1();
    const store = new D1InquiryStore(db);
    await store.createOrGetRecent(makeRecord('INQ-1', '2026-09-15T01:00:00.000Z'), new Date(0));
    await expect(
      store.update('INQ-1', (r) => {
        db.raw.prepare('UPDATE inquiries SET version = version + 1 WHERE id = ?').run('INQ-1');
        return { ...r, legalHold: { reason: 'x', placedAt: r.receivedAt, placedBy: 'member-1' } };
      }),
    ).rejects.toThrow('concurrently');
    expect((await store.get('INQ-1'))!.legalHold).toBeNull();
  });

  it('削除できた件数を返す', async () => {
    const store = new D1InquiryStore(sqliteD1());
    await store.createOrGetRecent(makeRecord('INQ-1', '2026-09-15T01:00:00.000Z'), new Date(0));
    expect(await store.delete('INQ-1')).toBe(true);
    expect(await store.delete('INQ-1')).toBe(false);
    expect(await store.get('INQ-1')).toBeUndefined();
  });
});

describe('D1 の送信回数制限と操作履歴', () => {
  it('窓の中で上限を超えたら拒否し、窓が変われば数え直す', async () => {
    const limiter = new D1RateLimiter(sqliteD1(), { limit: 2, windowMs: 60_000 });
    const t = (s: number) => new Date(Date.UTC(2026, 8, 15, 1, 0, s));
    expect(await limiter.hit('k', t(0))).toEqual({ allowed: true });
    expect(await limiter.hit('k', t(10))).toEqual({ allowed: true });
    expect(await limiter.hit('k', t(20))).toEqual({ allowed: false, retryAfterSeconds: 40 });
    expect(await limiter.hit('other', t(20))).toEqual({ allowed: true });
    expect(await limiter.hit('k', t(60))).toEqual({ allowed: true });
    expect(await limiter.purge(new Date(t(0).getTime() + 200_000))).toBe(2);
  });

  it('操作履歴は追記した順に読める', async () => {
    const log = new D1AccessLog(sqliteD1());
    const event = {
      at: '2026-09-15T01:00:00.000Z',
      actorId: 'member-1',
      permission: 'inquiry:read' as const,
      action: 'list',
      target: null,
      outcome: 'allowed' as const,
      detail: null,
    };
    await log.append(event);
    await log.append({ ...event, action: 'view', target: 'INQ-1', outcome: 'denied' });
    expect(await log.list()).toEqual([
      event,
      { ...event, action: 'view', target: 'INQ-1', outcome: 'denied' },
    ]);
  });
});

describe('通知の実送信', () => {
  const message = {
    receiptId: 'INQ-1',
    channel: 'line' as const,
    subject: '新しいお問い合わせ',
    body: '本文',
  };

  it('LINE は同じ鍵で同じ再送キーを付け、409 を配信済みとみなす', async () => {
    const calls: Request[] = [];
    let status = 200;
    const channel = lineChannel({
      channelAccessToken: 'token',
      to: 'U0',
      fetch: async (input, init) => {
        calls.push(new Request(input, init));
        return new Response('{}', { status });
      },
    });
    await channel.send(message, { idempotencyKey: 'INQ-1:line' });
    status = 409;
    await channel.send(message, { idempotencyKey: 'INQ-1:line' });
    const [a, b] = calls;
    expect(a!.headers.get('x-line-retry-key')).toBe(b!.headers.get('x-line-retry-key'));
    expect(a!.headers.get('x-line-retry-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a!.headers.get('authorization')).toBe('Bearer token');
    expect(await a!.json()).toEqual({
      to: 'U0',
      messages: [{ type: 'text', text: '新しいお問い合わせ\n\n本文' }],
    });
  });

  it('LINE の 429・5xx は再試行、認証や宛先の誤りは再試行しない', async () => {
    const send = (status: number) =>
      lineChannel({
        channelAccessToken: 't',
        to: 'U0',
        fetch: async () => new Response('', { status }),
      }).send(message, {
        idempotencyKey: 'k',
      });
    await expect(send(503)).rejects.not.toBeInstanceOf(PermanentNotificationError);
    await expect(send(429)).rejects.not.toBeInstanceOf(PermanentNotificationError);
    await expect(send(401)).rejects.toBeInstanceOf(PermanentNotificationError);
    await expect(send(400)).rejects.toBeInstanceOf(PermanentNotificationError);
  });

  it('メールは UTF-8 を base64 で包み、同じ通知は同じ Message-ID にする', async () => {
    const date = new Date('2026-09-15T01:00:00.000Z');
    const raw = await composeMail({
      from: 'notify@example.jp',
      to: 'staff@example.jp',
      subject: '件名',
      body: 'あいう\n本文',
      idempotencyKey: 'INQ-1:email',
      date,
    });
    expect(raw).toContain(
      `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode('件名')))}?=`,
    );
    expect(raw).toContain('Content-Transfer-Encoding: base64');
    expect(raw).toContain(`Message-ID: <${await uuidFromKey('INQ-1:email')}@example.jp>`);
    const body = raw.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
    expect(new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)))).toBe(
      'あいう\n本文',
    );
    await expect(
      composeMail({
        from: 'a@example.jp\r\nBcc: x@example.jp',
        to: 'staff@example.jp',
        subject: '',
        body: '',
        idempotencyKey: 'k',
        date,
      }),
    ).rejects.toBeInstanceOf(PermanentNotificationError);

    const sent: { from: string; to: string; raw: string }[] = [];
    await emailChannel({
      from: 'notify@example.jp',
      to: 'staff@example.jp',
      sendRaw: async (m) => void sent.push(m),
      now: () => date,
    }).send({ ...message, channel: 'email' }, { idempotencyKey: 'INQ-1:email' });
    expect(sent[0]).toMatchObject({ from: 'notify@example.jp', to: 'staff@example.jp' });
    expect(() =>
      emailChannel({ from: 'bad', to: 'staff@example.jp', sendRaw: async () => {} }),
    ).toThrow();
  });
});

describe('Cloudflare Access の検証', () => {
  const team = 'sample.cloudflareaccess.com';
  const b64url = (bytes: Uint8Array | string) =>
    btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  async function setup() {
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
    let certCalls = 0;
    const sign = async (payload: Record<string, unknown>, kid = 'k1') => {
      const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
      const body = b64url(JSON.stringify(payload));
      const sig = new Uint8Array(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          pair.privateKey,
          new TextEncoder().encode(`${head}.${body}`),
        ),
      );
      return `${head}.${body}.${b64url(sig)}`;
    };
    const verify = createAccessVerifier({
      teamDomain: team,
      audience: 'aud-1',
      staff: { 'Staff@Example.jp': 'member-1' },
      now: () => new Date('2026-09-15T01:00:00.000Z'),
      fetch: async (input) => {
        certCalls++;
        expect(String(input)).toBe(`https://${team}/cdn-cgi/access/certs`);
        return Response.json({ keys: [jwk] });
      },
    });
    const at = Date.parse('2026-09-15T01:00:00.000Z') / 1000;
    const good = {
      iss: `https://${team}`,
      aud: ['aud-1'],
      email: 'staff@example.jp',
      exp: at + 600,
      nbf: at - 10,
    };
    const req = (token?: string) =>
      new Request('https://inquiry.example.jp/admin', {
        headers: token ? { 'cf-access-jwt-assertion': token } : {},
      });
    return { sign, verify, good, req, certs: () => certCalls };
  }

  it('署名・発行元・対象・期限を確かめ、対応表の担当者だけを通す', async () => {
    const { sign, verify, good, req, certs } = await setup();
    expect(await verify(req(await sign(good)))).toEqual({ staffId: 'member-1' });
    expect(certs()).toBe(1);
    expect(await verify(req(await sign(good)))).toEqual({ staffId: 'member-1' });
    expect(certs()).toBe(1);
    expect(await verify(req())).toBeNull();
    expect(await verify(req(await sign({ ...good, email: 'other@example.jp' })))).toBeNull();
    expect(await verify(req(await sign({ ...good, aud: ['other'] })))).toBeNull();
    expect(
      await verify(req(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' }))),
    ).toBeNull();
    expect(await verify(req(await sign({ ...good, exp: good.exp - 1200 })))).toBeNull();
    expect(await verify(req(await sign(good, 'unknown')))).toBeNull();
    const token = await sign(good);
    const [h, , s] = token.split('.');
    expect(
      await verify(
        req(
          `${h}.${b64url(JSON.stringify({ ...good, email: 'staff@example.jp', aud: 'aud-1' }))}.${s}`,
        ),
      ),
    ).toBeNull();
    expect(await verify(req('not-a-token'))).toBeNull();
  });

  it('チームのドメインと AUD の設定がなければ起動しない', () => {
    expect(() =>
      createAccessVerifier({ teamDomain: 'evil.example.com', audience: 'a', staff: {} }),
    ).toThrow();
    expect(() => createAccessVerifier({ teamDomain: team, audience: ' ', staff: {} })).toThrow();
  });
});
