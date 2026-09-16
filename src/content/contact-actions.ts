import * as C from '@/content/config';
import { href } from '@/routing/registry';
import {
  CONTACT_PRESETS,
  defineContactPlan,
  resolveContactActions,
} from '@/lib/storefront/contact-actions';

/**
 * 連絡導線の優先順（ADR 0048）。紬はページ内が電話→問い合わせ、
 * 固定バーは LINE を設定したときだけ問い合わせを LINE に替える（従来の表示と同じ）。
 * 顧客サイトでは CONTACT_PRESETS を起点に、実際に対応できる窓口で決める。
 */
const CONTACT_PLAN = defineContactPlan({
  order: CONTACT_PRESETS.default,
  barOrder: ['phone', 'line', 'contact'],
  lineUrl: C.LINE_URL,
  bookingUrl: '',
});

const endpoints = { telLink: C.TEL_LINK, contactPath: href('contact') };

export const CONTACT_ACTIONS = {
  buttons: resolveContactActions(CONTACT_PLAN.order, CONTACT_PLAN, endpoints),
  bar: resolveContactActions(CONTACT_PLAN.barOrder ?? CONTACT_PLAN.order, CONTACT_PLAN, endpoints),
} as const;
