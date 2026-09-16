/**
 * 連絡導線（CTA）の優先順と行き先（ADR 0048）。
 *
 * 表示ラベルは導線の種類（channel）だけから決め、行き先も同じ channel から作る。
 * 予約は外部の予約サービスへのリンクで実現し、独自の予約機能は持たない。
 */
import {
  assertNoErrors,
  duplicates,
  error,
  isHttpsUrl,
  warning,
  type Industry,
  type Issue,
} from '@/lib/storefront/core';

export type ContactChannel = 'phone' | 'contact' | 'line' | 'booking';

export interface ContactPlan {
  /** ページ内の CTA の優先順。先頭が主ボタン */
  order: readonly ContactChannel[];
  /** スマートフォンの固定バーの優先順。省略すると order と同じ */
  barOrder?: readonly ContactChannel[];
  /** LINE 公式アカウントの URL。空なら LINE の導線は出さない */
  lineUrl?: string;
  /** 外部予約サービスの予約ページ。空なら次の導線に替える */
  bookingUrl?: string;
}

export interface ContactEndpoints {
  /** tel: に続ける番号（数字と +） */
  telLink: string;
  /** サイト内の問い合わせページ */
  contactPath: string;
}

export interface ContactAction {
  channel: ContactChannel;
  href: string;
}

/**
 * 業種ごとの初期値。各業種ページで案内している優先順に合わせてある。
 * 顧客が実際に対応できる窓口を確認してから決める（納品仕様の項目5）。
 */
export const CONTACT_PRESETS: Record<Industry | 'default', readonly ContactChannel[]> = {
  restaurant: ['booking', 'phone', 'contact'],
  construction: ['contact', 'phone'],
  salon: ['booking', 'phone', 'contact'],
  professional: ['phone', 'contact'],
  default: ['phone', 'contact'],
};

const LINE_HOSTS = new Set(['line.me', 'lin.ee', 'page.line.me', 'liff.line.me']);
const isLineUrl = (value: string): boolean =>
  isHttpsUrl(value) && LINE_HOSTS.has(new URL(value).hostname);

function destination(
  channel: ContactChannel,
  plan: ContactPlan,
  endpoints: ContactEndpoints,
): string | undefined {
  switch (channel) {
    case 'phone':
      return /^\+?\d{6,}$/.test(endpoints.telLink) ? `tel:${endpoints.telLink}` : undefined;
    case 'contact':
      return endpoints.contactPath || undefined;
    case 'line':
      return plan.lineUrl && isLineUrl(plan.lineUrl) ? plan.lineUrl : undefined;
    case 'booking':
      return plan.bookingUrl && isHttpsUrl(plan.bookingUrl) ? plan.bookingUrl : undefined;
  }
}

/** 未設定の導線を飛ばしたあと、空いた枠は問い合わせ→電話の順で埋める。 */
const FALLBACK: readonly ContactChannel[] = ['contact', 'phone'];

export function resolveContactActions(
  order: readonly ContactChannel[],
  plan: ContactPlan,
  endpoints: ContactEndpoints,
  limit = 2,
): ContactAction[] {
  const actions: ContactAction[] = [];
  for (const channel of [...order, ...FALLBACK]) {
    if (actions.length >= limit) break;
    if (actions.some((action) => action.channel === channel)) continue;
    const href = destination(channel, plan, endpoints);
    if (href) actions.push({ channel, href });
  }
  return actions;
}

export function validateContactPlan(plan: ContactPlan): Issue[] {
  const issues: Issue[] = [];
  const orders = [
    ['order', plan.order],
    ['barOrder', plan.barOrder ?? plan.order],
  ] as const;
  for (const [key, order] of orders) {
    if (!order.length) issues.push(error('contact.empty-order', key));
    for (const channel of duplicates(order))
      issues.push(error('contact.duplicate-channel', `${key}.${channel}`));
  }
  if (plan.lineUrl && !isLineUrl(plan.lineUrl))
    issues.push(error('contact.invalid-line-url', 'lineUrl'));
  if (plan.bookingUrl && !isHttpsUrl(plan.bookingUrl))
    issues.push(error('contact.invalid-booking-url', 'bookingUrl'));
  const used = new Set([...plan.order, ...(plan.barOrder ?? [])]);
  if (used.has('line') && !plan.lineUrl)
    issues.push(warning('contact.line-not-configured', 'lineUrl'));
  if (used.has('booking') && !plan.bookingUrl)
    issues.push(warning('contact.booking-not-configured', 'bookingUrl'));
  return issues;
}

export const defineContactPlan = (plan: ContactPlan): ContactPlan =>
  assertNoErrors(plan, validateContactPlan(plan), 'contact plan');
