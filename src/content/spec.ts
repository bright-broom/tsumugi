import { getMessages } from '@/i18n/catalog';
const copy = getMessages().specData;
import type { IconName } from '@/lib/icons';

/**
 * 納品する仕様の20項目と、売らないと決めた5項目。
 */
export type SpecItemId =
  | 'phone'
  | 'hours'
  | 'address'
  | 'price'
  | 'primary-contact'
  | 'area'
  | 'photos'
  | 'staff'
  | 'cases'
  | 'voices'
  | 'guides'
  | 'mobile-parity'
  | 'lcp'
  | 'first-image'
  | 'no-score-chasing'
  | 'tap-target'
  | 'structured-data'
  | 'business-profile'
  | 'notifications'
  | 'reviews';

/**
 * 項目ごとの確認の方法。ページに表示する。tools/verify/acceptance.ts の対応表から導いた方法と
 * 食い違うと verify が FAIL にする（検査していない項目を「自動検査」と書かない。ADR 0026）。
 * - auto：自動検査だけで確かめる
 * - auto+manual：自動検査と人の確認
 * - manual：人の確認（記録を残す）
 * - external：外部サービスとの接続を、実際に動かした記録か承認記録で確かめる
 */
export type SpecCheckMethod = 'auto' | 'auto+manual' | 'manual' | 'external';

export interface SpecItem {
  id: SpecItemId;
  check: SpecCheckMethod;
  title: string;
  detail: string;
  icon: IconName;
  group: string;
}

export const SPEC_ITEMS: SpecItem[] = [
  {
    id: 'phone',
    check: 'auto+manual',
    title: copy.specItemTitle,
    detail: copy.specItemDetail,
    icon: 'phone',
    group: copy.specItemGroup,
  },
  {
    id: 'hours',
    check: 'auto+manual',
    title: copy.specItemTitle2,
    detail: copy.specItemDetail2,
    icon: 'clock',
    group: copy.specItemGroup,
  },
  {
    id: 'address',
    check: 'auto+manual',
    title: copy.specItemTitle3,
    detail: copy.specItemDetail3,
    icon: 'map-pin',
    group: copy.specItemGroup,
  },
  {
    id: 'price',
    check: 'auto+manual',
    title: copy.specItemTitle4,
    detail: copy.specItemDetail4,
    icon: 'banknote',
    group: copy.specItemGroup,
  },
  {
    id: 'primary-contact',
    check: 'auto+manual',
    title: copy.specItemTitle5,
    detail: copy.specItemDetail5,
    icon: 'target',
    group: copy.specItemGroup,
  },
  {
    id: 'area',
    check: 'manual',
    title: copy.specItemTitle6,
    detail: copy.specItemDetail6,
    icon: 'map',
    group: copy.specItemGroup,
  },
  {
    id: 'photos',
    check: 'auto+manual',
    title: copy.specItemTitle7,
    detail: copy.specItemDetail7,
    icon: 'camera',
    group: copy.specItemGroup2,
  },
  {
    id: 'staff',
    check: 'manual',
    title: copy.specItemTitle8,
    detail: copy.specItemDetail8,
    icon: 'users',
    group: copy.specItemGroup2,
  },
  {
    id: 'cases',
    check: 'manual',
    title: copy.specItemTitle9,
    detail: copy.specItemDetail9,
    icon: 'image',
    group: copy.specItemGroup2,
  },
  {
    id: 'voices',
    check: 'manual',
    title: copy.specItemTitle10,
    detail: copy.specItemDetail10,
    icon: 'star',
    group: copy.specItemGroup2,
  },
  {
    id: 'guides',
    check: 'manual',
    title: copy.specItemTitle11,
    detail: copy.specItemDetail11,
    icon: 'file-text',
    group: copy.specItemGroup2,
  },
  {
    id: 'mobile-parity',
    check: 'auto+manual',
    title: copy.specItemTitle12,
    detail: copy.specItemDetail12,
    icon: 'smartphone',
    group: copy.specItemGroup3,
  },
  {
    id: 'lcp',
    check: 'auto',
    title: copy.specItemTitle13,
    detail: copy.specItemDetail13,
    icon: 'gauge',
    group: copy.specItemGroup3,
  },
  {
    id: 'first-image',
    check: 'auto',
    title: copy.specItemTitle14,
    detail: copy.specItemDetail14,
    icon: 'zap',
    group: copy.specItemGroup3,
  },
  {
    id: 'no-score-chasing',
    check: 'auto+manual',
    title: copy.specItemTitle15,
    detail: copy.specItemDetail15,
    icon: 'percent',
    group: copy.specItemGroup3,
  },
  {
    id: 'tap-target',
    check: 'auto+manual',
    title: copy.specItemTitle16,
    detail: copy.specItemDetail16,
    icon: 'hand-coins',
    group: copy.specItemGroup3,
  },
  {
    id: 'structured-data',
    check: 'auto+manual',
    title: copy.specItemTitle17,
    detail: copy.specItemDetail17,
    icon: 'code-xml',
    group: copy.specItemGroup3,
  },
  {
    id: 'business-profile',
    check: 'external',
    title: copy.specItemTitle18,
    detail: copy.specItemDetail18,
    icon: 'link-2',
    group: copy.specItemGroup4,
  },
  {
    id: 'notifications',
    check: 'external',
    title: copy.specItemTitle19,
    detail: copy.specItemDetail19,
    icon: 'bell',
    group: copy.specItemGroup4,
  },
  {
    id: 'reviews',
    check: 'external',
    title: copy.specItemTitle20,
    detail: copy.specItemDetail20,
    icon: 'star',
    group: copy.specItemGroup4,
  },
];

export const SPEC_GROUP_LEDE: Record<string, string> = {
  [copy.specItemGroup]: copy.groupDescription,
  [copy.specItemGroup2]: copy.groupDescription2,
  [copy.specItemGroup3]: copy.groupDescription3,
  [copy.specItemGroup4]: copy.groupDescription4,
};

export const NOT_SELLING: [name: string, reason: string][] = [
  [copy.notSelling, copy.notSelling2],
  [copy.notSelling3, copy.notSelling4],
  [copy.notSelling5, copy.notSelling6],
  [copy.notSelling7, copy.notSelling8],
  [copy.notSelling9, copy.notSelling10],
];
