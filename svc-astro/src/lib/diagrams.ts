/**
 * 図。どれも本文で説明している「仕組み」を置き換えるためのもので、飾りは入れない。
 * svc/diagrams.py の移植。出力は SVG の文字列で、ビルド時にHTMLへ焼かれる。
 *
 * 配色の方針：
 * - 構造線・文字・囲みは currentColor（不透明度で濃淡をつける）。
 *   これで明るい節・墨紺の節のどこに置いても成立する。
 * - 意味を持つ色は3つだけ。--fig-accent＝勧める側、--fig-ok＝残るもの、--fig-bad＝失われるもの。
 * - viewBox でサイズを決め、表示幅は CSS に任せる。
 * - role="img" と aria-label は必須（verify.py が検査する）。
 */

const BOX_F = 'fill="currentColor" fill-opacity=".045"';
const BOX_S = 'stroke="currentColor" stroke-width="1.4" stroke-opacity=".55"';
const DIM = 'fill="currentColor" opacity=".72"';

const DEFS =
  '<defs>' +
  '<marker id="dg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
  'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>' +
  '<marker id="dg-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
  'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--fig-accent)"/></marker>' +
  '</defs>';

/** 3桁区切り。Python の f"{n:,}" と同じ */
const c = (n: number) => n.toLocaleString('en-US');

/**
 * Python の round() と同じ丸め（偶数丸め）。
 * JS の Math.round は 0.5 を必ず切り上げるので、
 * 340 × 500,000 ÷ 800,000 = 212.5 が Python では 212、JS では 213 になる。
 * 帯の幅が1pxずれるだけだが、移植で静かにずれる典型なので合わせておく。
 */
export function rnd(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;   // ちょうど .5 は偶数側へ
}

/** marker の id はページ内で衝突させない。ビルド全体で通し番号を振る */
let SEQ = 0;

type Narrow = [svg: string, viewBox: string];

function fig(svg: string, caption: string, label: string, vb: string, narrow?: Narrow): string {
  SEQ += 1;
  const n = SEQ;
  const uniq = (x: string) => x.replaceAll('dg-a', `dg-a${n}`).replaceAll('dg-p', `dg-p${n}`);
  let out = `<svg class="fw" role="img" aria-label="${label}" viewBox="${vb}">${uniq(DEFS + svg)}</svg>`;
  if (narrow) {
    SEQ += 1;
    const m = SEQ;
    const nu = (DEFS + narrow[0]).replaceAll('dg-a', `dg-a${m}`).replaceAll('dg-p', `dg-p${m}`);
    out += `<svg class="fn" role="img" aria-label="${label}" viewBox="${narrow[1]}">${nu}</svg>`;
  }
  const cls = narrow ? 'fig has-narrow' : 'fig';
  const hint = narrow ? '' : '<p class="fig-hint" aria-hidden="true">指でヨコに動かせます</p>';
  return `<figure class="${cls}">${out}${hint}<figcaption>${caption}</figcaption></figure>`;
}

const cap = (x: number, y: number, t: string) =>
  `<text x="${x}" y="${y}" font-size="12" font-weight="700" ${DIM}>${t}</text>`;

function box(x: number, y: number, w: number, h: number, title: string, sub = '', accent = false) {
  let t = accent
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${BOX_F} ${BOX_S}/>`;
  const cx = x + w / 2;
  if (sub) {
    t += `<text x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`
       + `<text x="${cx}" y="${y + h / 2 + 18}" text-anchor="middle" font-size="12" ${DIM}>${sub}</text>`;
  } else {
    t += `<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`;
  }
  return t;
}

function arrow(x1: number, y: number, x2: number, label: string, accent = false, dy = 11) {
  const col = accent ? 'var(--fig-accent)' : 'currentColor';
  const mk = accent ? 'dg-p' : 'dg-a';
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="1.6" marker-end="url(#${mk})"/>`
       + `<text x="${(x1 + x2) / 2}" y="${y - dy}" text-anchor="middle" font-size="12" ${DIM}>${label}</text>`;
}

// ── スマホ用の組み直し ───────────────────────────
const NW = 340;

function vbox(y: number, h: number, title: string, sub = '', accent = false) {
  let t = accent
    ? `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
    : `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" ${BOX_F} ${BOX_S}/>`;
  const cx = NW / 2;
  if (sub) {
    t += `<text x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`
       + `<text x="${cx}" y="${y + h / 2 + 17}" text-anchor="middle" font-size="12" ${DIM}>${sub}</text>`;
  } else {
    t += `<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`;
  }
  return t;
}

