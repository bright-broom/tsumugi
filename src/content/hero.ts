import { esc } from '@/lib/raw';

/** Self-contained SVG generated from the approved temporary artwork at build time. */
export const HOME_HERO = {
  src: '/images/onokoro-hero.svg',
  width: 1641,
  height: 958,
} as const;

/** 背景画だけを内包する SVG。タイトルは絵の説明だけで、見出し・本文は HTML がカタログから描画する（ADR 0019） */
export function heroSvg(artworkAlt: string, webpBase64: string): string {
  const { width, height } = HOME_HERO;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">` +
    `<title id="title">${esc(artworkAlt)}</title>` +
    `<image width="${width}" height="${height}" href="data:image/webp;base64,${webpBase64}"/></svg>`
  );
}
