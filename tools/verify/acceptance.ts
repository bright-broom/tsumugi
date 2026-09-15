/**
 * 納品仕様 20 項目と受入検査の対応表（#35、ADR 0026）。
 *
 * 項目ごとに「自動検査の項目（verify の検査名）」「人が確認すること」「外部接続の確認」「対象外の条件」を持つ。
 * - 対応表に無い項目、確認の方法が 1 つも無い項目、存在しない検査名、ページの表示（spec.ts の check）との
 *   食い違いは、verify が FAIL にする。
 * - 人の確認・外部接続の確認は content/acceptance.ts の記録で扱い、本番モードでは記録が無ければ FAIL。
 * 自動検査は項目の一部しか証明しないことが多い。証明できない部分は manual に書き、自動検査済みと表示しない。
 */
import { ACCEPTANCE_RECORDS, type AcceptanceRecord } from '@/content/acceptance';
import { SPEC_ITEMS, type SpecCheckMethod, type SpecItemId } from '@/content/spec';
import type { AcceptanceEntry } from '@/lib/verification-report';
import type { Result } from './results';
import { MIN_FONT_MB, MOBILE_W, TAP_MIN } from './thresholds';

export interface AcceptanceRule {
  /** 静的検査の検査名 */
  static: readonly string[];
  /** ブラウザ実測の検査名（--static のときは走らない） */
  browser: readonly string[];
  /** 人が確認すること */
  manual: readonly string[];
  /** 外部サービスとの接続。実際に動かした記録か承認記録で確認する */
  external: readonly string[];
  /** 対象外として記録してよい条件。無ければ null */
  outOfScope: string | null;
}

const none = { static: [], browser: [], manual: [], external: [], outOfScope: null } as const;

export const ACCEPTANCE: Readonly<Record<SpecItemId, AcceptanceRule>> = {
  phone: {
    ...none,
    static: ['01 電話番号(tel:＋文字)'],
    manual: ['各画面幅で、ページ上部から番号が読めて発信できるか（自動検査はヘッダー内の tel: リンクと文字の有無まで）'],
  },
  hours: {
    ...none,
    static: ['02-03 営業時間・住所'],
    manual: ['定休日・臨時休業・年末年始の案内があり、古い案内が残っていないか（自動検査は営業時間の文字の有無まで）'],
  },
  address: {
    ...none,
    static: ['02-03 営業時間・住所', '17 構造化データ'],
    manual: ['地図へのリンク・最寄り駅からの道順・駐車場の有無'],
    outOfScope: '来店を受け付けない事業（地図・道順・駐車場を対象外にする）',
  },
  price: {
    ...none,
    static: ['04 料金の明示', '29 価格の一致'],
    manual: ['追加費用がかかる条件を料金と一緒に書いているか'],
  },
  'primary-contact': {
    ...none,
    static: ['05 業種別ページ'],
    manual: ['業種と実際に対応できる窓口から、電話とフォームのどちらを主役にするかを決め、その配置になっているか（自動検査はページの有無だけ）'],
  },
  area: {
    ...none,
    manual: ['依頼を受けられる地域と、出張費などが変わる条件（工務店・士業は市町村ごと）'],
  },
  photos: {
    ...none,
    static: ['07 imgのalt'],
    manual: ['実物の写真を、内容が伝わる明るさで載せているか（自動検査は alt の有無まで。画像 0 枚のページは対象なし）'],
    outOfScope: '写真を載せないページ・プラン',
  },
  staff: {
    ...none,
    manual: ['掲載の同意、顔写真、担当する仕事・経歴・得意な分野の紹介'],
    outOfScope: '顔写真や紹介の掲載に同意が得られない場合',
  },
  cases: {
    ...none,
    manual: ['実績の一覧と詳細の 2 段構成と、掲載許可'],
    outOfScope: '掲載できる実績が無い場合（一覧・詳細の機能は提供を確認するまで契約に含めない）',
  },
  voices: {
    ...none,
    manual: ['掲載許可と、依頼・謝礼の有無の表記'],
    outOfScope: 'お客様の声を載せない場合',
  },
  guides: {
    ...none,
    manual: ['料金・費用・選び方の説明が、契約したプランの範囲で書かれているか'],
  },
  'mobile-parity': {
    ...none,
    static: ['12 viewport'],
    browser: [`横スクロールなし(${MOBILE_W}px)`, `27 文字の下限 ${MIN_FONT_MB}px`],
    manual: ['スマホとパソコンで、料金・注意事項・連絡先が同じように確認できるか'],
  },
  lcp: {
    ...none,
    browser: ['13 LCP 2.5秒以内'],
  },
  'first-image': {
    ...none,
    static: ['14 先頭画像にlazyを付けない', '14 先頭画像に fetchpriority'],
  },
  'no-score-chasing': {
    ...none,
    browser: ['13 LCP 2.5秒以内'],
    manual: ['電話・問い合わせ・メニューの操作を実機で確認したか'],
  },
  'tap-target': {
    ...none,
    browser: [`16 タップ領域 ${TAP_MIN}px`],
    manual: ['近くのボタンを誤って押しにくい間隔があるか（自動検査は 1 つずつの大きさ）'],
  },
  'structured-data': {
    ...none,
    static: ['17 構造化データ'],
    manual: ['@type が業種に合っているか（自動検査は必須の項目と FAQPage の不使用まで）'],
  },
  'business-profile': {
    ...none,
    external: ['Google ビジネスプロフィールからサイト・予約先へ移動でき、住所・営業時間がサイトと一致するか'],
    outOfScope: 'ビジネスプロフィールを持たない事業',
  },
  notifications: {
    ...none,
    external: ['メールと別の通知先の両方にテスト送信が届き、返答までの時間をページに書いたか'],
  },
  reviews: {
    ...none,
    external: ['口コミの依頼・返信の運用を、契約した支援プランの範囲で始めたか'],
    outOfScope: '口コミの運用を含む支援プランを契約しない場合',
  },
};

