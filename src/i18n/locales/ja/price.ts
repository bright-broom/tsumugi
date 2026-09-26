import comparison from '@/i18n/locales/ja/comparison';
export default {
  comparison,
  title: '料金｜買い切り{single}円から・任意の継続支援｜{brand}',
  desc: '制作は買い切り。継続支援は必要な分だけ。作業枠、外部費、お支払い、増築時の条件まで先に確認できます。',
  eyebrow: '料金と提供範囲',
  heading: '制作費は買い切り。保守契約は不要です',
  lede: 'すべて税別。制作・継続支援・外部の実費を分けてお見積もりします。',
  production: '制作は買い切り',
  catalogLink: '全プランを用途から比較する',
  externalTitle: '外部サービスの実費',
  external:
    'ドメイン・サーバー・フォームや CMS 等は、お客様名義で直接契約します（支援の有無にかかわらず必要）。項目ごとに見積もり、概算を一律に請求しません。',
  registrars: {
    heading: 'ドメインの取得先を選ぶ',
    lede: 'ドメインはお客様ご自身の名義で取得します。迷ったら次の3社からどうぞ。',
    providers: [
      {
        name: 'さくらのドメイン',
        description:
          'さくらインターネットのドメイン取得サービス。.jpや.comなどに対応し、電話・メールで相談できます。日本語のサポートを重視する方に。',
        url: 'https://domain.sakura.ad.jp/',
      },
      {
        name: 'ムームードメイン',
        description:
          '.com・.jpなど、幅広い種類から選べます。日本語のマニュアルやサポートを見ながら、ご自身で管理したい方の候補です。',
        url: 'https://muumuu-domain.com/',
      },
      {
        name: 'Cloudflare Registrar',
        description:
          '取得・更新料金に独自の上乗せをしない料金方針です。利用中はCloudflareのDNSを使う必要があるため、対応するドメインの種類とあわせて取得前に確認します。',
        url: 'https://www.cloudflare.com/domains/',
      },
    ],
    conditions:
      '2年目以降の更新料と有料オプションも確認を。取得・更新費は制作費と別の実費です。取得先と公開先は別々に選べます。',
    checked:
      '公式情報の確認：2026年9月17日。料金・対応する種類・利用条件は各社の公式サイトで最新情報をご確認ください。',
  },
  supportTitle: '管理を任せたい方だけ、追加の支援プラン',
  supportLede:
    '任意・1か月単位。前月末までの申し出で変更・終了できます。やめても、外部契約を続ければサイトは公開したままです。',
  monthly: ' 円／月',
  scopeTitle: '作業時間と追加料金のルール',
  scope:
    '「整える」月30分・「育てる」月90分。5分単位で月の合計を数え、依頼ごとに切り上げません。繰越なし。超える前に翌月対応か追加見積もりを選べ、自動で追加請求しません。',
  scopeLink: '変更と継続支援の範囲を見る',
  paymentTitle: '制作費は、着手と検収で半分ずつ',
  paymentHeaders: ['商品', '#制作総額', '#着手50%', '#検収50%'],
  paymentNote:
    '銀行振込が基本です。自社24回分割の新規受付は行いません。継続支援の費用と外部サービス費は含みません。',
  upgradeTitle: 'ページを増やすときの制作費',
  upgradeHeaders: ['増築の例', '#制作本体の差額'],
  upgrade1: '入口をつくる → 事業の土台をつくる',
  upgrade2: '事業の土台をつくる → 情報を育てる（受付準備中）',
  upgradeNote:
    '同じ事業・同じ構成の増築に限り、納品から12か月以内に1回、支払済みの制作本体額を充当します（撮影・外部実費・支援費は対象外）。',
  comparisonTitle: '同じ期間の総額と、対応範囲を確認する',
  comparisonLede:
    '{months}か月の参考比較。紬は保守契約なし（制作費＋外部費の概算）で、更新作業を含む比較先とは同じ役務ではありません。',
  comparisonHeaders: ['規模', '月額制の公開料金', '紬の総額'],
  comparisonPages: '紬{ours}ページ／比較先{theirs}ページ',
  comparisonOther: '初期{initial}円＋月{monthly}円<br><strong>{total}円</strong>',
  cheaper: '{diff}円 安い',
  dearer: '{diff}円 高い',
  comparisonNote:
    '{source}。税別。比較先は月5回の更新を含み、紬は保守・更新をご自身で行うプランです。比較先は最低6か月、36か月未満の解約で非公開と案内しています。',
  comparisonDetailTitle: '更新も任せる場合の総額',
  comparisonDetail:
    '6ページ＋「整える」＋同じ外部費概算なら、36か月{total}円（比較先より{diff}円高い）。更新量・素材・所有条件を揃えて選んでください。',
  optionReference: '参考額・個別見積もり',
  optionPreparing: '受付準備中',
  optionsTitle: '標準の内容と、追加作業',
  includedHeaders: ['標準に含むもの', '範囲'],
  optionHeaders: ['追加作業', '#目安（税別）', '条件'],
  optionNote:
    '固定料金は記載の範囲内。撮影・ロゴは参考額から個別見積もり。追加作業は内容と総額を事前に合意します。既存の契約・有効な見積もりは合意済みの条件を優先します。',
  deliveryNote:
    '確認は入口1回・ほか2回。合意した仕様の不具合修正は、回数・作業枠から引きません。撮影・取材記事・独自機能は別見積もりです。',
  termsLink: 'ご契約とお約束',
} as const;
