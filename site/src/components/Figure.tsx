/**
 * 図。diagrams.ts が <figure> ごと文字列で返す。
 * React は包みのない生の HTML を置けないので、外側の <figure class> だけを要素にして中身を流し込む。
 * 広い画面用（.fw）と狭い画面用（.fn）の2枚が入っていて、出し分けは CSS 側。
 */
import { raw } from '@/lib/raw';

const FIGURE = /^<figure class="([^"]*)">([\s\S]*)<\/figure>$/;

export default function Figure({ svg }: { svg: string }) {
  const m = FIGURE.exec(svg);
  if (!m) throw new Error('diagrams.ts の戻り値が <figure class="…">…</figure> の形になっていません');
  return <figure className={m[1]} dangerouslySetInnerHTML={raw(m[2]!)} />;
}
