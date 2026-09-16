import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const ENDPOINT = 'https://inquiry.example.invalid/submit';
// Only this test module sees a configured endpoint; the published build keeps FORM_ENDPOINT empty.
vi.mock('@/content/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/content/config')>()),
  FORM_ENDPOINT: 'https://inquiry.example.invalid/submit',
}));

import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { EMAIL, TEL, TEL_LINK } from '@/content/config';
import { INQUIRY_FIELDS, INQUIRY_LIMITS } from '@/content/inquiry';
import { getMessages } from '@/i18n/catalog';
import { MemoryAccessLog } from '../../services/inquiry/audit';
import { PermanentNotificationError, type NotificationChannel, type NotificationMessage } from '../../services/inquiry/outbox';
import { FixedWindowRateLimiter } from '../../services/inquiry/rate-limit';
import { MemoryInquiryStore, type InquiryStore } from '../../services/inquiry/records';
import { createSiteInquiryService } from '../../services/inquiry/site';
import { clock } from './fixtures';

const copy = getMessages().inquiry;

class RecordingChannel implements NotificationChannel {
  readonly sent: { message: NotificationMessage; idempotencyKey: string }[] = [];
  failWith: Error | null = null;
  constructor(readonly id: 'email' | 'line' | 'sms') {}
  async send(message: NotificationMessage, options: { idempotencyKey: string }) {
    if (this.failWith) throw this.failWith;
    this.sent.push({ message, idempotencyKey: options.idempotencyKey });
  }
}

function contactFormHtml() {
  const html = renderToStaticMarkup(<Page {...pageProps('contact')} />);
  const form = html.match(/<form[\s\S]*?<\/form>/)?.[0];
  if (!form) throw new Error('contact form not rendered');
  return form;
}

/** Fill every named control of the rendered form, so the test breaks if the page and the service drift apart. */
function submissionFromRenderedForm(values: Record<string, string>) {
  const names = [...contactFormHtml().matchAll(/<(?:input|select|textarea)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]!);
  return new URLSearchParams(names.map((name) => [name, values[name] ?? '']));
}

const valid = {
  [INQUIRY_FIELDS.name]: 'Sample <Person>',
  [INQUIRY_FIELDS.business]: '',
  [INQUIRY_FIELDS.industry]: getMessages().contact.option,
  [INQUIRY_FIELDS.tel]: '０００－００００－００００',
  [INQUIRY_FIELDS.email]: 'sample@example.com',
  [INQUIRY_FIELDS.message]: 'Line one\r\nLine two',
};

function setup(options: { store?: InquiryStore; rateLimit?: number } = {}) {
  // 2026-09-15 (Tue) 10:00 JST
  const time = clock('2026-09-15T01:00:00.000Z');
  const store = options.store ?? new MemoryInquiryStore();
  const email = new RecordingChannel('email');
  const line = new RecordingChannel('line');
  const tasks: Promise<unknown>[] = [];
  const errors: string[] = [];
  const service = createSiteInquiryService({
    store,
    notificationChannels: [email, line],
    accessLog: new MemoryAccessLog(),
    siteOrigin: 'https://site.example.invalid',
    allowedOrigins: ['https://site.example.invalid'],
    rateLimiter: options.rateLimit
      ? new FixedWindowRateLimiter({ limit: options.rateLimit, windowMs: 60_000 })
      : undefined,
    clientAddress: () => '192.0.2.1',
    now: time.now,
    schedule: (task) => tasks.push(task),
    onError: (_, stage) => errors.push(stage),
  });
  const post = (body: URLSearchParams | string, headers: Record<string, string> = {}) =>
    service.handler(
      new Request(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://site.example.invalid',
          ...headers,
        },
        body: typeof body === 'string' ? body : body.toString(),
      }),
    );
  const settle = () => Promise.all(tasks.splice(0));
  return { service, store, email, line, post, settle, time, errors };
}

afterEach(() => vi.restoreAllMocks());