function vdown(y1: number, y2: number, label: string, accent = false, x = 44, ly?: number) {
  const col = accent ? 'var(--fig-accent)' : 'currentColor';
  const mk = accent ? 'dg-p' : 'dg-a';
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="1.6" marker-end="url(#${mk})"/>`
       + `<text x="${x + 14}" y="${ly ?? (y1 + y2) / 2 + 4}" font-size="12" ${DIM}>${label}</text>`;
}

// ═══════════════ 1. 借りている場所 / 自分の場所
function rentVsOwnNarrow(portal: number, fee: number, run: number): Narrow {
  const s = [
    cap(0, 12, 'いま ── 借りている場所を通す'),
    vbox(24, 54, 'お客様', ''),
    vdown(86, 122, `掲載料 月${c(portal)}円`),
    vbox(130, 58, 'ポータルサイト', '借りている場所'),
    vdown(196, 244, `予約1件ごと ${fee}円`, false, 44, 208),
    `<line x1="14" y1="228" x2="${NW - 14}" y2="228" stroke="var(--fig-bad)" stroke-width="1.5" stroke-dasharray="5 5"/>`,
    '<path d="M36 220 L52 236 M52 220 L36 236" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>',
    `<text x="${NW}" y="264" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">掲載をやめた日に、ここが切れます</text>`,
    vbox(276, 50, 'お店'),
    cap(0, 368, 'これから ── 自分の場所を通す'),
    vbox(380, 54, 'お客様', ''),
    vdown(442, 478, `運用費 月${c(run)}円`, true),
    vbox(486, 58, '自分のサイト', 'お客様の資産', true),
    vdown(552, 588, '手数料 0円', true),
    vbox(600, 50, 'お店'),
    `<text x="${NW / 2}" y="674" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">やめても残ります。中身もドメインもお客様の名義</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 684`];
}

export function rentVsOwn(portal = 27_500, fee = 220, run = 16_000) {
  const s = [
    cap(0, 16, 'いま ── 借りている場所を通す'),
    box(0, 32, 124, 66, 'お客様', '検索する人'),
    arrow(130, 65, 248, `掲載料 月${c(portal)}円`),
    box(254, 28, 212, 74, 'ポータルサイト', '借りている場所'),
    arrow(472, 65, 590, `予約1件ごと ${fee}円`, false, 25),
    box(596, 32, 124, 66, 'お店'),
    '<line x1="530" y1="48" x2="530" y2="118" stroke="var(--fig-bad)" stroke-width="1.5" stroke-dasharray="5 5"/>',
    '<path d="M522 56 L538 72 M538 56 L522 72" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>',
    '<text x="530" y="134" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-bad)">掲載をやめた日に、ここが切れます</text>',
    cap(0, 188, 'これから ── 自分の場所を通す'),
    box(0, 204, 124, 66, 'お客様', '検索する人'),
    arrow(130, 237, 248, `運用費 月${c(run)}円`, true),
    box(254, 200, 212, 74, '自分のサイト', 'お客様の資産', true),
    arrow(472, 237, 590, '手数料 0円', true),
    box(596, 204, 124, 66, 'お店'),
    '<text x="361" y="302" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-ok)">やめても残ります。ドメインも中身も、最初からお客様の名義</text>',
  ];
  return fig(
    s.join(''),
    'ポータル経由は掲載料と1件ごとの手数料がかかり、掲載をやめた日に流入が止まります。' +
      '自分のサイトは運用費だけで、やめても残ります。',
    `上下2段の流れ図。上段はお客様からポータルサイトを経由してお店へ。掲載料が月${c(portal)}円、` +
      `予約1件ごとに${fee}円かかり、掲載をやめるとお客様からの経路が切れる。` +
      `下段はお客様から自分のサイトを経由してお店へ。運用費が月${c(run)}円だけで手数料はゼロ、` +
      'やめてもサイトは残る。',
    '0 0 722 312',
    rentVsOwnNarrow(portal, fee, run),
  );
}

