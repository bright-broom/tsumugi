import { japaneseSpacing } from '@/i18n/typography';
/**
 * 静的検証（ブラウザ不要）。出力された HTML と CSS を文字列として検査する。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import { checkTokens } from '../scripts/build-tokens';
import { rec } from './results';
import { HTML_BUDGET_KB } from './thresholds';

const read = (p: string) => readFileSync(p, 'utf8');
const readIf = (p: string) => (existsSync(p) ? read(p) : '');
/** 3桁区切り（9,800） */
const comma = (v: number) => v.toLocaleString('en-US');
const list = (xs: Iterable<unknown>) =>
  `[${[...xs].map((x) => (typeof x === 'string' ? `'${x}'` : String(x))).join(', ')}]`;
const all = (h: string, re: RegExp) => [...h.matchAll(re)].map((m) => m[1]!);
/** 文字数（サロゲートペアを1文字と数える） */
const chars = (s: string) => [...s].length;

/** dist 直下の HTML（＝ページ）。名前順 */
export function pages(dist: string): string[] {
  return readdirSync(dist, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name)
    .sort();
}

/** dist の中に実在するファイルを、相対パス（/ 区切り）で全部拾う（og/ や fonts/ も対象にする） */
function filesUnder(dir: string, root = dir, out = new Set<string>()): Set<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, root, out);
    else if (e.isFile()) out.add(relative(root, p).split(sep).join('/'));
  }
  return out;
}

