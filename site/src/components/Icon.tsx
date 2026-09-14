import { clsx } from 'clsx';
import { ICONS, type IconName } from '@/lib/icons';

interface Props {
  name: IconName;
  sm?: boolean;
  className?: string;
}

/** Lucide React をビルド時に SVG へ変換。サイズは既存 CSS の em 指定に従う。 */
export default function Icon({ name, sm = false, className }: Props) {
  const Glyph = ICONS[name];
  if (!Glyph) throw new Error(`unknown icon: ${name}`);
  return (
    <Glyph
      className={clsx('ic', sm && 'ic-sm', className)}
      size="1em"
      aria-hidden="true"
      focusable="false"
    />
  );
}
