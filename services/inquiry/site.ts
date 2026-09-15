/**
 * このサイト（紬）の設定・文言で受付サービスを組み立てる入口。
 * 配備先のエントリ（Workers の fetch、Vercel Functions、Node サーバー）は、保存先・送信アダプタ・
 * 履歴の保存先を用意してこの関数を呼ぶ。ここでは実際の送信先や鍵を持たない（ADR 0032）。
 */
import { BUSINESS_CALENDAR } from '@/content/business-calendar';
import { BRAND_T, DOMAIN, EMAIL, RESPONSE_PROMISE, TEL, TEL_HOURS, TEL_LINK } from '@/content/config';
import {
  INQUIRY_FIELDS,
  INQUIRY_NOTIFICATION_CHANNELS,
  INQUIRY_RETENTION,
  INQUIRY_STAFF,
} from '@/content/inquiry';
import { INDUSTRIES } from '@/content/nav';
import { LOCALE, getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { href } from '@/routing/registry';
import { createInquiryDesk } from './access';
import type { AccessLog } from './audit';
import { createBusinessCalendar, type BusinessCalendar } from './calendar';
import { createInquiryHandler, type InquiryHandlerOptions } from './handler';
import { formatLocalDateTime, type InquiryPresentation } from './html';
import { createOutbox, type NotificationChannel, type NotificationMessage, type OutboxAlert } from './outbox';
import type { ChannelId, InquiryRecord, InquiryStore } from './records';

function presentation(siteOrigin: string): InquiryPresentation {
  const messages = getMessages();
  const origin = siteOrigin.replace(/\/$/, '');
  return {
    language: LOCALE.language,
    brand: BRAND_T,
    copy: messages.inquiry,
    form: messages.contact,
    contact: {
      tel: TEL,
      telLink: TEL_LINK,
      telHours: TEL_HOURS,
      email: EMAIL,
      responsePromise: RESPONSE_PROMISE,
    },
    links: {
      site: `${origin}${href('index')}`,
      contact: `${origin}${href('contact')}`,
      stylesheet: `${origin}/theme.css`,
    },
    industries: [...INDUSTRIES.map(([, name]) => name), messages.contact.option2],
    industryPlaceholder: messages.contact.option,
    honeypotField: INQUIRY_FIELDS.honeypot,
  };
}

/** 担当者向けの通知文。メールには内容を載せ、LINE・SMS には受付番号と期限だけを載せる */
function composer(p: InquiryPresentation, calendar: BusinessCalendar) {
  return (record: InquiryRecord, channel: ChannelId): NotificationMessage => {
    const { copy, form } = p;
    const deadline = record.response.deadline
      ? formatLocalDateTime(p, calendar, new Date(record.response.deadline))
      : null;
    const subject = format(copy.notificationSubject, { receiptId: record.id });
    if (channel !== 'email')
      return {
        receiptId: record.id,
        channel,
        subject,
        body: format(copy.notificationShort, {
          receiptId: record.id,
          deadline: deadline ?? p.contact.responsePromise,
        }),
      };
    const value = (v: string | null) => v ?? copy.notificationNotProvided;
    const f = record.fields;
    const lines = [
      format(copy.notificationReceived, {
        received: formatLocalDateTime(p, calendar, new Date(record.receivedAt)),
      }),
      deadline ? format(copy.notificationDeadline, { deadline }) : copy.notificationNoDeadline,
      '',
      ...(
        [
          [form.label, f.name],
          [form.label2, f.business],
          [form.label3, f.industry],
          [form.label4, f.tel],
          [form.label5, f.email],
        ] as const
      ).map(([label, v]) => `${label}: ${value(v)}`),
      '',
      `${form.label6}:`,
      f.message,
    ];
    return { receiptId: record.id, channel, subject, body: lines.join('\n') };
  };
}

export interface SiteInquiryServiceOptions
  extends Pick<
    InquiryHandlerOptions,
    'rateLimiter' | 'allowedOrigins' | 'clientAddress' | 'schedule' | 'onError'
  > {
  store: InquiryStore;
  notificationChannels: readonly NotificationChannel[];
  accessLog: AccessLog;
  siteOrigin?: string;
  now?: () => Date;
  onAlert?: (alert: OutboxAlert) => void;
}

export function createSiteInquiryService(options: SiteInquiryServiceOptions) {
  const now = options.now ?? (() => new Date());
  const calendar = createBusinessCalendar(BUSINESS_CALENDAR);
  const p = presentation(options.siteOrigin ?? `https://${DOMAIN}`);
  const outbox = createOutbox({
    store: options.store,
    channels: options.notificationChannels,
    compose: composer(p, calendar),
    now,
    onAlert: options.onAlert,
  });
  const handler = createInquiryHandler({
    ...options,
    presentation: p,
    calendar,
    channels: INQUIRY_NOTIFICATION_CHANNELS,
    now,
    afterAccept: (record) => outbox.dispatch(record.id),
  });
  const desk = createInquiryDesk({
    store: options.store,
    roster: INQUIRY_STAFF,
    log: options.accessLog,
    policy: INQUIRY_RETENTION,
    now,
  });
  return { handler, outbox, desk, calendar };
}
