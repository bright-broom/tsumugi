import { ROUTES } from '@/routing/registry';
import { getMessages } from '@/i18n/catalog';
const copy = getMessages().industries;
import type { BuildKey } from '@/content/prices';

/**
 * 業種別ページの中身。views/industry.tsx が1つのテンプレートで4枚に展開する。
 * 文言の変更は i18n/locales/ja/industries.ts を直す。
 */
export interface Industry {
  name: string;
  h1: string;
  median: string;
  must: [title: string, detail: string][];
  skip: [title: string, detail: string][];
  cost: string;
  plan: BuildKey;
}

export const IND_DATA: Record<string, Industry> = {
  [ROUTES['restaurant'].file]: {
    name: copy.restaurantHtmlName,
    h1: copy.restaurantHtmlH1,
    median: copy.restaurantHtmlMedian,
    must: [
      [copy.restaurantHtmlMust, copy.restaurantHtmlMust2],
      [copy.restaurantHtmlMust3, copy.restaurantHtmlMust4],
      [copy.restaurantHtmlMust5, copy.restaurantHtmlMust6],
      [copy.restaurantHtmlMust7, copy.restaurantHtmlMust8],
      [copy.restaurantHtmlMust9, copy.restaurantHtmlMust10],
    ],
    skip: [[copy.restaurantHtmlSkip, copy.restaurantHtmlSkip2]],
    cost: copy.restaurantHtmlCost,
    plan: 'basic',
  },
  [ROUTES['koumuten'].file]: {
    name: copy.koumutenHtmlName,
    h1: copy.koumutenHtmlH1,
    median: copy.koumutenHtmlMedian,
    must: [
      [copy.koumutenHtmlMust, copy.koumutenHtmlMust2],
      [copy.koumutenHtmlMust3, copy.koumutenHtmlMust4],
      [copy.koumutenHtmlMust5, copy.koumutenHtmlMust6],
      [copy.koumutenHtmlMust7, copy.koumutenHtmlMust8],
      [copy.koumutenHtmlMust9, copy.koumutenHtmlMust10],
    ],
    skip: [
      [copy.koumutenHtmlSkip, copy.koumutenHtmlSkip2],
      [copy.koumutenHtmlSkip3, copy.koumutenHtmlSkip4],
    ],
    cost: copy.koumutenHtmlCost,
    plan: 'standard',
  },
  [ROUTES['salon'].file]: {
    name: copy.salonHtmlName,
    h1: copy.salonHtmlH1,
    median: copy.salonHtmlMedian,
    must: [
      [copy.salonHtmlMust, copy.salonHtmlMust2],
      [copy.salonHtmlMust3, copy.salonHtmlMust4],
      [copy.salonHtmlMust5, copy.salonHtmlMust6],
      [copy.salonHtmlMust7, copy.salonHtmlMust8],
      [copy.salonHtmlMust9, copy.salonHtmlMust10],
    ],
    skip: [[copy.salonHtmlSkip, copy.salonHtmlSkip2]],
    cost: copy.salonHtmlCost,
    plan: 'basic',
  },
  [ROUTES['shigyo'].file]: {
    name: copy.shigyoHtmlName,
    h1: copy.shigyoHtmlH1,
    median: copy.shigyoHtmlMedian,
    must: [
      [copy.shigyoHtmlMust, copy.shigyoHtmlMust2],
      [copy.shigyoHtmlMust3, copy.shigyoHtmlMust4],
      [copy.shigyoHtmlMust5, copy.shigyoHtmlMust6],
      [copy.shigyoHtmlMust7, copy.shigyoHtmlMust8],
      [copy.shigyoHtmlMust9, copy.shigyoHtmlMust10],
    ],
    skip: [[copy.shigyoHtmlSkip, copy.shigyoHtmlSkip2]],
    cost: copy.shigyoHtmlCost,
    plan: 'standard',
  },
};
