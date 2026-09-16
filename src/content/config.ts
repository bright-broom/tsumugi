import { LCP_SECONDS, LCP_PAGE_COUNT, LCP_RECORDED_ON } from '@/content/measurements';
import { getMessages } from '@/i18n/catalog';
const copy = getMessages().config;
import { format } from '@/i18n/format';
/**
 * ブランド設定 ── 連絡先と公開設定。表示用文言は i18n/locales/ja/config.ts に置く。
 */
export const PROFILE = 'campaign' as const; // 両プロファイルとも紬の3色テーマを参照
export const PLACEHOLDER = true; // 本番公開時に false

export const BRAND = copy.brand;
export const BRAND_READING = copy.brandReading;
export const AREA = copy.area;
export const SERVICE_NOTE = copy.serviceNote;
export const DOMAIN = 'example.jp';

export const TEL = copy.phoneNumber;
export const TEL_LINK = TEL.replace(/[^\d+]/g, '');
export const TEL_HOURS = copy.phoneHours;
export const EMAIL = copy.email;
export const LINE_URL = '';
export const CONTACT_METHOD: 'email' | 'form' = 'email';
export const FORM_ENDPOINT = '';
export const EMAIL_LINK = `mailto:${EMAIL}`;

export const LEGAL_NAME = copy.legalName;
export const ADDRESS_REGION = copy.addressRegion;
export const ADDRESS_CITY = copy.addressCity;
export const ADDRESS_STREET = copy.addressStreet;
export const POSTAL_CODE = copy.postalCode;

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

/** 手元での LCP 実測値と記録日。値は `npm run verify -- --write` が書き換える。ビルドのたびに測り直す値ではない */
export const LCP_MEASURED = format(copy.lcpMeasured, {
  seconds: LCP_SECONDS.toFixed(2),
  pages: LCP_PAGE_COUNT,
  recordedOn: LCP_RECORDED_ON,
});

/**
 * 契約・法務表示の承認記録（#39、ADR 0024）。専門家の確認を受けた事業者が記録する。推測で埋めない。
 * - version：承認した文面の版（契約書ひな形の版番号など）
 * - approvedOn：承認日（YYYY-MM-DD）
 * - reviewerRole：確認者の役割
 * - catalogSha256：承認した文面（i18n カタログ）の SHA-256。現在の値は `npm run verify -- --mode production` に出る
 * 4 つが揃うまで terms.html は「弁護士確認前」の注意を出し続け、本番モードの検査は FAIL にする。
 * 承認のあとで文面を変えると SHA-256 が合わなくなり、プレビューでも FAIL にする。
 */
export type LegalDocumentId = 'terms' | 'legal';
export interface LegalApproval {
  version: string | null;
  approvedOn: string | null;
  reviewerRole: 'attorney' | 'other-expert' | null;
  catalogSha256: string | null;
}
export const LEGAL_APPROVALS: Readonly<Record<LegalDocumentId, LegalApproval>> = {
  terms: { version: null, approvedOn: null, reviewerRole: null, catalogSha256: null },
  legal: { version: null, approvedOn: null, reviewerRole: null, catalogSha256: null },
};
export function isApprovalRecorded(approval: LegalApproval): boolean {
  return Object.values(approval).every((v) => typeof v === 'string' && v.trim() !== '');
}

/**
 * このサイト自身のソースコードの公開先（#40、ADR 0027）。2026-09-14 にオーナーが Public のままにすると承認した。
 * 非公開にしたら null にする（works・spec の案内が「公開していません」に切り替わる）。
 * 顧客サイトのソースコードは公開しない（契約した顧客を閲覧権限で招待する）。
 */
export const SOURCE_REPOSITORY_URL: string | null = 'https://github.com/bright-broom/tsumugi';
