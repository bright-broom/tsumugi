import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * verify-report.json の PASS 件数。
 * 「測っていない数字は書かない」ので、ページに出す件数は実測ファイルから取る。
 * 無ければ「—」。ビルドは通す（数字が出ないことは verify 側で捕まえる）。
 */
export function verifyPass(): string | number {
  try {
    const p = fileURLToPath(new URL('../../verify-report.json', import.meta.url));
    return JSON.parse(readFileSync(p, 'utf-8')).pass;
  } catch {
    return '—';
  }
}