// ═══════════════ 2. 掲載費の振替
function moneyFlowNarrow(portal: number, run: number): Narrow {
  const rest = portal - run;
  const w1 = rnd((NW * run) / portal);
  const s = [
    cap(0, 12, 'いま'),
    `<rect x="0" y="22" width="${NW}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${NW / 2}" y="52" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">食べログ ベーシック 月${c(portal)}円</text>`,
    `<line x1="${NW / 2}" y1="78" x2="${NW / 2}" y2="108" stroke="var(--fig-accent)" stroke-width="1.6" marker-end="url(#dg-p)"/>`,
    `<text x="${NW / 2}" y="130" text-anchor="middle" font-size="12.5" ${DIM}>無料プランに戻す（ネット予約は使えます）</text>`,
    cap(0, 158, 'これから'),
    `<rect x="0" y="168" width="${w1 - 4}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${w1 / 2 - 2}" y="190" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">運用費</text>`,
    `<text x="${w1 / 2 - 2}" y="206" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${c(run)}円</text>`,
    `<rect x="${w1}" y="168" width="${NW - w1}" height="48" rx="8" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${w1 + (NW - w1) / 2}" y="190" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">手残り</text>`,
    `<text x="${w1 + (NW - w1) / 2}" y="206" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${c(rest)}円</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 226`];
}

export function moneyFlow(portal = 27_500, run = 16_000) {
  const rest = portal - run;
  const x = 78, w = 602;
  const w1 = rnd((w * run) / portal);
  const s = [
    cap(0, 58, 'いま'),
    `<rect x="${x}" y="26" width="${w}" height="50" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${x + w / 2}" y="57" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">食べログ ベーシック　月${c(portal)}円</text>`,
    `<line x1="${x + w / 2}" y1="84" x2="${x + w / 2}" y2="112" stroke="var(--fig-accent)" stroke-width="1.6" marker-end="url(#dg-p)"/>`,
    `<text x="${x + w / 2 + 12}" y="106" font-size="12" ${DIM}>無料プランに戻す（ネット予約はそのまま使えます）</text>`,
    cap(0, 156, 'これから'),
    `<rect x="${x}" y="124" width="${w1 - 5}" height="50" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${x + w1 / 2 - 2}" y="155" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">運用費 ${c(run)}円</text>`,
    `<rect x="${x + w1}" y="124" width="${w - w1}" height="50" rx="8" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${x + w1 + (w - w1) / 2}" y="155" text-anchor="middle" font-size="15" font-weight="700" fill="var(--fig-ok)">手残り ${c(rest)}円</text>`,
  ];
  return fig(
    s.join(''),
    `掲載料を無料プランに戻すと、運用費${c(run)}円をお支払いいただいてもなお毎月${c(rest)}円が残ります（プランと契約更新月によります）。`,
    `帯グラフ。上段は食べログのベーシックプラン月${c(portal)}円。下段はそれが運用費${c(run)}円と手残り${c(rest)}円に分かれた状態。`,
    '0 0 700 192',
    moneyFlowNarrow(portal, run),
  );
}