export function methodOf(rule: AcceptanceRule): SpecCheckMethod | null {
  const automated = rule.static.length + rule.browser.length > 0;
  if (rule.external.length) return 'external';
  if (automated && rule.manual.length) return 'auto+manual';
  if (automated) return 'auto';
  return rule.manual.length ? 'manual' : null;
}

const needsHumanRecord = (rule: AcceptanceRule) => rule.manual.length > 0 || rule.external.length > 0;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function recordStatus(
  rule: AcceptanceRule,
  record: AcceptanceRecord | undefined,
  today: string,
): AcceptanceEntry['human']['status'] {
  if (!needsHumanRecord(rule)) return 'none';
  const valid =
    record !== undefined &&
    DATE.test(record.checkedOn) &&
    record.checkedOn <= today &&
    record.evidence.trim() !== '' &&
    (record.outcome === 'confirmed' || rule.outOfScope !== null);
  return valid ? record.outcome : 'pending';
}

interface Inputs {
  items?: readonly { id: SpecItemId; check: SpecCheckMethod }[];
  rules?: Readonly<Partial<Record<string, AcceptanceRule>>>;
  records?: Readonly<Partial<Record<string, AcceptanceRecord>>>;
}

/** 人の確認・外部接続の確認が必要なのに、有効な記録が無い項目 */
export function pendingHumanChecks(today: string, input: Inputs = {}): string[] {
  const { items = SPEC_ITEMS, rules = ACCEPTANCE, records = ACCEPTANCE_RECORDS } = input;
  return items
    .filter((it) => {
      const rule = rules[it.id];
      return rule !== undefined && recordStatus(rule, records[it.id], today) === 'pending';
    })
    .map((it) => it.id);
}

/**
 * 対応表そのものの検査。results は同じ実行で記録した検査結果。
 * 問題が無ければ PASS を 1 件、あれば問題ごとに FAIL を記録する。
 */
export function auditAcceptance(
  results: readonly Result[],
  ranBrowser: boolean,
  input: Inputs = {},
): Result[] {
  const { items = SPEC_ITEMS, rules = ACCEPTANCE } = input;
  const check = '受入 対応表';
  const ran = new Set(results.map((r) => r.check));
  const out: Result[] = [];
  const fail = (page: string, detail: string) => out.push({ level: 'FAIL', check, page, detail });

  for (const it of items) {
    const rule = rules[it.id];
    if (!rule) {
      fail(it.id, '対応表にありません。自動検査・人の確認・対象外の条件を対応付けてください');
      continue;
    }
    const method = methodOf(rule);
    if (!method) {
      fail(it.id, '確認の方法が 1 つもありません');
      continue;
    }
    if (method !== it.check)
      fail(it.id, `ページの表示（${it.check}）と対応表から導いた方法（${method}）が一致しません`);
    const unknown = [...rule.static, ...(ranBrowser ? rule.browser : [])].filter((name) => !ran.has(name));
    if (unknown.length) fail(it.id, `この実行に無い検査名：${unknown.join('・')}`);
  }
  const ids = new Set<string>(items.map((it) => it.id));
  for (const id of Object.keys(rules)) if (!ids.has(id)) fail(id, '仕様のページに無い項目です');

  if (!out.length) {
    const methods = items.map((it) => it.check);
    const n = (m: SpecCheckMethod) => methods.filter((x) => x === m).length;
    out.push({
      level: 'PASS',
      check,
      page: 'spec',
      detail: `${items.length}項目：自動 ${n('auto')}・自動＋人 ${n('auto+manual')}・人 ${n('manual')}・外部接続 ${n('external')}`,
    });
  }
  return out;
}

/** レポートに残す、項目ごとの受入の状況 */
export function acceptanceEntries(
  results: readonly Result[],
  ranBrowser: boolean,
  today: string,
  input: Inputs = {},
): AcceptanceEntry[] {
  const { items = SPEC_ITEMS, rules = ACCEPTANCE, records = ACCEPTANCE_RECORDS } = input;
  return items.flatMap((it) => {
    const rule = rules[it.id];
    const method = rule && methodOf(rule);
    if (!rule || !method) return [];
    const checks = [...rule.static, ...rule.browser];
    const rows = results.filter(
      (r) => rule.static.includes(r.check) || (ranBrowser && rule.browser.includes(r.check)),
    );
    const status: AcceptanceEntry['automated']['status'] = !checks.length
      ? 'none'
      : rows.some((r) => r.level === 'FAIL')
        ? 'fail'
        : !ranBrowser && rule.browser.length
          ? 'not-run'
          : rows.length && rows.every((r) => r.level === 'N/A')
            ? 'no-target'
            : 'pass';
    const record = records[it.id];
    const human = recordStatus(rule, record, today);
    return [
      {
        id: it.id,
        method,
        automated: { checks, status },
        human: {
          required: needsHumanRecord(rule),
          status: human,
          checkedOn: human === 'confirmed' || human === 'not-applicable' ? record!.checkedOn : null,
        },
      },
    ];
  });
}
