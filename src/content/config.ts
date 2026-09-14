import { LCP_SECONDS, LCP_PAGE_COUNT } from '@/content/measurements';
import { getMessages } from '@/i18n/catalog';
const copy = getMessages().config;
import { format } from '@/i18n/format';
/**
 * ブランド設定 ── 連絡先と公開設定。表示用文言は i18n/locales/ja/config.ts に置く。
 */
export const PROFILE = 'campaign' as const; // campaign=緑 / main=青
export const PLACEHOLDER = true; // 本番公開時に false

export const BRAND = copy.brand;
export const BRAND_READING = copy.brandReading;
export const AREA = copy.area;
export const SERVICE_NOTE = copy.serviceNote;
export const DOMAIN = 'example.jp';

export const TEL = '000-0000-0000';
export const TEL_LINK = TEL.replace(/[^\d+]/g, '');
export const TEL_HOURS = copy.phoneHours;
export const EMAIL = 'info@example.jp';
export const LINE_URL = '';
export const FORM_ENDPOINT = '';

export const LEGAL_NAME = copy.legalName;
export const ADDRESS_REGION = copy.addressRegion;
export const ADDRESS_CITY = copy.addressCity;
export const ADDRESS_STREET = copy.addressStreet;
export const POSTAL_CODE = '000-0000';

export const RESPONSE_PROMISE = copy.responsePromise;
export const RESPONSE_ACTUAL: string | null = null;

export const MEMBERS = [
  {
    role: copy.memberRole,
    name: copy.memberName,
    bio: copy.memberBio + copy.memberBio2,
  },
  {
    role: copy.memberRole2,
    name: copy.partnerName,
    bio: copy.memberBio3,
  },
] as const;

/** title・フッター用。一文字の屋号なので読みを括弧で添える */
export const BRAND_T = BRAND_READING
  ? format(copy.brandWithReading, { brand: BRAND, brandReading: BRAND_READING })
  : BRAND;

/** LCP 実測値。`npm run verify -- --write` が書き換える。手で書かない */
export const LCP_MEASURED = format(copy.lcpMeasured, {
  seconds: LCP_SECONDS.toFixed(2),
  pages: LCP_PAGE_COUNT,
});
