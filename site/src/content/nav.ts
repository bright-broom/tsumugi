import type { IconName } from '@/lib/icons';

export const NAV_IC: Record<string, IconName> = {
  'index.html': 'circle-dollar-sign', 'owned.html': 'key', 'price.html': 'calculator',
  'unlimited.html': 'repeat-2', 'source.html': 'code-xml',
  'cost-cut.html': 'trending-down', 'subsidy.html': 'hand-coins',
  'spec.html': 'list-checks', 'flow.html': 'route', 'works.html': 'image',
  'faq.html': 'circle-help', 'about.html': 'users', 'contact.html': 'message-circle',
  'terms.html': 'scroll-text', 'privacy.html': 'shield', 'legal.html': 'landmark',
};

export const NAV: [string, string][] = [
  ['index.html', 'ホーム'], ['owned.html', '借地と所有'], ['price.html', '料金'],
  ['unlimited.html', '変更は何回でも'], ['source.html', 'ソースコードの納品'],
  ['cost-cut.html', '掲載費の見直し'], ['subsidy.html', '補助金'],
  ['spec.html', '納品する仕様'], ['flow.html', '制作の流れ'], ['works.html', '制作事例'],
  ['faq.html', 'よくあるご質問'], ['about.html', '私たちについて'], ['contact.html', '相談する'],
];

/** C01 の階層入口。ヘッダーに入るのは4本だけ。先頭は1番の主張に使う */
export const NAV_MAIN: [string, string][] = [
  ['owned.html', '借地と所有'], ['price.html', '料金'],
  ['cost-cut.html', '掲載費の見直し'], ['subsidy.html', '補助金'],
];

export const NAV_LEGAL: [string, string][] = [
  ['terms.html', 'ご契約とお約束'], ['privacy.html', '個人情報の取り扱い'],
  ['legal.html', '特定商取引法に基づく表記'],
];

export const INDUSTRIES: [string, string, string][] = [
  ['restaurant.html', '飲食店', 'メニューと写真と予約導線。食べログの掲載費の見直しまで。'],
  ['koumuten.html', '工務店・建設', '施工事例が増えていく設計。問い合わせフォームが主役。'],
  ['salon.html', '美容室・サロン', '全メニューの料金表と予約導線。掲載費の棚卸しから。'],
  ['shigyo.html', '士業・専門事務所', '料金を明示して、人柄が伝わること。電話を最上部に。'],
];

export const IND_IC: Record<string, IconName> = {
  'restaurant.html': 'utensils-crossed', 'koumuten.html': 'hammer',
  'salon.html': 'scissors', 'shigyo.html': 'scale',
};
