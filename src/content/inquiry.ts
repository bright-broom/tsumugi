/**
 * 問い合わせの受付・通知・保持に使う設定データ（ADR 0032〜0034）。
 * 公開ページのフォームと受付サービス（services/inquiry/）が同じ値を参照する。
 * 表示用の文言は i18n/locales/ja/contact.ts と inquiry.ts に置く。
 */

const FORM_FIELD_NAMES = ['name', 'business', 'industry', 'tel', 'email', 'message'] as const;
type FormFieldName = (typeof FORM_FIELD_NAMES)[number];

/** フォームの name 属性。公開 HTML と受付サービスの検証で同じ名前を使う */
export const INQUIRY_FIELDS = {
  ...(Object.fromEntries(FORM_FIELD_NAMES.map((n) => [n, n])) as { [K in FormFieldName]: K }),
  /** 迷惑投稿対策の隠し項目。人は見えない・触れないので、値が入っていれば機械の送信とみなす */
  honeypot: 'company_website',
} as const;

/** サーバー側で強制する文字数の上限（フォームの HTML には maxlength を出していない） */
export const INQUIRY_LIMITS = {
  name: 100,
  business: 100,
  tel: 30,
  email: 254,
  message: 4000,
  /** 受け付ける本文の最大バイト数（application/x-www-form-urlencoded） */
  bodyBytes: 64 * 1024,
} as const;

/** 同じ内容の再送を、同じ受付番号に寄せる時間 */
export const INQUIRY_DUPLICATE_WINDOW_MINUTES = 10;

/** 通知は必ず 2 系統。email と、line または sms のどちらか（ADR 0033） */
export const INQUIRY_NOTIFICATION_CHANNELS = ['email', 'line'] as const;

/**
 * 問い合わせ情報にアクセスできる担当者。プライバシー表示の「担当する2名」をデータで表す（ADR 0034）。
 * 実名・連絡先は置かない。ID と役割だけを持ち、実在の認証基盤のアカウントとの対応は配備先で管理する。
 * 役割の割り当ては仮置き（オーナー判断）。
 */
export const INQUIRY_STAFF = [
  { id: 'member-1', role: 'administrator', active: true },
  { id: 'member-2', role: 'responder', active: true },
] as const;

/**
 * 保持期限。privacy.ts の「取り扱いの方針」に合わせる（ADR 0034）。
 * - 契約に至らなかった問い合わせ：最後のやり取りから 1 年で削除
 * - 契約終了後：7 年保管してから削除
 * - 迷惑投稿の疑い（隠し項目に入力あり）：30 日で削除
 */
export const INQUIRY_RETENTION = {
  prospectYears: 1,
  afterContractEndYears: 7,
  suspectedSpamDays: 30,
} as const;
