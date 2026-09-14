/** Canonical questions and answers. IDs are stable; amounts stay as named parameters. */
export const questions = {
  'monthly-cost': {
    id: 'monthly-cost',
    question: '結局、月々いくらですか？',
    answer:
      "<p>制作は買い切り、支援は任意です。「整える」は<strong>月{mStd}円（税別）</strong>で月30分の変更を含みます。外部費は別途。月額なしで自分で管理する選択もできます。<a href='@route:price'>料金の詳細</a>。</p>",
  },
  'initial-cost': {
    id: 'initial-cost',
    question: '初期費用はいくらかかりますか？',
    answer:
      '<p>最大9ページは{stdPrice}円（受付準備中）。支払いは着手50%・検収50%で、着手分は{deposit}円です。制作と継続支援・外部費は別です。</p>',
  },
  'single-page': {
    id: 'single-page',
    question: '1ページだけでもお願いできますか？',
    answer:
      '<p>「入口をつくる」は{pSINGLEPrice}円（税別・買い切り）。支給素材・既存構成・確認1回が基本です。増築時の充当は同一事業・再利用可能な構成・12か月以内・1回の条件があります。</p>',
  },
  'cost-comparison': {
    id: 'cost-comparison',
    question: '月額◯◯円のサービスと、どちらが安いですか？',
    answer:
      "<p>{pCOMPAREMONTHS}か月の総額で比べても、利用する支援や外部費で結果は変わります。<a href='@route:price'>料金表</a>では不利な条件も掲載しています。更新範囲が違うプランを同じものとして比較しません。</p>",
  },
  'industry-price': {
    id: 'industry-price',
    question: '業種によって値段は変わりますか？',
    answer: '<p>変わりません。変わるのは<strong>作るページの中身</strong>です。</p>',
  },
  'extra-work': {
    id: 'extra-work',
    question: 'あとから追加料金がかかることはありますか？',
    answer:
      "<p>変更は「整える」月30分・「育てる」月90分。超過前に翌月対応か見積もりを選び、自動請求はしません。新規ページは{pOPTIONS0Price}円〜、撮影・新機能等も別見積もり。<a href='@route:unlimited'>対応範囲</a>。</p>",
  },
  payment: {
    id: 'payment',
    question: '支払い方法は？',
    answer: '<p>銀行振込を基本とし、着手50%・検収50%です。自社24回分割の新規受付は行いません。</p>',
  },
  cancellation: {
    id: 'cancellation',
    question: '解約したら、サイトはどうなりますか？',
    answer:
      "<p><strong>残ります。</strong>ドメインは最初からお客様の名義で、ソースコードもお渡ししてあります。サーバーとドメインの契約は、手数料なしでお客様に引き継ぎます。<a href='@route:owned'>借地と所有のちがい</a>。</p>",
  },
  transfer: {
    id: 'transfer',
    question: '他社の「◯か月で無償譲渡」と何が違いますか？',
    answer:
      "<p>渡される<strong>中身</strong>と<strong>時点</strong>が違います。</p><p>時点：紬はドメインを顧客名義で取得し、ソースは納品時にお渡しします。比較先の譲渡時期・条件は契約によります。</p><p>中身：サイト作成ツールで作られている場合、譲渡されるのは<strong>ツールのアカウント</strong>で、そのツールの外へは持ち出せません。当方はHTMLとCSSのままお渡しするので、どのサーバーにも置けます。<a href='@route:owned'>「譲渡します」にも2種類あります</a>。</p>",
  },
  'support-term': {
    id: 'support-term',
    question: '契約期間の縛りはありますか？',
    answer:
      '<p>継続支援は{pRUNTERM}で、前月末までの申し出を翌月から適用します。制作の支払条件・外部サービスの契約期間は別に確認します。</p>',
  },
  'source-code': {
    id: 'source-code',
    question: 'ソースコードは本当にもらえるんですか？',
    answer:
      "<p>もらえます。GitHubという保管場所にご招待してお渡しします。アカウントの作り方からお手伝いします。<a href='@route:source'>納品の中身</a>。</p>",
  },
  migration: {
    id: 'migration',
    question: 'いま他社で作ったサイトがあります。移せますか？',
    answer:
      '<p>移せます。ドメインの名義と解約条件を先に確認します。<strong>いまのサイトを生かしたまま</strong>新しいものを作って、最後に切り替えます。</p>',
  },
  'business-closure': {
    id: 'business-closure',
    question: '@brand:nameさんが廃業したら、どうなりますか？',
    answer:
      '<p>サイトは動き続けます。<strong>そのために全部お渡ししています。</strong>引き継ぎの手順書も納品時に同梱しているので、他社がそのまま引き継げます。</p>',
  },
  specification: {
    id: 'specification',
    question: 'どんなサイトになりますか？',
    answer:
      "<p>作る内容を<a href='@route:spec'>先に全部公開しています</a>。20項目すべてを機械で検証して、1つでも落ちたら納品しません。</p>",
  },
  'self-updates': {
    id: 'self-updates',
    question: '自分で更新できますか？',
    answer:
      '<p>管理画面付きの「情報を育てる」は受付準備中です。<strong>機能の提供を確認してから</strong>契約します。</p>',
  },
  photography: {
    id: 'photography',
    question: '写真は撮ってもらえますか？',
    answer:
      '<p>出張撮影は全プランで別見積もりです。撮影・交通・編集等の総額を事前に確認します。<strong>撮った写真の元データはお渡しします。</strong>チラシにもSNSにも使えます。</p>',
  },
  writing: {
    id: 'writing',
    question: '文章は自分で書くんですか？',
    answer:
      "<p>制作プランに応じて、聞き取りと原稿整理を行います。1ページの「入口をつくる」は<strong>支給素材から原稿を整理</strong>します。取材記事など追加の作業は別見積もりです。<a href='@route:price'>プランに含まれる範囲</a>を確認してください。</p>",
  },
  mobile: {
    id: 'mobile',
    question: 'スマートフォンでも見られますか？',
    answer:
      '<p>もちろんです。<strong>パソコン版から内容を削りません。</strong>同じ内容が出ます。</p>',
  },
  'search-ranking': {
    id: 'search-ranking',
    question: '検索で1位になりますか？',
    answer:
      '<p><strong>お約束しません。</strong>順位を保証する会社があれば、疑ったほうがいいです。やるのは、Googleが公表している要因のうち<strong>こちらで動かせるもの</strong>を全部揃えることです。</p>',
  },
  acquisition: {
    id: 'acquisition',
    question: '新規のお客様は増えますか？',
    answer:
      '<p>増えるとは約束しません。確実にできるのは<strong>手数料の削減と、再来店の導線づくり</strong>です。そこは数字で確認できます。</p>',
  },
  portals: {
    id: 'portals',
    question: 'ポータルサイトはやめたほうがいいですか？',
    answer:
      "<p><strong>いきなりやめる提案はしません。</strong>準備なしにやめると売上が落ちます。3〜6か月は併走します。やめるべきでないお店には「やめないでください」と申し上げます。<a href='@route:cost-cut'>進め方</a>。</p>",
  },
  'ai-search': {
    id: 'ai-search',
    question: 'AI検索の対策はしてもらえますか？',
    answer:
      '<p><strong>売りません。</strong>Googleの公式ガイドが「生成AIの検索に構造化データもAI向けの書き方も不要」と明記しています。根拠のないものは商品にしていません。</p>',
  },
  'subsidy-approval': {
    id: 'subsidy-approval',
    question: '補助金は必ず通りますか？',
    answer:
      '<p>通りません。採択率は{pSUBSIDYAdoptionRate}です。<strong>通らなかった場合の扱いは、契約前に書面で決めます。</strong></p>',
  },
  'subsidy-application': {
    id: 'subsidy-application',
    question: '申請は代わりにやってもらえますか？',
    answer:
      '<p>申請そのものはお客様ご自身で行っていただきます。当方は<strong>見積書と根拠資料</strong>をお渡しし、書き方のご相談に乗ります。</p>',
  },
  'subsidy-payment': {
    id: 'subsidy-payment',
    question: 'お金はいつもらえますか？',
    answer:
      "<p><strong>全額を立て替えたあと</strong>です（精算払い）。実績報告のあとに入金されます。<a href='@route:subsidy'>手順と締切</a>。</p>",
  },
  area: {
    id: 'area',
    question: '対応エリアはどこまでですか？',
    answer: '<p>{cAREA}です。{cSERVICENOTE}撮影で伺う場合の交通費のみ実費でいただきます。</p>',
  },
  team: {
    id: 'team',
    question: '何人でやっているんですか？',
    answer:
      "<p>2人です。<a href='@route:about'>私たちについて</a>。<strong>人を増やして数をこなす形にはしません。</strong></p>",
  },
  'case-studies': {
    id: 'case-studies',
    question: '制作事例を見せてください',
    answer:
      "<p>現在公開しているのは<strong>この自社サイト1件</strong>です。他社の事例を自分の実績のようには見せません。<a href='@route:works'>自社サイトの実測値</a>を公開しています。顧客事例は1件目から表示速度・マップ閲覧数・問い合わせ件数を記録します。</p>",
  },
  consultation: {
    id: 'consultation',
    question: '相談したら、そのまま契約になりませんか？',
    answer:
      '<p>なりません。ご相談は無料で、その場でお返事をいただく必要もありません。<strong>いまのままで大丈夫だと思えば、そう申し上げます。</strong></p>',
  },
  advertising: {
    id: 'advertising',
    question: '広告はやめたほうがいいですか？',
    answer: '<p>止めた実測例では、予算3.45倍に対し売上は1.07倍。 止めずに入札単価を下げます。</p>',
  },
} as const;
