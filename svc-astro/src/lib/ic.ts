import { ICONS, type IconName } from '../data/icons';

/**
 * アイコンを文字列で欲しいとき（表のセルなど、set:html に渡す場所）だけ使う。
 * 通常は Icon.astro を使う。属性の並びは Python の ic() に合わせてある。
 */
export function ic(name: IconName, cls = ''): string {
  const p = ICONS[name];
  if (!p) throw new Error(`unknown icon: ${name}`);
  const c = `ic ${cls}`.trim();
  return (
    `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${p}</svg>`
  );
}
