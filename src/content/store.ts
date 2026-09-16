import * as C from '@/content/config';
import { getMessages, LOCALE } from '@/i18n/catalog';
import { japaneseSpacing } from '@/i18n/typography';
import { dateInZone } from '@/lib/storefront/core';
import { defineStore, type TimeRange } from '@/lib/storefront/store';

const shell = getMessages().shell;
const OFFICE_HOURS: readonly TimeRange[] = [{ opens: '09:00', closes: '18:00' }];

/**
 * 店舗情報の正本（ADR 0048）。JSON-LD（layouts/Base.tsx）と店舗情報の表示が同じ値を使う。
 * 連絡先・所在地の値は content/config.ts から受け取り、ここで二重に持たない。
 *
 * 紬は来店を受けないので visit を持たない（店舗情報・地図の欄は表示しない）。
 * 顧客サイトでは businessType を業種に合わせて選び（BUSINESS_TYPES_BY_INDUSTRY）、
 * 来店を受ける拠点に visit・臨時の案内を足す。表示する文章はカタログに置いて参照する。
 */
export const STORE = defineStore({
  name: C.BRAND,
  description: japaneseSpacing(shell.structuredDataDescription + shell.structuredDataDescription2),
  url: `https://${C.DOMAIN}/`,
  businessType: 'ProfessionalService',
  language: LOCALE.language,
  timeZone: 'Asia/Tokyo',
  areaServed: { type: 'Country', name: shell.areaServedName },
  locations: [
    {
      id: 'main',
      telephone: C.TEL,
      address: {
        postalCode: C.POSTAL_CODE,
        region: C.ADDRESS_REGION,
        locality: C.ADDRESS_CITY,
        street: C.ADDRESS_STREET,
      },
      hours: {
        Monday: OFFICE_HOURS,
        Tuesday: OFFICE_HOURS,
        Wednesday: OFFICE_HOURS,
        Thursday: OFFICE_HOURS,
        Friday: OFFICE_HOURS,
      },
    },
  ],
});

/** ビルドした日（事業者の時間帯）。終わった臨時の案内を表示・JSON-LD から外す基準 */
export const STORE_AS_OF = dateInZone(new Date(), STORE.timeZone);