// ═══════════════ 3. 24か月払ったあとに何が残るか
function afterTwoYearsNarrow(rivalM: number, oursInit: number, oursM: number, months: number): Narrow {
  const rivalTotal = rivalM * months;
  const oursTotal = oursInit + oursM * months;
  const s = [
    cap(0, 14, `${months}か月ぶんを払ったあと`),
    `<rect x="0" y="26" width="${NW}" height="96" rx="8" ${BOX_F} ${BOX_S}/>`,
    '<text x="16" y="50" font-size="14" font-weight="700" fill="currentColor">他社の月額制（5ページ）</text>',
    `<text x="16" y="74" font-size="13.5" fill="currentColor">月${c(rivalM)}円 × ${months}か月 ＝ ${c(rivalTotal)}円</text>`,
    '<path d="M18 94 L32 108 M32 94 L18 108" stroke="var(--fig-bad)" stroke-width="2.6" stroke-linecap="round"/>',
    '<text x="42" y="106" font-size="13" font-weight="700" fill="var(--fig-bad)">解約するとサイトは消えます</text>',
    `<rect x="0" y="140" width="${NW}" height="118" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    '<text x="16" y="164" font-size="14" font-weight="700" fill="currentColor">紬（9ページ）</text>',
    `<text x="16" y="188" font-size="13.5" fill="currentColor">初回${c(oursInit)}円＋月${c(oursM)}円×${months}か月</text>`,
    `<text x="16" y="208" font-size="13.5" fill="currentColor">＝ ${c(oursTotal)}円</text>`,
    '<path d="M18 224 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    '<text x="42" y="232" font-size="13" font-weight="700" fill="var(--fig-ok)">サイトはお客様のもの</text>',
    '<text x="42" y="250" font-size="13" font-weight="700" fill="var(--fig-ok)">以降は運用費だけ</text>',
  ];
  return [s.join(''), `0 0 ${NW} 268`];
}

export function afterTwoYears(rivalM: number, oursInit: number, oursM: number, months = 24) {
  const rivalTotal = rivalM * months;
  const oursTotal = oursInit + oursM * months;
  const x0 = 104, x1 = 516;
  const s: string[] = [];
  for (const [i, lab] of [[0, 'ご契約'], [12, '1年'], [months, `${Math.floor(months / 12)}年`]] as [number, string][]) {
    const px = x0 + ((x1 - x0) * i) / months;
    s.push(`<line x1="${px}" y1="24" x2="${px}" y2="246" stroke="currentColor" stroke-width="1" stroke-dasharray="3 5" opacity=".3"/>`);
    s.push(`<text x="${px}" y="266" text-anchor="middle" font-size="12" ${DIM}>${lab}</text>`);
  }
  s.push(
    '<text x="0" y="58" font-size="13" font-weight="700" fill="currentColor">他社の月額制</text>',
    `<text x="0" y="76" font-size="11.5" ${DIM}>5ページ</text>`,
    `<rect x="${x0}" y="40" width="${x1 - x0}" height="46" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${(x0 + x1) / 2}" y="69" text-anchor="middle" font-size="13.5" fill="currentColor">月${c(rivalM)}円 × ${months}か月 ＝ ${c(rivalTotal)}円</text>`,
    `<path d="M${x1 + 14} 54 L${x1 + 31} 71 M${x1 + 31} 54 L${x1 + 14} 71" stroke="var(--fig-bad)" stroke-width="2.6" stroke-linecap="round"/>`,
    `<text x="${x1 + 42}" y="59" font-size="12.5" font-weight="700" fill="var(--fig-bad)">解約するとサイトは</text>`,
    `<text x="${x1 + 42}" y="77" font-size="12.5" font-weight="700" fill="var(--fig-bad)">消えます</text>`,
    '<text x="0" y="170" font-size="13" font-weight="700" fill="currentColor">当方</text>',
    `<text x="0" y="188" font-size="11.5" ${DIM}>9ページ</text>`,
    `<rect x="${x0}" y="152" width="${x1 - x0}" height="46" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="${(x0 + x1) / 2}" y="181" text-anchor="middle" font-size="13.5" fill="currentColor">初回${c(oursInit)}円＋月${c(oursM)}円×${months}か月 ＝ ${c(oursTotal)}円</text>`,
    `<path d="M${x1 + 15} 172 l7 8 l13 -15" fill="none" stroke="var(--fig-ok)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${x1 + 42}" y="171" font-size="12.5" font-weight="700" fill="var(--fig-ok)">サイトはお客様のもの</text>`,
    `<text x="${x1 + 42}" y="189" font-size="12.5" font-weight="700" fill="var(--fig-ok)">以降は運用費だけ</text>`,
    `<line x1="${x1}" y1="198" x2="${x1}" y2="226" stroke="var(--fig-ok)" stroke-width="1.4"/>`,
    `<text x="${x1 - 8}" y="222" text-anchor="end" font-size="12" ${DIM}>制作費のお支払いはここで終わり</text>`,
  );
  return fig(
    s.join(''),
    `同じ${months}か月を払ったあと、片方はサイトが消え、片方はお客様のものになります。他社の条件は各社が公開している情報から（2026年9月時点）。`,
    `${months}か月の時間軸に2本の帯。他社の月額制は月${c(rivalM)}円かける${months}か月で${c(rivalTotal)}円、解約するとサイトが消える。当方は初回${c(oursInit)}円と月${c(oursM)}円かける${months}か月で${c(oursTotal)}円、${months}か月後にサイトはお客様のものになり、制作費の支払いは終わって運用費だけになる。`,
    '0 0 722 282',
    afterTwoYearsNarrow(rivalM, oursInit, oursM, months),
  );
}