describe('contact form with a configured endpoint', () => {
  it('posts to the endpoint with an enabled button and a hidden, labelled honeypot, still without scripts', () => {
    const form = contactFormHtml();
    expect(form).toContain(`action="${ENDPOINT}"`);
    expect(form).toContain('method="post"');
    expect(form).not.toContain('disabled');
    const honeypot = form.match(/<div hidden="">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(honeypot).toMatch(/^<label for="f-hp">[^<]+<\/label><input [^>]+\/>$/);
    for (const attribute of ['type="text"', 'id="f-hp"', `name="${INQUIRY_FIELDS.honeypot}"`, 'tabindex="-1"', 'autoComplete="off"'])
      expect(honeypot).toContain(attribute);
    expect(renderToStaticMarkup(<Page {...pageProps('contact')} />)).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
  });
});

describe('inquiry intake', () => {
  it('accepts a submission from the rendered form, stores it and notifies both channels', async () => {
    const { post, store, email, line, settle } = setup();
    const response = await post(submissionFromRenderedForm(valid));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    const html = await response.text();
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain(copy.headingAccepted);
    const id = html.match(/INQ-20260915-[0-9A-Z]{8}/)?.[0];
    expect(id).toBeDefined();
    // Alternatives are always offered.
    expect(html).toContain(`href="tel:${TEL_LINK}"`);
    expect(html).toContain(TEL);
    expect(html).toContain(`href="mailto:${EMAIL}"`);
    // Reply deadline: one business day after Tue 10:00 JST is Wed 10:00 JST.
    expect(html).toContain('2026 年 9 月 16 日 10:00');

    const [record] = await store.list();
    expect(record).toMatchObject({
      id,
      disposition: 'accepted',
      fields: {
        name: 'Sample <Person>',
        business: null,
        industry: null,
        tel: '000-0000-0000',
        email: 'sample@example.com',
        message: 'Line one\nLine two',
      },
      response: { deadline: '2026-09-16T01:00:00.000Z', firstReplyAt: null },
    });

    await settle();
    expect(email.sent).toHaveLength(1);
    expect(line.sent).toHaveLength(1);
    expect(email.sent[0]!.idempotencyKey).toBe(`${id}:email`);
    expect(email.sent[0]!.message.body).toContain('Line one\nLine two');
    // Short channels carry the receipt id and deadline only, never the inquiry content.
    expect(line.sent[0]!.message.body).toContain(id);
    for (const secret of ['Sample', '000-0000-0000', 'example.com', 'Line one'])
      expect(line.sent[0]!.message.body).not.toContain(secret);
    expect((await store.get(id!))!.notifications.map((n) => n.status)).toEqual(['delivered', 'delivered']);
  });

  it('keeps the inquiry when one notification channel is down', async () => {
    const { post, store, email, line, settle, errors } = setup();
    line.failWith = new Error('provider unavailable');
    const response = await post(submissionFromRenderedForm(valid));
    expect(response.status).toBe(200);
    await settle();
    const [record] = await store.list();
    expect(email.sent).toHaveLength(1);
    expect(record!.notifications).toMatchObject([
      { channel: 'email', status: 'delivered', attempts: 1 },
      { channel: 'line', status: 'pending', attempts: 1, lastError: 'Error: provider unavailable' },
    ]);
    expect(errors).toEqual([]);
  });

  it('folds a resubmission of the same content into the same receipt id and notifies once', async () => {
    const { post, store, email, settle, time } = setup();
    const first = (await (await post(submissionFromRenderedForm(valid))).text()).match(/INQ-[\w-]+/)![0];
    await settle();
    time.advance(5 * 60_000);
    const againHtml = await (await post(submissionFromRenderedForm(valid))).text();
    await settle();
    expect(againHtml).toContain(first);
    expect(againHtml).toContain(copy.duplicateNote);
    expect(await store.list()).toHaveLength(1);
    expect(email.sent).toHaveLength(1);

    time.advance(6 * 60_000);
    const later = await (await post(submissionFromRenderedForm(valid))).text();
    expect(later).not.toContain(first);
    expect(await store.list()).toHaveLength(2);
  });

  it('returns a correction form for invalid input without storing anything', async () => {
    const { post, store } = setup();
    const response = await post(
      submissionFromRenderedForm({
        ...valid,
        [INQUIRY_FIELDS.name]: '   ',
        [INQUIRY_FIELDS.tel]: '12345',
        [INQUIRY_FIELDS.email]: 'not-an-address',
        [INQUIRY_FIELDS.industry]: 'unknown industry',
        [INQUIRY_FIELDS.message]: `<script>alert(1)</script>${'x'.repeat(INQUIRY_LIMITS.message)}`,
      }),
    );
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(html).toContain(copy.headingInvalid);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    for (const id of ['f-name', 'f-tel', 'f-mail', 'f-ind', 'f-msg'])
      expect(html).toContain(`id="${id}" name=`);
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(5);
    expect(html).toContain(copy.errorTel);
    expect(html).toContain(copy.errorEmail);
    expect(html).toContain(copy.errorIndustry);
    expect(html).toContain(`action="${ENDPOINT}"`);
    expect(html).toContain('value="not-an-address"');
    expect(await store.list()).toEqual([]);
  });

  it('quarantines honeypot submissions without notifying staff', async () => {
    const { post, store, email, line, settle } = setup();
    const response = await post(
      submissionFromRenderedForm({ ...valid, [INQUIRY_FIELDS.honeypot]: 'https://spam.example.invalid' }),
    );
    expect(response.status).toBe(200);
    await settle();
    const [record] = await store.list();
    expect(record).toMatchObject({ disposition: 'suspected-spam', notifications: [], response: { deadline: null } });
    expect(email.sent).toEqual([]);
    expect(line.sent).toEqual([]);
  });

  it('tells the user the inquiry was not saved when the store fails, offering phone and email', async () => {
    const failing: InquiryStore = {
      ...new MemoryInquiryStore(),
      createOrGetRecent: async () => {
        throw new Error('database offline');
      },
      get: async () => undefined,
      update: async () => undefined,
      list: async () => [],
      delete: async () => false,
    };
    const { post, email, settle, errors } = setup({ store: failing });
    const response = await post(submissionFromRenderedForm(valid));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('300');
    const html = await response.text();
    expect(html).toContain(copy.headingUnavailable);
    expect(html).not.toMatch(/INQ-/);
    expect(html).toContain(`href="tel:${TEL_LINK}"`);
    expect(html).toContain(`href="mailto:${EMAIL}"`);
    expect(html).toContain('Line one\nLine two');
    await settle();
    expect(email.sent).toEqual([]);
    expect(errors).toEqual(['store']);
  });

  it('limits bursts per client with a retry hint', async () => {
    const { post } = setup({ rateLimit: 2 });
    for (const message of ['one', 'two'])
      expect((await post(submissionFromRenderedForm({ ...valid, [INQUIRY_FIELDS.message]: message }))).status).toBe(200);
    const limited = await post(submissionFromRenderedForm(valid));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await limited.text()).toContain(`href="tel:${TEL_LINK}"`);
  });

  it('rejects other methods, content types, oversized bodies and foreign origins', async () => {
    const { service, post, store } = setup();
    const get = await service.handler(new Request(ENDPOINT));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    expect((await post('{}', { 'content-type': 'application/json' })).status).toBe(415);
    expect((await post(`message=${'x'.repeat(INQUIRY_LIMITS.bodyBytes)}`)).status).toBe(413);
    expect((await post(submissionFromRenderedForm(valid), { origin: 'https://other.example.invalid' })).status).toBe(403);
    expect(await store.list()).toEqual([]);
  });

  it('treats permanent provider errors as failures that are reported, not retried', async () => {
    const alerts: string[] = [];
    const store = new MemoryInquiryStore();
    const email = new RecordingChannel('email');
    const line = new RecordingChannel('line');
    line.failWith = new PermanentNotificationError('recipient not configured');
    const tasks: Promise<unknown>[] = [];
    const service = createSiteInquiryService({
      store,
      notificationChannels: [email, line],
      accessLog: new MemoryAccessLog(),
      now: () => new Date('2026-09-15T01:00:00.000Z'),
      schedule: (task) => tasks.push(task),
      onAlert: (alert) => alerts.push(alert.kind),
    });
    const response = await service.handler(
      new Request(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: submissionFromRenderedForm(valid).toString(),
      }),
    );
    expect(response.status).toBe(200);
    await Promise.all(tasks);
    expect(alerts).toEqual(['channel-failed']);
    expect((await store.list())[0]!.notifications[1]).toMatchObject({ status: 'failed', attempts: 1 });
  });
});
