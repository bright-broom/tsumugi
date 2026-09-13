/**
 * 価格の単一の出所（Single Source of Truth）。
 * 金額はすべて税別（円）。
 *
 * `as const` を付けているので、値から型が自動で付く。
 * 添字（RUN[1] など）では引かない ── プランを1つ足したときに
 * 全ページの月額が静かに下振れした事故があるため、必ず key で引く。
 */

export const SINGLE = {
  key: 'single',
  name: 'シングル',
  pages: 1,
  price: 39_800,
  weeks: 2,
  lede: 'まず1枚。名刺・チラシ・SNSから飛ばす先を、自分の場所にします。',
  includes: [
    '独自ドメイン取得（初日からお客様の名義）',
    'スマートフォン対応・常時SSL',
    'オンライン取材 30分（原稿はこちらで書きます）',
    'お手元の写真の補正・配置',
    'Googleビジネスプロフィールとの紐付け',
    'ソースコード一式の納品',
  ],
  notIncludes: [
    '出張撮影（オプション。ベーシック以上には標準で含まれます）',
    'ご自身で更新する管理画面（スタンダード以上）',
  ],
} as const;

export const BUILD = [
  { key: "basic", name: "ベーシック", pages: 6, price: 198000, weeks: 4,
    lede: "業種ごとに必要なページを最初から全部入れた最小構成。",
    includes: ["独自ドメイン取得（初日からお客様の名義）", "スマートフォン対応・常時SSL", "出張撮影 半日（30カット・交通費は実費）", "原稿の聞き取り作成（全ページ）", "Googleビジネスプロフィールの初期整備", "表示速度の実測レポート（2.5秒以内を保証）", "問い合わせの通知を2系統に（メール＋LINE）", "ソースコード一式の納品"] },
  { key: "standard", name: "スタンダード", pages: 9, price: 398000, weeks: 6, recommended: true,
    lede: "いちばん多く選ばれる構成。補助金を使う場合もこれを基準にします。",
    includes: ["ベーシックの内容すべて", "ご自身で更新できる管理画面", "料金表ページ", "業種に合わせた問い合わせ導線の設計", "料金・費用・選び方の解説記事 3本", "お知らせ／ブログ機能"] },
  { key: "pro", name: "プロ", pages: 14, price: 698000, weeks: 10,
    lede: "施工事例や取扱分野が増えていく事業に。データベースとして設計します。",
    includes: ["スタンダードの内容すべて", "施工事例・取扱分野のデータベース化（絞り込み検索つき）", "出張撮影 1日（80カット・交通費は実費）", "対応エリアページ（市町村ごと）", "スタッフ紹介", "お客様の声", "解説記事 3本追加（計6本）"] },
] as const;

export const INSTALLMENT_COUNT = 24;
export const INSTALLMENT = {
  basic: { initial: 30_000, monthly: 7_000 },
  standard: { initial: 110_000, monthly: 12_000 },
  pro: { initial: 218_000, monthly: 20_000 },
} as const;

export const RUN = [
  { key: "run_light", name: "ライト", price: 5800,
    lede: "1ページのサイトを、動く状態で保つだけの最小構成。",
    includes: ["修正・更新 何回でも", "サーバー・ドメイン・SSLの管理", "毎週のバックアップ", "障害対応（表示されない・改ざんされた）"] },
  { key: "run_basic", name: "ベーシック", price: 9800,
    lede: "作ったあとを維持する最小構成。",
    includes: ["修正・更新 何回でも", "サーバー・ドメイン・SSLの管理", "毎週のバックアップ", "障害対応（表示されない・改ざんされた）", "管理画面とプラグインの更新", "Googleビジネスプロフィールの情報同期"] },
  { key: "run_standard", name: "スタンダード", price: 16000, recommended: true,
    lede: "Googleマップからの来店を増やす運用まで。",
    includes: ["ベーシックの内容すべて", "Googleマップの投稿 月4回（写真つき）", "口コミへの返信代行（定型文は使いません）", "月次レポート（閲覧数・流入・問い合わせ件数）", "検索エラーの監視", "記事の作成 3か月に1本"] },
  { key: "run_growth", name: "グロース", price: 29800,
    lede: "広告と掲載費の全体を見直すところまで。",
    includes: ["スタンダードの内容すべて", "広告運用（月の広告予算20万円まで・手数料込み）", "クリック単価・獲得単価の改善", "ポータルサイト掲載費の棚卸しと見直し提案", "記事の作成 月1本", "月1回のオンライン相談（30分）"] },
] as const;
export const RUN_TERM = '3か月単位';