export function checkStatic(dist: string): void {
  const files = pages(dist);
  const names = filesUnder(dist);

  if (!files.length) {
    rec('FAIL', '出力', '-', 'dist/ にHTMLがありません。npm run build を先に実行してください');
    return;
  }
  const html = new Map(files.map((f) => [f, read(join(dist, f))]));

  // トークンは design.tokens.json が正本。生成物とずれていたら納品しない（16 導入と運用）
  let tokens: { ok: boolean; message: string };
  try {
    tokens = checkTokens();
  } catch (e) {
    tokens = { ok: false, message: (e as Error).message };
  }
  rec(tokens.ok ? 'PASS' : 'FAIL', '20 トークンの同期', 'design.tokens.json', tokens.message.split('\n')[0]);

  const css = read(join(dist, 'theme.css'));

  // ガイドの数値がそのまま出ているか。書き換えたら気づけるようにする
  const GUIDE: [string, string][] = [
    ['--spacing-header-pc: 88px', 'ヘッダー高 PC 88px'],
    ['--spacing-header-mb: 72px', 'ヘッダー高 モバイル 72px'],
    ['--spacing-cta-w-pc: 315px', '主要CTA幅 PC 315px'],
    ['--spacing-cta-h-pc: 57px', '主要CTA高 PC 57px'],
    ['--spacing-cta-w-mb: 260px', '主要CTA幅 モバイル 260px'],
    ['--spacing-cta-h-mb: 48px', '主要CTA高 モバイル 48px'],
    ['--spacing-container: 1104px', '器 1104px'],
    ['--spacing-measure-read: 720px', '読み幅 720px'],
    ['--text-hero-pc: 45px', 'ヒーロー PC 45px'],
    ['--text-hero-mb: 24px', 'ヒーロー モバイル 24px'],
    ['--color-main: #FFF8ED', 'メイン70%・アイボリー #FFF8ED'],
    ['--color-sub: #302820', 'サブ20%・エスプレッソ #302820'],
    ['--color-accent: #FFB000', 'アクセント10%・琥珀 #FFB000'],
    ['--radius-media: 8px', '角丸 media 8px'],
    ['--radius-pill: 999px', '角丸 pill 999px'],
  ];
  const off = GUIDE.filter(([t]) => !css.includes(t)).map(([, d]) => d);
  rec(off.length ? 'FAIL' : 'PASS', '21 ガイドの実測値', 'tokens.css',
    off.length ? `ずれ: ${list(off)}` : `${GUIDE.length}項目すべて一致`);

  // 観測値のうち、使わないと決めたもの（05 色とテーマ）
  const banned: [string, string][] = [
    ['#858A95', '補助文字はメインとサブの混色トークンを使う'],
    ['Shippori', '日本語はガイドの端末書体スタックを使う'],
    ['fonts.googleapis.com', '外部フォントに依存しない'],
  ];
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, ''); // 説明のコメントは対象外
  const hit = banned.filter(([t]) => cssNoComments.includes(t)).map(([, m]) => m);
  rec(hit.length ? 'FAIL' : 'PASS', '22 使わないと決めた値', 'theme.css',
    hit.length ? `混入: ${list(hit)}` : '混入なし');

  // 図の色。accent（勧める側）と ok（残るもの）は同じ意味圏なので同色でよいが、
  // bad（失われるもの）が同色になると、良い話と悪い話が区別できなくなる。
  const tok = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? null;
  const good = new Set([tok('color-campaign-accent-text'), tok('color-ok')].filter((v): v is string => v !== null));
  const badColor = tok('color-alert');
  const distinct = badColor !== null && !good.has(badColor);
  rec(distinct ? 'PASS' : 'FAIL', '24 図の色（良／悪の区別）', 'tokens.css',
    distinct ? `良=${list([...good].sort())} 悪=${badColor}` : `良と悪が同色: ${badColor}`);

  const used = new Set(all(css, /var\(--([a-z0-9-]+)\)/g));
  const declared = new Set(all(css, /--([a-z0-9-]+)\s*:/g));
  const missing = [...used].filter((v) => !declared.has(v)).sort();
  rec(missing.length ? 'FAIL' : 'PASS', '17 CSSトークンの定義', 'theme.css',
    missing.length ? `未定義: ${list(missing)}` : `${declared.size}個すべて定義済み`);

  // 25 説明文の行き先。約束を書いておく場所が無いまま「やめても残ります」と書かない。
  //    どのページからも1タップで行ける必要がある（フッターに置いてある）。
  const MUST: Record<string, string> = {
    'terms.html': 'ご契約とお約束', 'privacy.html': '個人情報の取り扱い',
    'legal.html': '特定商取引法に基づく表記', 'owned.html': '借地と所有',
  };
  for (const [f, label] of Object.entries(MUST)) {
    if (!existsSync(join(dist, f))) {
      rec('FAIL', '25 必須ページ', f, `${label} がありません`);
      continue;
    }
    const miss = files.filter((p) => !html.get(p)!.includes(`href="/${f}"`));
    rec(miss.length ? 'FAIL' : 'PASS', '25 必須ページ', f,
      miss.length ? `リンクが無いページ: ${list(miss)}` : `${label}（全ページから到達可）`);
  }

  // 29 価格の一致。prices.ts の計算結果が、実際にページに出ているか。
  //    運用プランを1つ足したとき、添字で引いていた箇所が静かにずれて
  //    全ページの月額が下振れした。同じ事故を二度やらないための検査。
  const first = P.compareRows()[0]!;
  const PRICE_FACTS: [string, string, string][] = [
    [`${comma(P.run('run_basic').price)}円／月`, 'price.html', '整えるの月額'],
    [comma(P.SINGLE.price), 'index.html', 'シングルの価格'],
    [comma(P.SINGLE.price), 'price.html', 'シングルの価格'],
    [`${comma(first.sub_total)}円`, 'price.html', '月額制1ページの36か月総額'],
    [`${comma(first.our_total)}円`, 'price.html', '当方1ページの36か月総額'],
  ];
  for (const [txt, fname, what] of PRICE_FACTS) {
    // 「9,800<span class="u">円／月」のようにタグで割れているので、外してから探す
    const flat = readIf(join(dist, fname)).replace(/<[^>]+>/g, '');
    const found = flat.includes(japaneseSpacing(txt));
    rec(found ? 'PASS' : 'FAIL', '29 価格の一致', fname,
      found ? `${what} ${txt}` : `${what} ${txt} がページに出ていません`);
  }

  // 30 他社比較の出典。金額を並べる以上、いつ時点の公開情報かを必ず添える。
  for (const fname of ['index.html', 'price.html']) {
    if (!existsSync(join(dist, fname))) continue;
    const h = read(join(dist, fname));
    if (!h.includes('月額制')) continue;
    const cited = h.includes(japaneseSpacing(P.SUBS_SOURCE));
    rec(cited ? 'PASS' : 'FAIL', '30 他社比較の出典', fname,
      cited ? P.SUBS_SOURCE : '比較の金額に出典・時点の記載がありません');
  }

  // 26 主張の一貫性。トップの1番の主張と、その根拠ページが同じ言葉で書かれていること。
  const idx = readIf(join(dist, 'index.html'));
  const own = readIf(join(dist, 'owned.html'));
  const words = ['借地', '所有', '名義', 'ソースコード'].filter((w) => !(idx.includes(w) && own.includes(w)));
  rec(words.length ? 'FAIL' : 'PASS', '26 主張の一貫性', 'index.html / owned.html',
    words.length ? `片方にしか無い語: ${list(words)}` : '借地・所有・名義・ソースコードが両方にあります');

  if (existsSync(join(dist, 'llms.txt'))) {
    rec('FAIL', '禁止 llms.txt', '-', '根拠がないため作らない方針に反しています');
  } else {
    rec('PASS', '禁止 llms.txt', '-', '作られていません（方針どおり）');
  }

  for (const n of files) {
    const h = html.get(n)!;
    const kb = Buffer.byteLength(h) / 1024;

    // 01 電話番号：tel: リンクがあり、番号が文字で入っている
    const tels = all(h, /href="tel:([0-9+\-]+)"/g);
    const telText = h.includes(C.TEL);
    if (tels.length && telText) {
      const same = tels.every((t) => t.replaceAll('-', '') === C.TEL_LINK);
      rec(same ? 'PASS' : 'FAIL', '01 電話番号(tel:＋文字)', n,
        same ? `${tels.length}箇所` : `config と不一致: ${list(new Set(tels))}`);
    } else {
      rec('FAIL', '01 電話番号(tel:＋文字)', n, `tel:リンク=${tels.length} / 番号の文字=${telText}`);
    }

    // 02/03 営業時間・住所（フッターに文字で）
    const hasHours = h.includes(C.TEL_HOURS);
    const hasAddr = h.includes(C.ADDRESS_REGION) && h.includes(C.POSTAL_CODE);
    rec(hasHours && hasAddr ? 'PASS' : 'FAIL', '02-03 営業時間・住所', n,
      hasHours && hasAddr ? '' : `時間=${hasHours} 住所=${hasAddr}`);

    // 12 lang / viewport
    rec(h.includes('lang="ja"') ? 'PASS' : 'FAIL', '12 lang属性', n);
    rec(h.includes('name="viewport" content="width=device-width') ? 'PASS' : 'FAIL', '12 viewport', n);

    // h1 はちょうど1つ
    const h1 = (h.match(/<h1[\s>]/g) ?? []).length;
    rec(h1 === 1 ? 'PASS' : 'FAIL', '見出し h1 が1つ', n, `${h1}個`);

    // title / description（Next.js は head の要素に data-next-head を足すので、属性は問わない）
    const tl = chars(h.match(/<title\b[^>]*>(.*?)<\/title>/s)?.[1] ?? '');
    const dl = chars(h.match(/name="description" content="(.*?)"/s)?.[1] ?? '');
    rec(tl > 0 && tl <= 70 ? 'PASS' : 'WARN', 'title の長さ', n, `${tl}文字`);
    rec(dl >= 40 && dl <= 160 ? 'PASS' : 'WARN', 'description の長さ', n, `${dl}文字`);

    // 17 構造化データ
    const ld = h.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
    if (!ld) {
      rec('FAIL', '17 構造化データ', n, 'JSON-LD がありません');
    } else {
      try {
        const sd: unknown = JSON.parse(ld[1]!);
        const obj = sd && typeof sd === 'object' ? (sd as Record<string, unknown>) : {};
        const lack = ['@type', 'name', 'address', 'telephone'].filter((k) => !(k in obj));
        if (lack.length) {
          rec('FAIL', '17 構造化データ', n, `不足: ${list(lack)}`);
        } else if (ld[1]!.includes('FAQPage')) {
          rec('FAIL', '17 構造化データ', n, 'FAQPage は2026-05-07に表示終了。使わない方針に反します');
        } else {
          rec('PASS', '17 構造化データ', n, `@type=${obj['@type']}`);
        }
      } catch (e) {
        rec('FAIL', '17 構造化データ', n, `JSONが不正: ${(e as Error).message}`);
      }
    }

    // 07/14 画像：alt 必須・先頭画像に lazy をかけない
    const imgs = h.match(/<img\b[^>]*>/g) ?? [];
    const noAlt = imgs.filter((i) => !i.includes('alt='));
    rec(noAlt.length ? 'FAIL' : 'PASS', '07 imgのalt', n,
      noAlt.length ? `alt無し ${noAlt.length}枚` : `${imgs.length}枚すべてalt有り`);
    if (imgs.length) {
      // HTML 属性名は大小文字を区別しない。React は fetchPriority と出力する。
      const lazy = /\sloading\s*=\s*["']lazy["']/i.test(imgs[0]!);
      const prio = /\sfetchpriority\s*=\s*["']high["']/i.test(imgs[0]!);
      rec(lazy ? 'FAIL' : 'PASS', '14 先頭画像にlazyを付けない', n, lazy ? 'lazy が付いています' : '');
      rec(prio ? 'PASS' : 'WARN', '14 先頭画像に fetchpriority', n, prio ? '' : 'fetchpriority="high" 推奨');
    } else {
      rec('PASS', '14 先頭画像にlazyを付けない', n, '画像なし（文字がLCP要素＝最速）');
    }

    // 23 共有カード。URLを送るのが主要導線なので、真っ白なカードを出さない
    const og = h.match(/property="og:image" content="https:\/\/[^"]*?\/og\/([^"]+)"/);
    const tw = h.includes('name="twitter:card"');
    const favi = h.includes('rel="icon"') && h.includes('rel="apple-touch-icon"');
    if (!og) {
      rec('FAIL', '23 共有カード(OGP)', n, 'og:image がありません');
    } else if (!names.has(`og/${og[1]}`)) {
      rec('FAIL', '23 共有カード(OGP)', n, `og/${og[1]} が dist にありません。npm run og を実行してください`);
    } else if (!(tw && favi)) {
      rec('FAIL', '23 共有カード(OGP)', n, `twitter:card=${tw} / ファビコン=${favi}`);
    } else {
      rec('PASS', '23 共有カード(OGP)', n, `og/${og[1]}`);
    }

    // インラインSVG（アイコン）は装飾なので aria-hidden が必須
    const svgs = h.match(/<svg\b[^>]*>/g) ?? [];
    const badSvg = svgs.filter((x) => !x.includes('aria-hidden="true"') && !x.includes('role="img"'));
    rec(badSvg.length ? 'FAIL' : 'PASS', 'インラインSVGの aria-hidden', n,
      badSvg.length ? `欠落 ${badSvg.length}個` : `${svgs.length}個すべて aria-hidden`);

    // 実行時JSなし（0バイトを主張しているので検証する）
    const scripts = h.match(/<script\b(?![^>]*application\/ld\+json)[^>]*>/g) ?? [];
    const inlineEv = h.match(/\son(?:click|load|error|change|submit)=/g) ?? [];
    const noJs = !scripts.length && !inlineEv.length;
    rec(noJs ? 'PASS' : 'FAIL', '実行時JSなし', n, noJs ? '' : `script=${scripts.length} inline=${inlineEv.length}`);

    // 内部リンクの解決
    const dead = [...new Set(all(h, /href="([^"#:]+?)(?:#[^"]*)?"/g))]
      .filter((x) => !['http', 'mailto', 'tel', '//'].some((p) => x.startsWith(p)) && !names.has(x.replace(/^\//, '')))
      .sort();
    rec(dead.length ? 'FAIL' : 'PASS', '内部リンクの解決', n, dead.length ? `リンク切れ: ${list(dead)}` : '');

    // ページ容量
    rec(kb <= HTML_BUDGET_KB ? 'PASS' : 'WARN', 'ページ容量', n, `${kb.toFixed(1)} KB`);

    // スキップリンクと form label
    rec(h.includes('class="skip"') ? 'PASS' : 'WARN', 'スキップリンク', n);
    const ids = new Set(all(h, /<(?:input|textarea|select)[^>]*\bid="([^"]+)"/g));
    const fors = new Set(all(h, /<label[^>]*\bfor="([^"]+)"/g));
    if (ids.size || fors.size) {
      const labelOnly = [...fors].filter((x) => !ids.has(x)).sort();
      const inputOnly = [...ids].filter((x) => !fors.has(x)).sort();
      const paired = !labelOnly.length && !inputOnly.length;
      rec(paired ? 'PASS' : 'FAIL', 'フォームのlabel対応', n,
        paired ? '' : `label側=${list(labelOnly)} 入力側=${list(inputOnly)}`);
    }
  }

  // 04 料金の明示（料金ページに金額が入っている）
  const pr = readIf(join(dist, 'price.html'));
  const want = [...P.BUILD.map((b) => b.price), ...P.RUN.map((r) => r.price)].map(comma);
  const lack = want.filter((w) => !pr.includes(w));
  rec(lack.length ? 'FAIL' : 'PASS', '04 料金の明示', 'price.html',
    lack.length ? `欠落: ${list(lack)}` : '全プランの金額を掲載');

  // 05 業種でCTAを入れ替える（業種ページが4本ある）
  const ind = ['restaurant.html', 'koumuten.html', 'salon.html', 'shigyo.html'].filter((f) => existsSync(join(dist, f)));
  rec(ind.length === 4 ? 'PASS' : 'FAIL', '05 業種別ページ', '-', `${ind.length}/4`);

  // 仮の値のまま公開していないか
  if (C.PLACEHOLDER) {
    rec('WARN', '公開前チェック', 'config.ts', 'PLACEHOLDER=true。ブランド名・エリア・電話番号が仮の値です');
  } else {
    const stale = Object.entries({ TEL: C.TEL, DOMAIN: C.DOMAIN, EMAIL: C.EMAIL })
      .filter(([, v]) => v.includes('example') || v.includes('0000'))
      .map(([k]) => k);
    rec(stale.length ? 'FAIL' : 'PASS', '公開前チェック', 'config.ts',
      stale.length ? `仮の値が残っています: ${list(stale)}` : '');
  }
}
