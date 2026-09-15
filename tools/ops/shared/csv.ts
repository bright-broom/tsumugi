/** RFC 4180 の CSV。依存を増やさないための小さな実装（ADR 0036）。 */
import { OpsError } from './store';

function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (c === '\r' && source[i + 1] === '\n') i++;
    } else field += c;
    i++;
  }
  if (quoted) throw new OpsError('CSV: 引用符が閉じていません');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export interface CsvRecord {
  line: number;
  values: Record<string, string>;
}

/** 見出し行を持つ CSV を読む。必須列が無ければ取り込まない。 */
export function readCsvRecords(text: string, required: readonly string[]): CsvRecord[] {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new OpsError('CSV: 見出し行がありません');
  const names = header.map((h) => h.trim());
  const lacking = required.filter((name) => !names.includes(name));
  if (lacking.length) throw new OpsError(`CSV: 必須の列がありません: ${lacking.join(', ')}`);
  return body.map((cells, index) => {
    if (cells.length !== names.length)
      throw new OpsError(`CSV ${index + 2} 行目: 列の数が見出しと違います`);
    return {
      line: index + 2,
      values: Object.fromEntries(names.map((name, k) => [name, (cells[k] ?? '').trim()])),
    };
  });
}