// ═══════════════ 4. 補助金の内訳
function subsidyBarNarrow(total: number, web: number, pr: number, grant: number, net: number): Narrow {
  const ww = rnd((NW * web) / total);
  const gw = rnd((NW * grant) / total);
  const s = [
    cap(0, 12, `かかる費用 ${c(total)}円`),
    `<rect x="0" y="22" width="${ww - 4}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww / 2 - 2}" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">ホームページ</text>`,
    `<text x="${ww / 2 - 2}" y="62" text-anchor="middle" font-size="12.5" ${DIM}>${c(web)}円</text>`,
    `<rect x="${ww}" y="22" width="${NW - ww}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww + (NW - ww) / 2}" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">チラシ・看板</text>`,
    `<text x="${ww + (NW - ww) / 2}" y="62" text-anchor="middle" font-size="12.5" ${DIM}>${c(pr)}円</text>`,
    `<line x1="${NW / 2}" y1="82" x2="${NW / 2}" y2="106" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    cap(0, 132, '採択された場合'),
    `<rect x="0" y="142" width="${gw - 4}" height="52" rx="7" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${gw / 2 - 2}" y="164" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-ok)">補助金</text>`,
    `<text x="${gw / 2 - 2}" y="182" text-anchor="middle" font-size="12.5" fill="var(--fig-ok)">${c(grant)}円</text>`,
    `<rect x="${gw}" y="142" width="${NW - gw}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${gw + (NW - gw) / 2}" y="164" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">ご負担</text>`,
    `<text x="${gw + (NW - gw) / 2}" y="182" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${c(net)}円</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 204`];
}

export function subsidyBar(total: number, web: number, pr: number, grant: number, net: number) {
  const w = 700;
  const ww = rnd((w * web) / total);
  const gw = rnd((w * grant) / total);
  const s = [
    cap(0, 14, `かかる費用 ${c(total)}円`),
    `<rect x="0" y="26" width="${ww - 5}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww / 2 - 2}" y="50" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">ホームページ</text>`,
    `<text x="${ww / 2 - 2}" y="68" text-anchor="middle" font-size="12" ${DIM}>${c(web)}円</text>`,
    `<rect x="${ww}" y="26" width="${w - ww}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww + (w - ww) / 2}" y="50" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">チラシ・看板・撮影</text>`,
    `<text x="${ww + (w - ww) / 2}" y="68" text-anchor="middle" font-size="12" ${DIM}>${c(pr)}円</text>`,
    `<line x1="${w / 2}" y1="86" x2="${w / 2}" y2="110" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    cap(0, 136, '採択された場合'),
    `<rect x="0" y="148" width="${gw - 5}" height="52" rx="7" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${gw / 2 - 2}" y="172" text-anchor="middle" font-size="13" font-weight="700" fill="var(--fig-ok)">補助金</text>`,
    `<text x="${gw / 2 - 2}" y="190" text-anchor="middle" font-size="12" fill="var(--fig-ok)">${c(grant)}円</text>`,
    `<rect x="${gw}" y="148" width="${w - gw}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${gw + (w - gw) / 2}" y="172" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">ご負担</text>`,
    `<text x="${gw + (w - gw) / 2}" y="190" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${c(net)}円</text>`,
  ];
  return fig(
    s.join(''),
    `ホームページ単独では申請できないので、チラシ・看板・撮影とまとめて${c(total)}円で組みます。採択された場合のご負担は${c(net)}円です。`,
    `2段の帯グラフ。上段は費用${c(total)}円の内訳で、ホームページ${c(web)}円とチラシ・看板・撮影${c(pr)}円。下段は同じ幅を補助金${c(grant)}円とご負担${c(net)}円に分けた比率。`,
    '0 0 700 208',
    subsidyBarNarrow(total, web, pr, grant, net),
  );
}

// ═══════════════ 5. 補助金の順序（交付決定の前に着手しない）
const short = (d: string) => {
  const m = /(\d+)月(\d+)日/.exec(d);
  return m ? `${m[1]}/${m[2]}` : d;
};

