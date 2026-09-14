import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clsx } from 'clsx';
import { ICONS, type IconName } from '@/lib/icons';

/** HTML 文字列に埋め込むアイコンも、同じ React ライブラリで静的 SVG にする。 */
export function ic(name: IconName, className = ''): string {
  const icon = ICONS[name];
  if (!icon) throw new Error(`unknown icon: ${name}`);
  return renderToStaticMarkup(
    createElement(icon, {
      className: clsx('ic', className),
      size: '1em',
      'aria-hidden': true,
      focusable: false,
    }),
  );
}
