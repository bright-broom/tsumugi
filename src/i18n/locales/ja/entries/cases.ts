import type { CasesInput } from '@/lib/collections/cases';

/**
 * 施工事例・取扱分野のデータ。紬の自社サイトには顧客の事例がないので空にしている。
 *
 * 顧客サイトでは taxonomy に業種ごとの分類（categories）と詳細項目（fields）、地域（areas）を定義し、
 * entries に事例を足す。公開するのは status が 'published' で公開前チェックを通ったものだけ。
 * 絞り込みの選択肢は公開中の事例が使っている値だけから作る。
 */
export default {
  taxonomy: { industries: [], areas: [] },
  entries: [],
} satisfies CasesInput;
