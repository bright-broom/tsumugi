/**
 * 書面の発行者欄。屋号・氏名・所在地・連絡先は公開サイトと同じ正本（src/content/config.ts）から作る。
 * 公開済みの特定商取引法の表記と同じ値だけを使い、書面ごとに手入力しない。
 */
import {
  ADDRESS_CITY,
  ADDRESS_REGION,
  ADDRESS_STREET,
  BRAND,
  EMAIL,
  LEGAL_NAME,
  POSTAL_CODE,
  TEL,
} from '@/content/config';

export interface Issuer {
  brand: string;
  legalName: string;
  address: string;
  tel: string;
  email: string;
}

export function siteIssuer(): Issuer {
  return {
    brand: BRAND,
    legalName: LEGAL_NAME,
    address: `〒${POSTAL_CODE} ${ADDRESS_REGION}${ADDRESS_CITY}${ADDRESS_STREET}`,
    tel: TEL,
    email: EMAIL,
  };
}

/** 書面の表に入れる発行者の行。 */
export const issuerRows = (issuer: Issuer): string[][] => [
  ['発行者', `${issuer.brand}（${issuer.legalName}）`],
  ['所在地', issuer.address],
  ['電話', issuer.tel],
  ['メール', issuer.email],
];
