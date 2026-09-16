/**
 * 手元での LCP 実測（全ページの最大値）。ブラウザ実測を含む `npm run verify -- --write` だけが書き換える。
 * ビルドのたびに測り直す値ではないので、ページには記録日を添えて出す（ADR 0025）。
 * 現在の 0.18 秒は旧版の検査で記録され、リポジトリに初めて入ったのはコミット a8151e6（2026-09-14 日本時間）。
 */
export const LCP_SECONDS = 0.18;
export const LCP_PAGE_COUNT = 21;
export const LCP_RECORDED_ON = '2026-09-14';
