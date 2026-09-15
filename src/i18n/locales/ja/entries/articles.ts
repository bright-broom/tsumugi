import type { ArticlesInput } from '@/lib/collections/articles';

/**
 * お知らせ・コラムの記事データ。紬の自社サイトでは公開記事はなく、入稿枠だけを持つ。
 *
 * 入稿枠は、初期記事 3 本（initial）と、プランで追加する 3 本（additional）の空の雛形。
 * 本文はここに書かない（事実を確かめた原稿を受け取ってから入れる）。公開の手順：
 *   1. slug を `draft-` で始まらない英小文字・数字・ハイフンに変える（URL になる）
 *   2. title・seo.description（40〜160 文字）・publishedAt・body を入れる
 *   3. status を 'published' にし、`npm run check:collections` で公開前チェックを通す
 * 足りない項目があると、ビルドは公開記事を出さずに止まる。下書きは何も出力しない。
 */
const slot = (
  id: string,
  group: 'initial' | 'additional',
): ArticlesInput['entries'][number] => ({
  slug: `draft-${id}`,
  status: 'draft',
  kind: 'column',
  title: '',
  seo: { title: '', description: '' },
  body: [],
  intake: { slot: id, group },
});

export default {
  entries: [
    slot('initial-1', 'initial'),
    slot('initial-2', 'initial'),
    slot('initial-3', 'initial'),
    slot('additional-1', 'additional'),
    slot('additional-2', 'additional'),
    slot('additional-3', 'additional'),
  ],
} satisfies ArticlesInput;