function subsidyTimelineNarrow(form4: string, deadline: string): Narrow {
  const steps: [string, string, boolean][] = [
    ['商工会へ', `様式4 ${short(form4)}まで`, false],
    ['申請', `${short(deadline)}まで`, false],
    ['交付決定', '待つ', false],
    ['契約・着手', 'ここから', true],
    ['報告・入金', '精算払い', true],
  ];
  const h = 52, gap = 22;
  const s = [cap(0, 14, '上から下へ。順番を入れ替えられません')];
  let y = 26;
  const ys: number[] = [];
  for (const [t, sub, acc] of steps) {
    ys.push(y);
    s.push(acc
      ? `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
      : `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" ${BOX_F} ${BOX_S}/>`);
    s.push(`<text x="16" y="${y + 22}" font-size="14" font-weight="700" fill="currentColor">${t}</text>`);
    s.push(`<text x="16" y="${y + 40}" font-size="12.5" ${DIM}>${sub}</text>`);
    y += h + gap;
  }
  const gy = ys[3]! - gap / 2;
  s.push(`<line x1="0" y1="${gy}" x2="${NW}" y2="${gy}" stroke="var(--fig-bad)" stroke-width="2" stroke-dasharray="6 5"/>`);
  s.push(`<text x="0" y="${gy - 6}" font-size="12.5" font-weight="700" fill="var(--fig-bad)">この線より前に契約・着手すると全額が対象外</text>`);
  for (let i = 0; i < steps.length - 1; i++) {
    if (i === 2) continue;
    s.push(`<line x1="20" y1="${ys[i]! + h + 3}" x2="20" y2="${ys[i + 1]! - 4}" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`);
  }
  s.push(`<text x="${NW}" y="${y + 6}" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">契約書の日付も、交付決定日より後に</text>`);
  return [s.join(''), `0 0 ${NW} ${y + 16}`];
}

export function subsidyTimeline(form4: string, deadline: string) {
  const y = 96, bh = 44;
  const steps: [number, number, string, string][] = [
    [0, 150, '商工会へ', `様式4 ${short(form4)}まで`],
    [164, 140, '申請', `${short(deadline)}まで`],
    [318, 134, '交付決定', '待つ'],
    [482, 140, '契約・着手', 'ここから'],
    [638, 132, '報告・入金', '精算払い'],
  ];
  const s: string[] = [];
  steps.forEach(([x, w, t, sub], i) => {
    s.push(i >= 3
      ? `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="8" ${BOX_F} ${BOX_S}/>`);
    s.push(`<text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${t}</text>`);
    s.push(`<text x="${x + w / 2}" y="${y + 36}" text-anchor="middle" font-size="11.5" ${DIM}>${sub}</text>`);
    if (i < steps.length - 1) {
      s.push(`<line x1="${x + w + 3}" y1="${y + bh / 2}" x2="${steps[i + 1]![0] - 4}" y2="${y + bh / 2}" stroke="currentColor" stroke-width="1.4" marker-end="url(#dg-a)"/>`);
    }
  });
  const gx = 474;
  s.push(`<line x1="${gx}" y1="46" x2="${gx}" y2="196" stroke="var(--fig-bad)" stroke-width="2" stroke-dasharray="6 5"/>`);
  s.push(`<text x="${gx - 10}" y="40" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">この線より前に発注・契約・着手すると</text>`);
  s.push(`<text x="${gx - 10}" y="58" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">全額が対象外になります</text>`);
  s.push(`<text x="${gx + 10}" y="186" font-size="12.5" font-weight="700" fill="var(--fig-ok)">契約書の日付も、交付決定日より後にします</text>`);
  return fig(
    s.join(''),
    `様式4は${form4}まで、申請は${deadline}まで。順序さえ守れば難しくありませんが、守らないと全額が対象外になります。`,
    `補助金の手順を左から右に並べた図。商工会で様式4を${form4}までに取り、${deadline}までに申請し、交付決定を待つ。交付決定より前に発注・契約・着手すると全額が対象外になる。決定後に契約・着手し、報告して精算払いで入金される。`,
    '0 0 776 206',
    subsidyTimelineNarrow(form4, deadline),
  );
}

// ═══════════════ 6. 借地と所有（主張の中心）
interface LandOpts {
  yCap?: number; yBld?: number; hBld?: number; yGnd?: number; hGnd?: number;
  yA1?: number; yA2?: number; yRes?: number; hRes?: number; inset?: number;
}
function landPanel(
  x0: number, w: number, capText: string, groundSub: string,
  resTitle: string, resSub: string, ok: boolean, o: LandOpts = {},
) {
  const { yCap = 14, yBld = 28, hBld = 64, yGnd = 100, hGnd = 42,
          yA1 = 150, yA2 = 186, yRes = 196, hRes = 68, inset = 30 } = o;
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  const cx = x0 + w / 2;
  const bx = x0 + inset, bw = w - inset * 2;
  return [
    cap(x0, yCap, capText),
    `<rect x="${bx}" y="${yBld}" width="${bw}" height="${hBld}" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${cx}" y="${yBld + 26}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">ページ・写真・原稿</text>`,
    `<text x="${cx}" y="${yBld + 46}" text-anchor="middle" font-size="12.5" ${DIM}>あなたが費用を出したもの</text>`,
    `<rect x="${x0}" y="${yGnd}" width="${w}" height="${hGnd}" rx="6" ${BOX_F} ${BOX_S}/>`,
    `<text x="${cx}" y="${yGnd + 20}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">土地 ＝ ドメインとサーバー</text>`,
    `<text x="${cx}" y="${yGnd + 36}" text-anchor="middle" font-size="12.5" ${DIM}>${groundSub}</text>`,
    `<line x1="${cx}" y1="${yA1}" x2="${cx}" y2="${yA2}" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    `<text x="${cx + 13}" y="${(yA1 + yA2) / 2 + 4}" font-size="12" ${DIM}>解約した日</text>`,
    `<rect x="${x0}" y="${yRes}" width="${w}" height="${hRes}" rx="8" fill="${col}" fill-opacity=".10" stroke="${col}" stroke-width="1.8"${ok ? '' : ' stroke-dasharray="6 4"'}/>`,
    `<text x="${cx}" y="${yRes + 28}" text-anchor="middle" font-size="14.5" font-weight="700" fill="${col}">${resTitle}</text>`,
    `<text x="${cx}" y="${yRes + 50}" text-anchor="middle" font-size="12.5" fill="${col}">${resSub}</text>`,
  ].join('');
}

function landVsOwnNarrow(): Narrow {
  const a: LandOpts = { yCap: 12, yBld: 24, hBld: 60, yGnd: 92, hGnd: 40,
                        yA1: 140, yA2: 176, yRes: 184, hRes: 66, inset: 24 };
  const d = 282;
  const b: LandOpts = { ...a, yCap: a.yCap! + d, yBld: a.yBld! + d, yGnd: a.yGnd! + d,
                        yA1: a.yA1! + d, yA2: a.yA2! + d, yRes: a.yRes! + d };
  const s =
    landPanel(0, NW, 'いま ── 借りた土地に建てる', '制作会社の名義のことがあります',
              '残るもの ── なし', 'URLも中身も写真も使えません', false, a) +
    landPanel(0, NW, '紬 ── 自分の土地に建てる', '初日からお客様の名義で取得',
              '残るもの ── 全部', 'ドメイン・ソース・写真。他社にも渡せます', true, b);
  return [s, `0 0 ${NW} 542`];
}

export function landVsOwn() {
  const w = 340;
  const s =
    landPanel(0, w, 'いま ── 借りた土地に建てる', '制作会社の名義になっていることがあります',
              '手元に残るもの ── なし', 'URLも中身も写真も、使えなくなります', false) +
    landPanel(382, w, '紬 ── 自分の土地に建てる', '初日からお客様の名義で取得します',
              '手元に残るもの ── 全部', 'ドメイン・ソースコード・写真。他社にも渡せます', true);
  return fig(
    s,
    '建てるものは同じです。違うのは土地の名義と、やめたあとに何が手元に残るかだけです。',
    '左右2つの比較図。左は借りた土地に建てる場合で、ページ・写真・原稿の下にある土地' +
      '（ドメインとサーバー）が制作会社の名義になっており、解約した日に手元に残るものはない。' +
      '右は紬の場合で、同じものを建てるが土地は初日からお客様の名義なので、' +
      '解約してもドメイン・ソースコード・写真のすべてが手元に残り、他社にも渡せる。',
    '0 0 722 276',
    landVsOwnNarrow(),
  );
}

// ═══════════════ 7. 同じ36か月、意味が正反対
function ownershipClockNarrow(subMonthly: number, subTotal: number, ourPrice: number, ourRun: number, months: number): Narrow {
  const track = (y: number, atEnd: boolean) => {
    const col = 'var(--fig-ok)';
    const fx = atEnd ? NW - 6 : 6;
    const d = atEnd ? -20 : 20;
    return `<rect x="0" y="${y}" width="${NW}" height="10" rx="5" ${BOX_F} ${BOX_S}/>`
         + `<circle cx="${fx}" cy="${y + 5}" r="5.5" fill="${col}"/>`
         + `<line x1="${fx}" y1="${y + 5}" x2="${fx}" y2="${y - 22}" stroke="${col}" stroke-width="2.2"/>`
         + `<path d="M${fx} ${y - 22} L${fx + d} ${y - 17} L${fx} ${y - 12} z" fill="${col}"/>`;
  };
  const s = [
    cap(0, 14, '月額制'),
    `<rect x="0" y="24" width="${NW}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="16" y="45" font-size="13.5" font-weight="700" fill="currentColor">月${c(subMonthly)}円 × ${months}か月</text>`,
    `<text x="16" y="63" font-size="12.5" ${DIM}>＝ ${c(subTotal)}円</text>`,
    `<text x="${NW}" y="84" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">ここで、やっと譲渡</text>`,
    track(112, true),
    '<text x="0" y="148" font-size="12.5" font-weight="700" fill="var(--fig-bad)">途中で降りると、サイトは非公開</text>',
    cap(0, 196, '紬'),
    `<rect x="0" y="206" width="${NW}" height="48" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="16" y="227" font-size="13.5" font-weight="700" fill="currentColor">買い切り ${c(ourPrice)}円</text>`,
    `<text x="16" y="245" font-size="12.5" ${DIM}>＋ 運用 月${c(ourRun)}円（任意）</text>`,
    '<text x="0" y="266" font-size="12.5" font-weight="700" fill="var(--fig-ok)">ここで、もうお客様のもの</text>',
    track(294, false),
    '<text x="0" y="330" font-size="12.5" font-weight="700" fill="var(--fig-ok)">途中で降りても、サイトは残る</text>',
  ];
  return [s.join(''), `0 0 ${NW} 342`];
}

const flag = (x: number, y: number, ok = true) => {
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 26}" stroke="${col}" stroke-width="2.4"/>`
       + `<path d="M${x} ${y - 26} L${x + 22} ${y - 20} L${x} ${y - 14} z" fill="${col}"/>`
       + `<circle cx="${x}" cy="${y}" r="4.5" fill="${col}"/>`;
};

