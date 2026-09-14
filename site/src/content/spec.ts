import { getMessages } from '@/i18n/catalog';
const copy = getMessages().specData;
import type { IconName } from '@/lib/icons';

/**
 * 納品する仕様の20項目と、売らないと決めた5項目。
 */
export interface SpecItem {
  title: string;
  detail: string;
  icon: IconName;
  group: string;
}

export const SPEC_ITEMS: SpecItem[] = [
  {
    title: copy.specItemTitle,
    detail: copy.specItemDetail,
    icon: 'phone',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle2,
    detail: copy.specItemDetail2,
    icon: 'clock',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle3,
    detail: copy.specItemDetail3,
    icon: 'map-pin',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle4,
    detail: copy.specItemDetail4,
    icon: 'banknote',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle5,
    detail: copy.specItemDetail5,
    icon: 'target',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle6,
    detail: copy.specItemDetail6,
    icon: 'map',
    group: copy.specItemGroup,
  },
  {
    title: copy.specItemTitle7,
    detail: copy.specItemDetail7,
    icon: 'camera',
    group: copy.specItemGroup2,
  },
  {
    title: copy.specItemTitle8,
    detail: copy.specItemDetail8,
    icon: 'users',
    group: copy.specItemGroup2,
  },
  {
    title: copy.specItemTitle9,
    detail: copy.specItemDetail9,
    icon: 'image',
    group: copy.specItemGroup2,
  },
  {
    title: copy.specItemTitle10,
    detail: copy.specItemDetail10,
    icon: 'star',
    group: copy.specItemGroup2,
  },
  {
    title: copy.specItemTitle11,
    detail: copy.specItemDetail11,
    icon: 'file-text',
    group: copy.specItemGroup2,
  },
  {
    title: copy.specItemTitle12,
    detail: copy.specItemDetail12,
    icon: 'smartphone',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle13,
    detail: copy.specItemDetail13,
    icon: 'gauge',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle14,
    detail: copy.specItemDetail14,
    icon: 'zap',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle15,
    detail: copy.specItemDetail15,
    icon: 'percent',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle16,
    detail: copy.specItemDetail16,
    icon: 'hand-coins',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle17,
    detail: copy.specItemDetail17,
    icon: 'code-xml',
    group: copy.specItemGroup3,
  },
  {
    title: copy.specItemTitle18,
    detail: copy.specItemDetail18,
    icon: 'link-2',
    group: copy.specItemGroup4,
  },
  {
    title: copy.specItemTitle19,
    detail: copy.specItemDetail19,
    icon: 'bell',
    group: copy.specItemGroup4,
  },
  {
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
