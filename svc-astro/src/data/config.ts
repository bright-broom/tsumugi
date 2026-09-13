/**
 * ブランド設定 ── 別ブランド・別エリアに振り替えるときはこのファイルだけ編集する。
 * svc/config.py と同じ役割。移行が終わったら Python 側を捨てる。
 */
export const PROFILE = 'campaign' as const;          // campaign=緑 / main=青
export const PLACEHOLDER = true;                      // 本番公開時に false

export const BRAND = '紬';
export const BRAND_READING = 'つむぎ';
export const AREA = '全国';
export const SERVICE_NOTE = '打ち合わせはオンラインと電話。全国どこでもお受けします。';
export const DOMAIN = 'example.jp';

export const TEL = '000-0000-0000';
export const TEL_LINK = '0000000000';
export const TEL_HOURS = '平日 9:00〜18:00';
export const EMAIL = 'info@example.jp';
export const LINE_URL = '';
export const FORM_ENDPOINT = '';

export const LEGAL_NAME = '紬';
export const ADDRESS_REGION = '（都道府県）';
export const ADDRESS_CITY = '（市区町村）';
export const ADDRESS_STREET = '（番地）';
export const POSTAL_CODE = '000-0000';

export const RESPONSE_PROMISE = '1営業日以内';
export const RESPONSE_ACTUAL: string | null = null;

export const MEMBERS = [
  {
    role: '設計・実装',
    name: '（名前）',
    bio:
      'フリーランスのエンジニア。医療・建設・製造・クリエイター領域でのシステム開発とDX支援。' +
      'Microsoft Azure のエンタープライズ窓口で法人サポートの経験。AZ-900 / PL-900。',
  },
  {
    role: '撮影・取材・集客支援',
    name: '（名前）',
    bio: '（役割に合わせて書き換える。撮影／原稿の聞き取り／広告運用のどれを担うかを明記する）',
  },
] as const;

/** title・フッター用。一文字の屋号なので読みを括弧で添える */
export const BRAND_T = BRAND_READING ? `${BRAND}（${BRAND_READING}）` : BRAND;

/** LCP 実測値。verify.py / verify が書き換える。手で書かない */
export const LCP_MEASURED = '0.18秒（全21ページの最大値・実測）';
