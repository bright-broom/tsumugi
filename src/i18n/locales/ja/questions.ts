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
      "<p>渡される<strong>中身</strong>と<strong>時点</strong>が違います。</p><p>時点：紬はドメインを顧客名義で取得し、ソースは納品時にお渡しします。比較先の譲渡時期・条件は契約によります。</p><p>中身：契約やツールによっては、譲渡されるのが<strong>ツールのアカウントのみ</strong>で、データを外へ持ち出せない場合があります。当方はHTMLとCSSのままお渡しするので、どのサーバーにも置けます。<a href='@route:owned'>「譲渡します」にも2種類あります</a>。</p>",
  },
  'support-term': {
    id: 'support-term',
    question: '契約期間の縛りはありますか？',
    answer:
      '<p>継続支援は{pRUNTERM}で、前月末までの申し出を翌月から適用します。制作の支払条件・外部サービスの契約期間は別に確認します。</p>',
  },
  'source-code': {
    id: 'source-code',
    question: 'ソースコードは受け取れますか？',
    answer:
      "<p>はい。GitHubというデータの保管場所に、お客様のアカウントをご招待します。アカウントの作成とデータの見方もご案内します。<a href='@route:source'>納品する内容を見る</a></p>",
  },
  migration: {
    id: 'migration',
    question: 'いま他社で作ったサイトがあります。移せますか？',
    answer:
      '<p>ドメインの名義、データの利用条件、解約条件を確認して、移せる範囲をお伝えします。<strong>現在のサイトを公開したまま</strong>準備し、最後に切り替えます。</p>',
  },
  'business-closure': {
    id: 'business-closure',
    question: '@brand:nameさんが廃業したら、どうなりますか？',
    answer:
      '<p>ドメインとサーバーの契約を続ければ、サイトの公開は継続できます。<strong>ソースコードと引き継ぎ手順書</strong>を納品しますので、別の会社へ保守や更新を依頼できます。</p>',
  },
  specification: {
    id: 'specification',
    question: 'どんなサイトになりますか？',
    answer:
      "<p>連絡先、営業時間、スマートフォンでの表示など、<a href='@route:spec'>20項目の標準仕様</a>に沿って制作します。公開前の検査で不具合が見つかった場合は、修正してから納品します。</p>",
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
      '<p>はい。<strong>パソコンと同じ内容</strong>を、スマートフォンの画面幅に合わせて表示します。</p>',
  },
  'search-ranking': {
    id: 'search-ranking',
    question: '検索で1位になりますか？',
    answer:
      "<p><strong>検索順位は保証できません。</strong>事業の内容や所在地を整理し、ページの読み込みやスマートフォンでの表示を確認します。実施する内容は<a href='@route:spec'>標準仕様</a>にまとめています。</p>",
  },
  acquisition: {
    id: 'acquisition',
    question: '新規のお客様は増えますか？',
    answer:
      '<p>新規のお客様が増えることは保証できません。<strong>掲載費の見直しと、予約・問い合わせの案内</strong>を整え、公開後の件数や費用を確認します。</p>',
  },
  portals: {
    id: 'portals',
    question: 'ポータルサイトはやめたほうがいいですか？',
    answer:
      "<p><strong>現在の予約件数と費用を見て判断します。</strong>3〜6か月は並行して使い、予約への影響を確認します。掲載を続けたほうがよい場合もあります。<a href='@route:cost-cut'>見直しの進め方</a></p>",
  },
  'ai-search': {
    id: 'ai-search',
    question: 'AI検索の対策はしてもらえますか？',
    answer:
      '<p>AI検索への掲載や順位を保証する専用商品は扱っていません。<strong>内容の正確さ、読みやすさ、表示速度</strong>など、通常のサイト制作に含まれる項目を整えます。</p>',
  },
  'subsidy-approval': {
    id: 'subsidy-approval',
    question: '補助金は必ず通りますか？',
    answer:
      '<p>採択は保証できません。掲載している回の採択率は{pSUBSIDYAdoptionRate}です。<strong>不採択の場合に制作を続けるか、中止するか</strong>は、契約前に書面で決めます。</p>',
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
      "<p>2人で担当する予定です。プロフィールは現在準備中です。公開前に、名前と担当する仕事を<a href='@route:about'>私たちについて</a>に掲載します。</p>",
  },
  'case-studies': {
    id: 'case-studies',
    question: '制作事例を見せてください',
    answer:
      "<p>現在公開しているのは<strong>この自社サイト1件</strong>です。<a href='@route:works'>表示速度と検査結果</a>をご覧いただけます。顧客事例は、掲載許可をいただいたうえで、制作内容と実際に計測できた変化をご紹介します。</p>",
  },
  consultation: {
    id: 'consultation',
    question: '相談したら、そのまま契約になりませんか？',
    answer:
      '<p>ご相談だけで契約になることはありません。<strong>費用と内容をご確認いただいてから</strong>、依頼するかお決めください。相談は無料です。</p>',
  },
  advertising: {
    id: 'advertising',
    question: '広告はやめたほうがいいですか？',
    answer:
      '<p>現在の費用と、そこからの予約や問い合わせを確認して判断します。配信地域、検索語、入札単価を見直し、<strong>変更後の件数や費用</strong>を確認します。</p>',
  },
} as const;
