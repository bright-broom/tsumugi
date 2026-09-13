/**
 * 本文の多くは <strong> や <br> を含む HTML 文字列で持っている（Python 版からの移し替え）。
 * React に流し込むときは必ずここを通す。自前のデータだけを渡すこと。
 */
export const raw = (html: string) => ({ __html: html });

/** 文字列を HTML の中に組み込むとき用 */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
