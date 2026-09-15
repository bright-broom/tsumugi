/** 見積書の中身（Markdown と印刷用 HTML で共通）。保存した版の金額をそのまま出す。 */
import { BRAND } from '@/content/config';
import { type Block, type DocumentModel, signedYen, yen } from '../shared/document';
import { type Certainty, type EstimateVersion, diffVersions } from './model';

const CERTAINTY: Record<Certainty, string> = {
  fixed: '確定',
  reference: '目安（別見積もり）',
  provisional: '仮置き',
};

export function estimateDocument(
  version: EstimateVersion,
  options: { today: string; previous?: EstimateVersion },
): DocumentModel {
  const { input, result } = version;
  const blocks: Block[] = [
    { kind: 'paragraph', text: `${input.customerLabel} 様` },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['見積番号', `${input.estimateId}（第${version.version}版）`],
        ['発行日', input.issuedOn],
        ['有効期限', input.validUntil],
        ['発行', BRAND],
      ],
    },
  ];
  if (options.today > input.validUntil)
    blocks.push({
      kind: 'notice',
      text: `この見積もりは有効期限（${input.validUntil}）を過ぎています。`,
    });
  if (result.provisional)
    blocks.push({
      kind: 'notice',
      text: '金額に目安・仮置きの項目を含みます。確定していない事項は「未確定の事項」をご確認ください。',
    });

  blocks.push(
    { kind: 'heading', text: '金額のまとめ' },
    {
      kind: 'table',
      head: ['区分', '税別', '税込'],
      numeric: [false, true, true],
      rows: [
        ['初期費用', yen(result.initialSubtotal), yen(result.initialTotal)],
        ['毎月の継続支援', yen(result.monthlySubtotal), yen(result.monthlyTotal)],
        ['毎月の外部サービス費（仮置き）', yen(result.externalSubtotal), yen(result.externalTotal)],
        [`${result.months}か月の総額`, yen(result.periodSubtotal), yen(result.periodTotal)],
      ],
    },
  );

  const table = (group: 'initial' | 'monthly' | 'external') =>
    result.lines
      .filter((l) => l.group === group)
      .map((l) => [
        l.label,
        yen(l.unitPrice),
        String(l.quantity),
        yen(l.amount),
        CERTAINTY[l.certainty],
      ]);
  const lineHead = ['項目', '単価（税別）', '数量', '金額（税別）', '区分'];
  const lineNumeric = [false, true, true, true, false];
  const initialRows = table('initial');
  if (initialRows.length)
    blocks.push(
      { kind: 'heading', text: '初期費用の内訳' },
      { kind: 'table', head: lineHead, numeric: lineNumeric, rows: initialRows },
    );
  blocks.push(
    { kind: 'heading', text: '毎月の費用の内訳' },
    {
      kind: 'table',
      head: lineHead,
      numeric: lineNumeric,
      rows: [...table('monthly'), ...table('external')],
    },
    { kind: 'heading', text: 'お支払い' },
    {
      kind: 'table',
      head: ['時期', '税別', '消費税', '税込'],
      numeric: [false, true, true, true],
      rows: result.invoices.map((i) => [i.label, yen(i.subtotal), yen(i.tax), yen(i.total)]),
    },
    {
      kind: 'paragraph',
      text: '外部サービス費はお客様が各社と直接ご契約いただくため、上の表に含めていません。',
    },
    { kind: 'heading', text: '計算の根拠' },
    {
      kind: 'list',
      items: [
        `初期費用（税別）＝ 制作本体 ${yen(result.productionSubtotal)} ＋ オプション ${yen(result.optionsSubtotal)} ＝ ${yen(result.initialSubtotal)}`,
        `${result.months}か月の総額（税別）＝ 初期費用 ${yen(result.initialSubtotal)} ＋（継続支援 ${yen(result.monthlySubtotal)} ＋ 外部サービス費 ${yen(result.externalSubtotal)}）× ${result.months}か月 ＝ ${yen(result.periodSubtotal)}`,
        '消費税はお支払いの回ごとに計算し、1円未満を四捨五入します。合計に一度だけ掛けた額と1円程度ずれることがあります。',
      ],
    },
    { kind: 'heading', text: '前提条件' },
    input.assumptions.length
      ? { kind: 'list', items: input.assumptions }
      : { kind: 'paragraph', text: '個別の前提条件はありません。' },
    { kind: 'heading', text: '未確定の事項' },
    { kind: 'list', items: result.notes },
  );

  if (options.previous) {
    const diff = diffVersions(options.previous, version);
    blocks.push(
      { kind: 'heading', text: `第${diff.from}版からの変更` },
      {
        kind: 'table',
        head: ['項目', `第${diff.from}版`, `第${diff.to}版`, '差額'],
        numeric: [false, true, true, true],
        rows: [
          ...diff.lines.map((l) => [
            `${l.label}（${l.change === 'added' ? '追加' : l.change === 'removed' ? '削除' : '変更'}）`,
            yen(l.before),
            yen(l.after),
            signedYen(l.after - l.before),
          ]),
          ...diff.totals.map((t) => [t.label, yen(t.before), yen(t.after), signedYen(t.delta)]),
        ],
      },
      { kind: 'list', items: diff.fields.map((f) => `${f.label}：${f.before} → ${f.after}`) },
    );
  }
  return { title: `お見積書（第${version.version}版）`, blocks };
}
