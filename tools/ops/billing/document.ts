/** 請求書の中身（Markdown と印刷用 HTML で共通）。発行時に写した値だけで作る。 */
import { issuerRows } from '../shared/issuer';
import { type Block, type DocumentModel, yen } from '../shared/document';
import { OpsError } from '../shared/store';
import type { Invoice } from './model';

export function invoiceDocument(invoice: Invoice): DocumentModel {
  if (invoice.status === 'void')
    throw new OpsError(`${invoice.invoiceId} は取消済みのため書面を出しません`);
  const registration = invoice.invoiceRegistration;
  const blocks: Block[] = [
    { kind: 'paragraph', text: `${invoice.customerLabel} 様` },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['請求番号', invoice.invoiceId],
        ['請求日', invoice.issuedOn],
        ['お支払期限', invoice.dueOn],
        ['見積番号', `${invoice.estimateId}（第${invoice.estimateVersion}版）`],
        ...issuerRows(invoice.issuer),
        ...(registration.status === 'registered' ? [['登録番号', registration.number]] : []),
      ],
    },
    { kind: 'heading', text: `ご請求金額 ${yen(invoice.total)}（税込）` },
    {
      kind: 'table',
      head: ['内容', '税別', '消費税', '税込'],
      numeric: [false, true, true, true],
      rows: [[invoice.label, yen(invoice.subtotal), yen(invoice.tax), yen(invoice.total)]],
    },
  ];
  if (registration.status === 'registered')
    blocks.push({
      kind: 'table',
      head: ['税率', '対象額（税別）', '消費税'],
      numeric: [false, true, true],
      rows: [['10%', yen(invoice.subtotal), yen(invoice.tax)]],
    });
  else
    blocks.push({
      kind: 'notice',
      text: '当方は適格請求書発行事業者の登録をしていません。本書は適格請求書ではありません。',
    });
  const bank = invoice.bankTransfer;
  blocks.push(
    { kind: 'heading', text: 'お振込先' },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['金融機関', `${bank.bank} ${bank.branch}`],
        ['口座', `${bank.accountType} ${bank.accountNumber}`],
        ['口座名義', bank.accountHolder],
      ],
    },
    {
      kind: 'paragraph',
      text: `お支払期限（${invoice.dueOn}）までに、上記の口座へお振り込みください。`,
    },
  );
  return { title: '請求書', blocks };
}
