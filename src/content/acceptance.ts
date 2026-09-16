import type { SpecItemId } from '@/content/spec';

/**
 * 納品仕様 20 項目の「人の確認」「外部接続の確認」の記録（#35、ADR 0026）。
 * 自動検査との対応表は tools/verify/acceptance.ts にある。ここは案件ごとに差し替える中身。
 *
 * 確認していないことは書かない。対象外にする場合も、対応表の「対象外の条件」に当てはまることを
 * 確認した記録として残す。本番モードの検査（npm run verify -- --mode production）は、
 * 人の確認が必要な項目に記録が無ければ原則 FAIL。自社公開の例外（ADR 0056）でも未確認のまま残す。
 */
export interface AcceptanceRecord {
  /** 確認した日（YYYY-MM-DD） */
  checkedOn: string;
  /** 確認した人の立場 */
  checkedBy: 'owner' | 'staff' | 'customer';
  /** confirmed＝満たしている。not-applicable＝対象外の条件に当てはまる */
  outcome: 'confirmed' | 'not-applicable';
  /** 確認の根拠を置いた場所（docs のパス、テスト送信の記録、チケットの URL など） */
  evidence: string;
}

export const ACCEPTANCE_RECORDS: Readonly<Partial<Record<SpecItemId, AcceptanceRecord>>> = {};
