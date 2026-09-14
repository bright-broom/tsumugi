import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const reportSchema = z.object({ pass: z.number().int().nonnegative() });

/**
 * verify-report.json の PASS 件数。
 * 「測っていない数字は書かない」ので、ページに出す件数は実測ファイルから取る。
 * 無ければ「—」。ビルドは通す（数字が出ないことは verify 側で捕まえる）。
 * 読むのは全項目の結果だけ。`--static` の結果は verify-report.static.json に分けてあるので、ここには混ざらない。
 *
 * node:fs を使うので getStaticProps の中からだけ呼ぶこと（ページ本体から呼ぶとクライアント用の束に混ざる）。
 */
export function verifyPass(): string | number {
  try {
    return reportSchema.parse(
      JSON.parse(readFileSync(join(process.cwd(), 'verify-report.json'), 'utf-8')),
    ).pass;
  } catch {
    return '—';
  }
}
