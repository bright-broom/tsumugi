/**
 * Lucide を SVG で直接埋め込む。実行時JSは使わない。
 * 大きさは px ではなく em（隣の文字に対する比）で決める ── CSS 側の .ic / .ic-sm。
 * 文字列で欲しいとき（HTML 文字列の中に混ぜる場所）は lib/ic.ts の ic() を使う。
 */
import { ICONS, type IconName } from '@/lib/icons';
import { raw } from '@/lib/raw';

interface Props { name: IconName; sm?: boolean; className?: string }

export default function Icon({ name, sm = false, className = '' }: Props) {
  const path = ICONS[name];
  if (!path) throw new Error(`unknown icon: ${name}`);
  const klass = ['ic', sm ? 'ic-sm' : '', className].filter(Boolean).join(' ');
  return (
    <svg className={klass} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" dangerouslySetInnerHTML={raw(path)} />
  );
}
