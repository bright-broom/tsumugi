/** The same four deliverables appear in the overview and the ownership explanation. */
export default [
  {
    title: '① 住所 ── ドメイン',
    desc: 'お客様の名義で取得します。契約者情報を納品時に一緒に確認します。',
    link: ['名義のお約束', '@route:terms'],
  },
  {
    title: '② 建物 ── ソースコード',
    desc: 'HTML・CSS・画像・設定の一式をお渡しします。他社がそのまま引き継げます。',
    link: ['納品の中身', '@route:source'],
  },
  {
    title: '③ 地盤 ── 置き場所',
    desc: '実行時のプログラムが0バイトなので、どのサーバーにも置けます。',
    link: ['仕様を見る', '@route:spec'],
  },
  {
    title: '④ 家具 ── 写真と原稿',
    desc: '納品する原稿・画像は、用途と第三者の利用条件を明示してお渡しします。',
    link: ['権利の扱い', '@route:terms'],
  },
] as const;