export type BuildKey = (typeof BUILD)[number]['key'];
export type RunKey = (typeof RUN)[number]['key'];

export function build(key: BuildKey) {
  const b = BUILD.find((p) => p.key === key);
  if (!b) throw new Error(`unknown build plan: ${key}`);
  return b;
}

export function run(key: RunKey) {
  const r = RUN.find((p) => p.key === key);
  if (!r) throw new Error(`unknown run plan: ${key}`);
  return r;
}

export const OPTIONS = [
  { name: "ページ追加（既存構成にないもの）", price: 33000, note: "原稿・写真の聞き取り込み" },
  { name: "出張撮影 半日（30カット・交通費は実費）", price: 55000, note: "全プランに標準で含まれます" },
  { name: "出張撮影 1日（80カット・交通費は実費）", price: 88000, note: "プロプランに標準で含まれます" },
  { name: "ロゴ制作（3案・使用ルール付き）", price: 88000, note: "—" },
  { name: "記事の作成（取材あり）", price: 55000, note: "取材なしは運用プランに含まれます" },
  { name: "ランディングページ 1枚", price: 198000, note: "キャンペーン・単一商品向け" },
  { name: "予約システムの連携", price: 55000, note: "月額はお客様が直接ご契約（当方は設定費のみ）" },
  { name: "多言語対応 1言語（10ページ以下）", price: 165000, note: "—" },
] as const;

// ── 月額制（サブスク型）との総額比較 ────────────────
// 金額は各社が公開している料金ページの表示値。サイトに他社名は書かない。
export const COMPARE_MONTHS = 36;
export const SUBS_TRANSFER_MONTHS = 36;
export const SUBS_MIN_TERM = 6;
export const SUBS_SOURCE = '各社が公開している料金ページ（2026年9月時点）';

export const SUBS_MARKET = [
  { name: '月額制A社 1ページ', pages: 1, init: 5_000, monthly: 9_800 },
  { name: '月額制A社 2〜6ページ', pages: 6, init: 5_000, monthly: 14_800 },
  { name: '月額制A社 7〜12ページ', pages: 12, init: 5_000, monthly: 19_800 },
] as const;

export const subsTotal = (m: (typeof SUBS_MARKET)[number], months = COMPARE_MONTHS) =>
  m.init + m.monthly * months;

export const oursTotal = (price: number, runKey: RunKey, months = COMPARE_MONTHS) =>
  price + run(runKey).price * months;

export const monthlyAllIn = (buildKey: keyof typeof INSTALLMENT, runKey: RunKey) =>
  INSTALLMENT[buildKey].monthly + run(runKey).price;

export const yen = (n: number) => `${n.toLocaleString('en-US')}円`;

export const FREE_ITEMS = [{"name": "修正・更新（無制限の範囲内）", "market": "他社の相場は1箇所3,000〜5,500円"}, {"name": "ソースコード一式の納品", "market": "GitHubに閲覧権限でご招待します"}, {"name": "構造化データの設定", "market": "Googleに business の情報を正しく伝える設定"}, {"name": "表示速度の実測レポート", "market": "2.5秒以内を納品条件として保証します"}, {"name": "Googleビジネスプロフィールの連携設定", "market": "Googleの規約に沿った正しい紐付け"}] as const;
export const MARKET_SPOT = [{"name": "文章の修正", "price": "3,000円／箇所"}, {"name": "画像の差し替え", "price": "5,000円／箇所"}, {"name": "作業時間で課金", "price": "10,000円／時間"}, {"name": "ページ追加", "price": "20,000円／ページ"}] as const;

/** ここから下は prices.py から機械生成した。手で書き写さない */
export const UNLIMITED_IN = ["文章の修正・差し替え", "写真の差し替え", "メニュー・料金の変更", "営業時間・定休日の変更", "お知らせの投稿", "スタッフの追加・入れ替え", "施工事例・スタイルの追加", "リンクの修正", "既存ページの中での並べ替え"] as const;
export const UNLIMITED_OUT: [name: string, detail: string, price: string][] = [["新しいページの追加", "既存の構成にないページ", "33,000円／ページ"], ["デザインの全面変更", "配色・レイアウトを一から作り直す場合", "都度お見積り"], ["他社サイトからの移管", "既存サイトの引っ越し", "都度お見積り"], ["新しい機能の追加", "予約システム・ネットショップ・会員機能など", "都度お見積り"], ["ロゴの新規制作", "—", "88,000円"], ["撮影の追加", "半日／1日", "55,000円／88,000円"]];
export const UNLIMITED_NOTE = "実際のご依頼は月1〜2時間で収まることが多いです。それを超えても追加請求はしません。ただし3か月の平均で月4時間を大きく超える場合は、上位のプランをご案内します。";

