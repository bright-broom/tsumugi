/**
 * コレクション（記事・事例・対応エリア・顧客事例）の公開前チェックと入稿枠の報告（npm run check で走る）。
 *
 * - 公開（status: 'published'）の項目に不足があれば終了コード 1。ビルドも同じ理由で止まる
 * - 下書きは出力しない。入稿枠ごとに、公開までに埋める項目を一覧にする
 */
import { getMessages } from '@/i18n/catalog';
import { COLLECTION_IDS, collectionRoutes, reviewCollections } from '@/content/collections';

let review: ReturnType<typeof reviewCollections>;
try {
  review = reviewCollections(getMessages().entries);
} catch (error) {
  console.error(`check-collections: データの形が正しくありません\n${(error as Error).message}`);
  process.exit(1);
}
const { problems, drafts, site } = review;

for (const id of COLLECTION_IDS) {
  const { all, published } = site[id];
  console.log(`  ${id}: 公開 ${published.length} 件 / 下書き ${all.length - published.length} 件`);
}
const slots = drafts.filter((draft) => draft.slot !== null);
if (slots.length) {
  console.log('  入稿枠（公開前チェックで足りない項目）:');
  for (const draft of slots)
    console.log(`    ${draft.collection}/${draft.slot}: ${draft.missing.length} 項目 — ${draft.missing.join('; ')}`);
}
if (problems.length) {
  console.error(
    'check-collections: 公開できない項目があります\n  ' +
      problems.map((p) => `${p.collection}/${p.slug}: ${p.reason}`).join('\n  '),
  );
  process.exit(1);
}
console.log(`check-collections: 生成するコレクションのページ ${collectionRoutes(site).length} 件`);