export function ownershipClock(subMonthly: number, subTotal: number, ourPrice: number, ourRun: number, months = 36) {
  const x0 = 116, x1 = 646;
  const mx = (m: number) => x0 + ((x1 - x0) * m) / months;
  const s: string[] = [];
  for (const [m, lab] of [[0, 'ご契約'], [12, '1年'], [months, `${months}か月`]] as [number, string][]) {
    s.push(`<line x1="${mx(m)}" y1="30" x2="${mx(m)}" y2="252" stroke="currentColor" stroke-width="1" stroke-dasharray="3 5" opacity=".28"/>`);
    s.push(`<text x="${mx(m)}" y="272" text-anchor="middle" font-size="12.5" ${DIM}>${lab}</text>`);
  }
  s.push(
    '<text x="0" y="58" font-size="13.5" font-weight="700" fill="currentColor">月額制</text>',
    `<text x="0" y="77" font-size="12" ${DIM}>払い終えるまで</text>`,
    `<rect x="${x0}" y="42" width="${x1 - x0}" height="44" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${(x0 + x1) / 2}" y="70" text-anchor="middle" font-size="13.5" fill="currentColor">月${c(subMonthly)}円 × ${months}か月 ＝ ${c(subTotal)}円</text>`,
    flag(x1, 42, true),
    `<text x="${x1 - 6}" y="24" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">ここで、やっと譲渡</text>`,
    `<path d="M${mx(12) - 8} 98 L${mx(12) + 8} 114 M${mx(12) + 8} 98 L${mx(12) - 8} 114" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>`,
    `<text x="${mx(12) + 18}" y="112" font-size="12.5" font-weight="700" fill="var(--fig-bad)">ここで降りると、サイトは非公開</text>`,
    '<text x="0" y="176" font-size="13.5" font-weight="700" fill="currentColor">紬</text>',
    `<text x="0" y="195" font-size="12" ${DIM}>初日から</text>`,
    flag(x0, 160, true),
    `<text x="${x0 + 28}" y="142" font-size="12.5" font-weight="700" fill="var(--fig-ok)">ここで、もうお客様のもの</text>`,
    `<rect x="${x0}" y="160" width="${x1 - x0}" height="44" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="${(x0 + x1) / 2}" y="188" text-anchor="middle" font-size="13.5" fill="currentColor">買い切り${c(ourPrice)}円 ＋ 運用 月${c(ourRun)}円（いつでもやめられます）</text>`,
    `<path d="M${mx(12) - 7} 222 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${mx(12) + 18}" y="230" font-size="12.5" font-weight="700" fill="var(--fig-ok)">ここで降りても、サイトは残る</text>`,
  );
  return fig(
    s.join(''),
    `同じ${months}か月でも、所有が移る時点が正反対です。月額制は払い終えたときに渡り、こちらは最初に渡します。だから途中でやめたときの結果が変わります。`,
    `2段の時間軸。上段は月額制で、月${c(subMonthly)}円を${months}か月払い終えた時点でようやく譲渡され、途中で解約するとサイトは非公開になる。下段は紬で、契約初日にサイトがお客様のものになり、運用費は途中でやめてもサイトは残る。`,
    '0 0 722 288',
    ownershipClockNarrow(subMonthly, subTotal, ourPrice, ourRun, months),
  );
}