/** ページ数の近いものどうしを並べる。当方が高い行も、そのまま出す */
export function compareRows(months = COMPARE_MONTHS) {
  const pairs: [(typeof SUBS_MARKET)[number], number, RunKey, string, number][] = [
    [SUBS_MARKET[0]!, SINGLE.price, 'run_light', SINGLE.name, SINGLE.pages],
    [SUBS_MARKET[1]!, BUILD[0]!.price, 'run_basic', BUILD[0]!.name, BUILD[0]!.pages],
    [SUBS_MARKET[2]!, BUILD[1]!.price, 'run_standard', BUILD[1]!.name, BUILD[1]!.pages],
  ];
  return pairs.map(([sub, price, runKey, name, pages]) => {
    const st = subsTotal(sub, months);
    const ot = oursTotal(price, runKey, months);
    return {
      sub_name: sub.name, sub_pages: sub.pages, sub_monthly: sub.monthly, sub_total: st,
      our_name: name, our_pages: pages, our_price: price, our_run: run(runKey).price,
      our_total: ot, diff: ot - st,
    };
  });
}

/** シングルの買い切り額が、月額制の何か月分にあたるか */
export const singleVsSubsMonths = () => SINGLE.price / SUBS_MARKET[0]!.monthly;

/** 小規模事業者持続化補助金。prices.py から機械生成した */
export const SUBSIDY = {
  name: "小規模事業者持続化補助金（一般型・通常枠）",
  round: "第20回",
  rate_text: "3分の2",
  cap: 500000,
  web_cap: 300000,
  deadline: "2026年12月15日（火）17:00",
  form4_deadline: "2026年12月4日（金）",
  adoption_rate: "47.2%",
  adoption_detail: "第19回は16,576件の申請に対し7,819件が採択",
  package: [["ウェブサイト関連費", "スタンダード 9ページ（撮影・原稿込み）", 398000], ["広報費", "ショップカード・チラシ制作＋印刷1,000部", 150000], ["広報費", "店頭看板／のぼり デザイン＋制作", 100000], ["広報費", "追加撮影（商品・スタッフ）1日", 88000], ["広報費", "メニュー表・料金表のデザイン＋印刷", 64000]] as [kind: string, detail: string, price: number][],
};

// ── ポータルサイトの掲載料（公開されている料金を税込に換算） ──
export const PORTAL_TABELOG: [name: string, monthly: number][] = [
  ['プレミアム10', 110_000],
  ['プレミアム5', 55_000],
  ['ベーシック', 27_500],
  ['ライト', 11_000],
  ['無料掲載', 0],
];
export const PORTAL_FEE_DINNER = 220; // 税込・1人あたり
export const PORTAL_FEE_LUNCH = 110;

/** 補助金の内訳。int() は Python と同じく切り捨てなので Math.floor でそろえる */
export function subsidyCalc() {
  const items = SUBSIDY.package;
  const sum = (f: (k: string) => boolean) =>
    items.filter(([k]) => f(k)).reduce((a, [, , v]) => a + v, 0);
  const total = sum(() => true);
  const web = sum((k) => k === 'ウェブサイト関連費');
  const pr = sum((k) => k === '広報費');
  const webSub = Math.min(Math.floor((web * 2) / 3), SUBSIDY.web_cap);
  const prSub = Math.floor((pr * 2) / 3);
  const grant = Math.min(webSub + prSub, SUBSIDY.cap);
  return { total, web, pr, web_sub: webSub, pr_sub: grant - webSub, grant, net: total - grant };
}

/** 分割の総額と、買い切りの金額。ふたつが一致することを verify が見ている */
export const totalInstallment = (key: keyof typeof INSTALLMENT): [total: number, price: number] => [
  INSTALLMENT[key].initial + INSTALLMENT[key].monthly * INSTALLMENT_COUNT,
  build(key).price,
];
