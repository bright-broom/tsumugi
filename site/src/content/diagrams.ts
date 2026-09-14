import { getMessages } from '@/i18n/catalog';
const copy = getMessages().diagrams;
import { format } from '@/i18n/format';
/**
 * 図。どれも本文で説明している「仕組み」を置き換えるためのもので、飾りは入れない。
 * 出力は SVG の文字列で、ビルド時にHTMLへ焼かれる（components/Figure.tsx が流し込む）。
 *
 * 配色の方針：
 * - 構造線・文字・囲みは currentColor（不透明度で濃淡をつける）。
 *   これで明るい節・墨紺の節のどこに置いても成立する。
 * - 意味を持つ色は3つだけ。--fig-accent＝勧める側、--fig-ok＝残るもの、--fig-bad＝失われるもの。
 * - viewBox でサイズを決め、表示幅は CSS に任せる。
 * - role="img" と aria-label は必須（verify が検査する）。
 */

import { rnd } from '@/lib/round';

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
 * marker の id はページ内で衝突させない。接尾辞は図の aria-label から決める。
 * 通し番号にすると、ページを並列に書き出す Next.js ではビルドのたびに番号が変わり、
 * 同じ入力から同じ HTML が出なくなる。同じ図を1ページに2回置くと衝突するので置かないこと。
 */
function uniq(markup: string, key: string): string {
  let h = 0x811c9dc5; // FNV-1a 32bit
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  const t = (h >>> 0).toString(36);
  return markup.replaceAll('dg-a', `dg-a${t}`).replaceAll('dg-p', `dg-p${t}`);
}

type Narrow = [svg: string, viewBox: string];

function fig(svg: string, caption: string, label: string, vb: string, narrow?: Narrow): string {
  let out = `<svg class="fw" role="img" aria-label="${label}" viewBox="${vb}">${uniq(DEFS + svg, label)}</svg>`;
  if (narrow) {
    out +=
      `<svg class="fn" role="img" aria-label="${label}" viewBox="${narrow[1]}">` +
      `${uniq(DEFS + narrow[0], `${label}#narrow`)}</svg>`;
  }
  const cls = narrow ? 'fig has-narrow' : 'fig';
  const hint = narrow ? '' : `<p class="fig-hint" aria-hidden="true">${copy.hint}</p>`;
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
    t +=
      `<text x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>` +
      `<text x="${cx}" y="${y + h / 2 + 18}" text-anchor="middle" font-size="12" ${DIM}>${sub}</text>`;
  } else {
    t += `<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`;
  }
  return t;
}

function arrow(x1: number, y: number, x2: number, label: string, accent = false, dy = 11) {
  const col = accent ? 'var(--fig-accent)' : 'currentColor';
  const mk = accent ? 'dg-p' : 'dg-a';
  return (
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="1.6" marker-end="url(#${mk})"/>` +
    `<text x="${(x1 + x2) / 2}" y="${y - dy}" text-anchor="middle" font-size="12" ${DIM}>${label}</text>`
  );
}

// ── スマホ用の組み直し ───────────────────────────
const NW = 340;

function vbox(y: number, h: number, title: string, sub = '', accent = false) {
  let t = accent
    ? `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
    : `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" ${BOX_F} ${BOX_S}/>`;
  const cx = NW / 2;
  if (sub) {
    t +=
      `<text x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>` +
      `<text x="${cx}" y="${y + h / 2 + 17}" text-anchor="middle" font-size="12" ${DIM}>${sub}</text>`;
  } else {
    t += `<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${title}</text>`;
  }
  return t;
}

function vdown(y1: number, y2: number, label: string, accent = false, x = 44, ly?: number) {
  const col = accent ? 'var(--fig-accent)' : 'currentColor';
  const mk = accent ? 'dg-p' : 'dg-a';
  return (
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="1.6" marker-end="url(#${mk})"/>` +
    `<text x="${x + 14}" y="${ly ?? (y1 + y2) / 2 + 4}" font-size="12" ${DIM}>${label}</text>`
  );
}

// ═══════════════ 1. 借りている場所 / 自分の場所
function rentVsOwnNarrow(portal: number, fee: number, run: number): Narrow {
  const s = [
    cap(0, 12, copy.rentVsOwnNarrowLabel1),
    vbox(24, 54, copy.rentVsOwnNarrowLabel2, ''),
    vdown(86, 122, format(copy.rentVsOwnNarrowLabel3, { portal: c(portal) })),
    vbox(130, 58, copy.rentVsOwnNarrowLabel4, copy.rentVsOwnNarrowLabel5),
    vdown(196, 244, format(copy.rentVsOwnNarrowLabel6, { fee: fee }), false, 44, 208),
    `<line x1="14" y1="228" x2="${NW - 14}" y2="228" stroke="var(--fig-bad)" stroke-width="1.5" stroke-dasharray="5 5"/>`,
    '<path d="M36 220 L52 236 M52 220 L36 236" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>',
    `<text x="${NW}" y="264" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.rentVsOwnNarrowLabel7}</text>`,
    vbox(276, 50, copy.rentVsOwnNarrowLabel8),
    cap(0, 368, copy.rentVsOwnNarrowLabel9),
    vbox(380, 54, copy.rentVsOwnNarrowLabel2, ''),
    vdown(442, 478, format(copy.rentVsOwnNarrowLabel10, { run: c(run) }), true),
    vbox(486, 58, copy.rentVsOwnNarrowLabel11, copy.rentVsOwnNarrowLabel12, true),
    vdown(552, 588, copy.rentVsOwnNarrowLabel13, true),
    vbox(600, 50, copy.rentVsOwnNarrowLabel8),
    `<text x="${NW / 2}" y="674" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.rentVsOwnNarrowLabel14}</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 684`];
}

export function rentVsOwn(portal = 27_500, fee = 220, run = 16_000) {
  const s = [
    cap(0, 16, copy.rentVsOwnNarrowLabel1),
    box(0, 32, 124, 66, copy.rentVsOwnNarrowLabel2, copy.rentVsOwnLabel1),
    arrow(130, 65, 248, format(copy.rentVsOwnNarrowLabel3, { portal: c(portal) })),
    box(254, 28, 212, 74, copy.rentVsOwnNarrowLabel4, copy.rentVsOwnNarrowLabel5),
    arrow(472, 65, 590, format(copy.rentVsOwnNarrowLabel6, { fee: fee }), false, 25),
    box(596, 32, 124, 66, copy.rentVsOwnNarrowLabel8),
    '<line x1="530" y1="48" x2="530" y2="118" stroke="var(--fig-bad)" stroke-width="1.5" stroke-dasharray="5 5"/>',
    '<path d="M522 56 L538 72 M538 56 L522 72" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>',
    `<text x="530" y="134" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-bad)">${copy.rentVsOwnNarrowLabel7}</text>`,
    cap(0, 188, copy.rentVsOwnNarrowLabel9),
    box(0, 204, 124, 66, copy.rentVsOwnNarrowLabel2, copy.rentVsOwnLabel1),
    arrow(130, 237, 248, format(copy.rentVsOwnNarrowLabel10, { run: c(run) }), true),
    box(254, 200, 212, 74, copy.rentVsOwnNarrowLabel11, copy.rentVsOwnNarrowLabel12, true),
    arrow(472, 237, 590, copy.rentVsOwnNarrowLabel13, true),
    box(596, 204, 124, 66, copy.rentVsOwnNarrowLabel8),
    `<text x="361" y="302" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-ok)">${copy.rentVsOwnLabel2}</text>`,
  ];
  return fig(
    s.join(''),
    copy.rentVsOwn + copy.rentVsOwn2,
    format(copy.rentVsOwn3, { portal: c(portal) }) +
      format(copy.rentVsOwn4, { fee: fee }) +
      format(copy.rentVsOwn5, { run: c(run) }) +
      copy.rentVsOwn6,
    '0 0 722 312',
    rentVsOwnNarrow(portal, fee, run),
  );
}

// ═══════════════ 2. 掲載費の振替
function moneyFlowNarrow(portal: number, run: number): Narrow {
  const rest = portal - run;
  const w1 = rnd((NW * run) / portal);
  const s = [
    cap(0, 12, copy.moneyFlowNarrowLabel1),
    `<rect x="0" y="22" width="${NW}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${NW / 2}" y="52" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${format(copy.moneyFlowNarrowLabel2, { portal: c(portal) })}</text>`,
    `<line x1="${NW / 2}" y1="78" x2="${NW / 2}" y2="108" stroke="var(--fig-accent)" stroke-width="1.6" marker-end="url(#dg-p)"/>`,
    `<text x="${NW / 2}" y="130" text-anchor="middle" font-size="12.5" ${DIM}>${copy.moneyFlowNarrowLabel3}</text>`,
    cap(0, 158, copy.moneyFlowNarrowLabel4),
    `<rect x="0" y="168" width="${w1 - 4}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${w1 / 2 - 2}" y="190" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${copy.moneyFlowNarrowLabel5}</text>`,
    `<text x="${w1 / 2 - 2}" y="206" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${format(copy.moneyFlowNarrowLabel6, { run: c(run) })}</text>`,
    `<rect x="${w1}" y="168" width="${NW - w1}" height="48" rx="8" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${w1 + (NW - w1) / 2}" y="190" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.moneyFlowNarrowLabel7}</text>`,
    `<text x="${w1 + (NW - w1) / 2}" y="206" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${format(copy.moneyFlowNarrowLabel8, { rest: c(rest) })}</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 226`];
}

export function moneyFlow(portal = 27_500, run = 16_000) {
  const rest = portal - run;
  const x = 78,
    w = 602;
  const w1 = rnd((w * run) / portal);
  const s = [
    cap(0, 58, copy.moneyFlowNarrowLabel1),
    `<rect x="${x}" y="26" width="${w}" height="50" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${x + w / 2}" y="57" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${format(copy.moneyFlowLabel1, { portal: c(portal) })}</text>`,
    `<line x1="${x + w / 2}" y1="84" x2="${x + w / 2}" y2="112" stroke="var(--fig-accent)" stroke-width="1.6" marker-end="url(#dg-p)"/>`,
    `<text x="${x + w / 2 + 12}" y="106" font-size="12" ${DIM}>${copy.moneyFlowLabel2}</text>`,
    cap(0, 156, copy.moneyFlowNarrowLabel4),
    `<rect x="${x}" y="124" width="${w1 - 5}" height="50" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${x + w1 / 2 - 2}" y="155" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${format(copy.moneyFlowLabel3, { run: c(run) })}</text>`,
    `<rect x="${x + w1}" y="124" width="${w - w1}" height="50" rx="8" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${x + w1 + (w - w1) / 2}" y="155" text-anchor="middle" font-size="15" font-weight="700" fill="var(--fig-ok)">${format(copy.moneyFlowLabel4, { rest: c(rest) })}</text>`,
  ];
  return fig(
    s.join(''),
    format(copy.moneyFlow, { run: c(run), rest: c(rest) }),
    format(copy.moneyFlow2, { portal: c(portal), run: c(run), rest: c(rest) }),
    '0 0 700 192',
    moneyFlowNarrow(portal, run),
  );
}

// ═══════════════ 3. 24か月払ったあとに何が残るか
function afterTwoYearsNarrow(
  rivalM: number,
  oursInit: number,
  oursM: number,
  months: number,
): Narrow {
  const rivalTotal = rivalM * months;
  const oursTotal = oursInit + oursM * months;
  const s = [
    cap(0, 14, format(copy.afterTwoYearsNarrowLabel1, { months: months })),
    `<rect x="0" y="26" width="${NW}" height="96" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="16" y="50" font-size="14" font-weight="700" fill="currentColor">${copy.afterTwoYearsNarrowLabel2}</text>`,
    `<text x="16" y="74" font-size="13.5" fill="currentColor">${format(copy.afterTwoYearsNarrowLabel3, { rivalM: c(rivalM), months: months, rivalTotal: c(rivalTotal) })}</text>`,
    '<path d="M18 94 L32 108 M32 94 L18 108" stroke="var(--fig-bad)" stroke-width="2.6" stroke-linecap="round"/>',
    `<text x="42" y="106" font-size="13" font-weight="700" fill="var(--fig-bad)">${copy.afterTwoYearsNarrowLabel4}</text>`,
    `<rect x="0" y="140" width="${NW}" height="118" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="16" y="164" font-size="14" font-weight="700" fill="currentColor">${copy.afterTwoYearsNarrowLabel5}</text>`,
    `<text x="16" y="188" font-size="13.5" fill="currentColor">${format(copy.afterTwoYearsNarrowLabel6, { oursInit: c(oursInit), oursM: c(oursM), months: months })}</text>`,
    `<text x="16" y="208" font-size="13.5" fill="currentColor">${format(copy.afterTwoYearsNarrowLabel7, { oursTotal: c(oursTotal) })}</text>`,
    '<path d="M18 224 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    `<text x="42" y="232" font-size="13" font-weight="700" fill="var(--fig-ok)">${copy.afterTwoYearsNarrowLabel8}</text>`,
    `<text x="42" y="250" font-size="13" font-weight="700" fill="var(--fig-ok)">${copy.afterTwoYearsNarrowLabel9}</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 268`];
}

export function afterTwoYears(rivalM: number, oursInit: number, oursM: number, months = 24) {
  const rivalTotal = rivalM * months;
  const oursTotal = oursInit + oursM * months;
  const x0 = 104,
    x1 = 516;
  const s: string[] = [];
  for (const [i, lab] of [
    [0, copy.afterTwoYears],
    [12, copy.afterTwoYears2],
    [months, format(copy.afterTwoYears3, { mathFloorMonths12: Math.floor(months / 12) })],
  ] as [number, string][]) {
    const px = x0 + ((x1 - x0) * i) / months;
    s.push(
      `<line x1="${px}" y1="24" x2="${px}" y2="246" stroke="currentColor" stroke-width="1" stroke-dasharray="3 5" opacity=".3"/>`,
    );
    s.push(`<text x="${px}" y="266" text-anchor="middle" font-size="12" ${DIM}>${lab}</text>`);
  }
  s.push(
    `<text x="0" y="58" font-size="13" font-weight="700" fill="currentColor">${copy.afterTwoYears4}</text>`,
    `<text x="0" y="76" font-size="11.5" ${DIM}>${copy.afterTwoYears5}</text>`,
    `<rect x="${x0}" y="40" width="${x1 - x0}" height="46" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${(x0 + x1) / 2}" y="69" text-anchor="middle" font-size="13.5" fill="currentColor">${format(copy.afterTwoYears6, { rivalM: c(rivalM), months: months, rivalTotal: c(rivalTotal) })}</text>`,
    `<path d="M${x1 + 14} 54 L${x1 + 31} 71 M${x1 + 31} 54 L${x1 + 14} 71" stroke="var(--fig-bad)" stroke-width="2.6" stroke-linecap="round"/>`,
    `<text x="${x1 + 42}" y="59" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.afterTwoYears7}</text>`,
    `<text x="${x1 + 42}" y="77" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.afterTwoYears8}</text>`,
    `<text x="0" y="170" font-size="13" font-weight="700" fill="currentColor">${copy.afterTwoYears9}</text>`,
    `<text x="0" y="188" font-size="11.5" ${DIM}>${copy.afterTwoYears10}</text>`,
    `<rect x="${x0}" y="152" width="${x1 - x0}" height="46" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="${(x0 + x1) / 2}" y="181" text-anchor="middle" font-size="13.5" fill="currentColor">${format(copy.afterTwoYears11, { oursInit: c(oursInit), oursM: c(oursM), months: months, oursTotal: c(oursTotal) })}</text>`,
    `<path d="M${x1 + 15} 172 l7 8 l13 -15" fill="none" stroke="var(--fig-ok)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${x1 + 42}" y="171" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.afterTwoYearsNarrowLabel8}</text>`,
    `<text x="${x1 + 42}" y="189" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.afterTwoYearsNarrowLabel9}</text>`,
    `<line x1="${x1}" y1="198" x2="${x1}" y2="226" stroke="var(--fig-ok)" stroke-width="1.4"/>`,
    `<text x="${x1 - 8}" y="222" text-anchor="end" font-size="12" ${DIM}>${copy.afterTwoYears12}</text>`,
  );
  return fig(
    s.join(''),
    format(copy.afterTwoYears13, { months: months }),
    format(copy.afterTwoYears14, {
      months: months,
      rivalM: c(rivalM),
      months2: months,
      rivalTotal: c(rivalTotal),
      oursInit: c(oursInit),
      oursM: c(oursM),
      months3: months,
      oursTotal: c(oursTotal),
      months4: months,
    }),
    '0 0 722 282',
    afterTwoYearsNarrow(rivalM, oursInit, oursM, months),
  );
}

// ═══════════════ 4. 補助金の内訳
function subsidyBarNarrow(
  total: number,
  web: number,
  pr: number,
  grant: number,
  net: number,
): Narrow {
  const ww = rnd((NW * web) / total);
  const gw = rnd((NW * grant) / total);
  const s = [
    cap(0, 12, format(copy.subsidyBarNarrowLabel1, { total: c(total) })),
    `<rect x="0" y="22" width="${ww - 4}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww / 2 - 2}" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${copy.subsidyBarNarrowLabel2}</text>`,
    `<text x="${ww / 2 - 2}" y="62" text-anchor="middle" font-size="12.5" ${DIM}>${format(copy.subsidyBarNarrowLabel3, { web: c(web) })}</text>`,
    `<rect x="${ww}" y="22" width="${NW - ww}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww + (NW - ww) / 2}" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${copy.subsidyBarNarrowLabel4}</text>`,
    `<text x="${ww + (NW - ww) / 2}" y="62" text-anchor="middle" font-size="12.5" ${DIM}>${format(copy.subsidyBarNarrowLabel5, { pr: c(pr) })}</text>`,
    `<line x1="${NW / 2}" y1="82" x2="${NW / 2}" y2="106" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    cap(0, 132, copy.subsidyBarNarrowLabel6),
    `<rect x="0" y="142" width="${gw - 4}" height="52" rx="7" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${gw / 2 - 2}" y="164" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fig-ok)">${copy.subsidyBarNarrowLabel7}</text>`,
    `<text x="${gw / 2 - 2}" y="182" text-anchor="middle" font-size="12.5" fill="var(--fig-ok)">${format(copy.subsidyBarNarrowLabel8, { grant: c(grant) })}</text>`,
    `<rect x="${gw}" y="142" width="${NW - gw}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${gw + (NW - gw) / 2}" y="164" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${copy.subsidyBarNarrowLabel9}</text>`,
    `<text x="${gw + (NW - gw) / 2}" y="182" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${format(copy.subsidyBarNarrowLabel10, { net: c(net) })}</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 204`];
}

export function subsidyBar(total: number, web: number, pr: number, grant: number, net: number) {
  const w = 700;
  const ww = rnd((w * web) / total);
  const gw = rnd((w * grant) / total);
  const s = [
    cap(0, 14, format(copy.subsidyBarNarrowLabel1, { total: c(total) })),
    `<rect x="0" y="26" width="${ww - 5}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww / 2 - 2}" y="50" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${copy.subsidyBarNarrowLabel2}</text>`,
    `<text x="${ww / 2 - 2}" y="68" text-anchor="middle" font-size="12" ${DIM}>${format(copy.subsidyBarLabel1, { web: c(web) })}</text>`,
    `<rect x="${ww}" y="26" width="${w - ww}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${ww + (w - ww) / 2}" y="50" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${copy.subsidyBarLabel2}</text>`,
    `<text x="${ww + (w - ww) / 2}" y="68" text-anchor="middle" font-size="12" ${DIM}>${format(copy.subsidyBarLabel3, { pr: c(pr) })}</text>`,
    `<line x1="${w / 2}" y1="86" x2="${w / 2}" y2="110" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    cap(0, 136, copy.subsidyBarNarrowLabel6),
    `<rect x="0" y="148" width="${gw - 5}" height="52" rx="7" fill="var(--fig-ok)" fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>`,
    `<text x="${gw / 2 - 2}" y="172" text-anchor="middle" font-size="13" font-weight="700" fill="var(--fig-ok)">${copy.subsidyBarNarrowLabel7}</text>`,
    `<text x="${gw / 2 - 2}" y="190" text-anchor="middle" font-size="12" fill="var(--fig-ok)">${format(copy.subsidyBarLabel4, { grant: c(grant) })}</text>`,
    `<rect x="${gw}" y="148" width="${w - gw}" height="52" rx="7" ${BOX_F} ${BOX_S}/>`,
    `<text x="${gw + (w - gw) / 2}" y="172" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${copy.subsidyBarNarrowLabel9}</text>`,
    `<text x="${gw + (w - gw) / 2}" y="190" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${format(copy.subsidyBarLabel5, { net: c(net) })}</text>`,
  ];
  return fig(
    s.join(''),
    format(copy.subsidyBar, { total: c(total), net: c(net) }),
    format(copy.subsidyBar2, {
      total: c(total),
      web: c(web),
      pr: c(pr),
      grant: c(grant),
      net: c(net),
    }),
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
    [copy.steps, format(copy.steps2, { shortForm4: short(form4) }), false],
    [copy.steps3, format(copy.steps4, { shortDeadline: short(deadline) }), false],
    [copy.steps5, copy.steps6, false],
    [copy.steps7, copy.steps8, true],
    [copy.steps9, copy.steps10, true],
  ];
  const h = 52,
    gap = 22;
  const s = [cap(0, 14, copy.subsidyTimelineNarrowLabel1)];
  let y = 26;
  const ys: number[] = [];
  for (const [t, sub, acc] of steps) {
    ys.push(y);
    s.push(
      acc
        ? `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
        : `<rect x="0" y="${y}" width="${NW}" height="${h}" rx="8" ${BOX_F} ${BOX_S}/>`,
    );
    s.push(
      `<text x="16" y="${y + 22}" font-size="14" font-weight="700" fill="currentColor">${t}</text>`,
    );
    s.push(`<text x="16" y="${y + 40}" font-size="12.5" ${DIM}>${sub}</text>`);
    y += h + gap;
  }
  const gy = ys[3]! - gap / 2;
  s.push(
    `<line x1="0" y1="${gy}" x2="${NW}" y2="${gy}" stroke="var(--fig-bad)" stroke-width="2" stroke-dasharray="6 5"/>`,
  );
  s.push(
    `<text x="0" y="${gy - 6}" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.subsidyTimelineNarrow}</text>`,
  );
  for (let i = 0; i < steps.length - 1; i++) {
    if (i === 2) continue;
    s.push(
      `<line x1="20" y1="${ys[i]! + h + 3}" x2="20" y2="${ys[i + 1]! - 4}" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    );
  }
  s.push(
    `<text x="${NW}" y="${y + 6}" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.subsidyTimelineNarrow2}</text>`,
  );
  return [s.join(''), `0 0 ${NW} ${y + 16}`];
}

export function subsidyTimeline(form4: string, deadline: string) {
  const y = 96,
    bh = 44;
  const steps: [number, number, string, string][] = [
    [0, 150, copy.steps, format(copy.steps2, { shortForm4: short(form4) })],
    [164, 140, copy.steps3, format(copy.steps4, { shortDeadline: short(deadline) })],
    [318, 134, copy.steps5, copy.steps6],
    [482, 140, copy.steps7, copy.steps8],
    [638, 132, copy.steps9, copy.steps10],
  ];
  const s: string[] = [];
  steps.forEach(([x, w, t, sub], i) => {
    s.push(
      i >= 3
        ? `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="8" ${BOX_F} ${BOX_S}/>`,
    );
    s.push(
      `<text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${t}</text>`,
    );
    s.push(
      `<text x="${x + w / 2}" y="${y + 36}" text-anchor="middle" font-size="11.5" ${DIM}>${sub}</text>`,
    );
    if (i < steps.length - 1) {
      s.push(
        `<line x1="${x + w + 3}" y1="${y + bh / 2}" x2="${steps[i + 1]![0] - 4}" y2="${y + bh / 2}" stroke="currentColor" stroke-width="1.4" marker-end="url(#dg-a)"/>`,
      );
    }
  });
  const gx = 474;
  s.push(
    `<line x1="${gx}" y1="46" x2="${gx}" y2="196" stroke="var(--fig-bad)" stroke-width="2" stroke-dasharray="6 5"/>`,
  );
  s.push(
    `<text x="${gx - 10}" y="40" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.subsidyTimeline}</text>`,
  );
  s.push(
    `<text x="${gx - 10}" y="58" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.subsidyTimeline2}</text>`,
  );
  s.push(
    `<text x="${gx + 10}" y="186" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.subsidyTimeline3}</text>`,
  );
  return fig(
    s.join(''),
    format(copy.subsidyTimeline4, { form4: form4, deadline: deadline }),
    format(copy.subsidyTimeline5, { form4: form4, deadline: deadline }),
    '0 0 776 206',
    subsidyTimelineNarrow(form4, deadline),
  );
}

// ═══════════════ 6. 借地と所有（主張の中心）
interface LandOpts {
  yCap?: number;
  yBld?: number;
  hBld?: number;
  yGnd?: number;
  hGnd?: number;
  yA1?: number;
  yA2?: number;
  yRes?: number;
  hRes?: number;
  inset?: number;
}
function landPanel(
  x0: number,
  w: number,
  capText: string,
  groundSub: string,
  resTitle: string,
  resSub: string,
  ok: boolean,
  o: LandOpts = {},
) {
  const {
    yCap = 14,
    yBld = 28,
    hBld = 64,
    yGnd = 100,
    hGnd = 42,
    yA1 = 150,
    yA2 = 186,
    yRes = 196,
    hRes = 68,
    inset = 30,
  } = o;
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  const cx = x0 + w / 2;
  const bx = x0 + inset,
    bw = w - inset * 2;
  return [
    cap(x0, yCap, capText),
    `<rect x="${bx}" y="${yBld}" width="${bw}" height="${hBld}" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${cx}" y="${yBld + 26}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${copy.landPanel}</text>`,
    `<text x="${cx}" y="${yBld + 46}" text-anchor="middle" font-size="12.5" ${DIM}>${copy.landPanel2}</text>`,
    `<rect x="${x0}" y="${yGnd}" width="${w}" height="${hGnd}" rx="6" ${BOX_F} ${BOX_S}/>`,
    `<text x="${cx}" y="${yGnd + 20}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${copy.landPanel3}</text>`,
    `<text x="${cx}" y="${yGnd + 36}" text-anchor="middle" font-size="12.5" ${DIM}>${groundSub}</text>`,
    `<line x1="${cx}" y1="${yA1}" x2="${cx}" y2="${yA2}" stroke="currentColor" stroke-width="1.6" marker-end="url(#dg-a)"/>`,
    `<text x="${cx + 13}" y="${(yA1 + yA2) / 2 + 4}" font-size="12" ${DIM}>${copy.landPanel4}</text>`,
    `<rect x="${x0}" y="${yRes}" width="${w}" height="${hRes}" rx="8" fill="${col}" fill-opacity=".10" stroke="${col}" stroke-width="1.8"${ok ? '' : ' stroke-dasharray="6 4"'}/>`,
    `<text x="${cx}" y="${yRes + 28}" text-anchor="middle" font-size="14.5" font-weight="700" fill="${col}">${resTitle}</text>`,
    `<text x="${cx}" y="${yRes + 50}" text-anchor="middle" font-size="12.5" fill="${col}">${resSub}</text>`,
  ].join('');
}

function landVsOwnNarrow(): Narrow {
  const a: LandOpts = {
    yCap: 12,
    yBld: 24,
    hBld: 60,
    yGnd: 92,
    hGnd: 40,
    yA1: 140,
    yA2: 176,
    yRes: 184,
    hRes: 66,
    inset: 24,
  };
  const d = 282;
  const b: LandOpts = {
    ...a,
    yCap: a.yCap! + d,
    yBld: a.yBld! + d,
    yGnd: a.yGnd! + d,
    yA1: a.yA1! + d,
    yA2: a.yA2! + d,
    yRes: a.yRes! + d,
  };
  const s =
    landPanel(
      0,
      NW,
      copy.landVsOwnNarrowLabel1,
      copy.landVsOwnNarrowLabel2,
      copy.landVsOwnNarrowLabel3,
      copy.landVsOwnNarrowLabel4,
      false,
      a,
    ) +
    landPanel(
      0,
      NW,
      copy.landVsOwnNarrowLabel5,
      copy.landVsOwnNarrowLabel6,
      copy.landVsOwnNarrowLabel7,
      copy.landVsOwnNarrowLabel8,
      true,
      b,
    );
  return [s, `0 0 ${NW} 542`];
}

export function landVsOwn() {
  const w = 340;
  const s =
    landPanel(
      0,
      w,
      copy.landVsOwnNarrowLabel1,
      copy.landVsOwnLabel1,
      copy.landVsOwnLabel2,
      copy.landVsOwnLabel3,
      false,
    ) +
    landPanel(
      382,
      w,
      copy.landVsOwnNarrowLabel5,
      copy.landVsOwnLabel4,
      copy.landVsOwnLabel5,
      copy.landVsOwnLabel6,
      true,
    );
  return fig(
    s,
    copy.landVsOwn,
    copy.landVsOwn2 + copy.landVsOwn3 + copy.landVsOwn4 + copy.landVsOwn5,
    '0 0 722 276',
    landVsOwnNarrow(),
  );
}

// ═══════════════ 7. 同じ36か月、意味が正反対
function ownershipClockNarrow(
  subMonthly: number,
  subTotal: number,
  ourPrice: number,
  ourRun: number,
  months: number,
): Narrow {
  const track = (y: number, atEnd: boolean) => {
    const col = 'var(--fig-ok)';
    const fx = atEnd ? NW - 6 : 6;
    const d = atEnd ? -20 : 20;
    return (
      `<rect x="0" y="${y}" width="${NW}" height="10" rx="5" ${BOX_F} ${BOX_S}/>` +
      `<circle cx="${fx}" cy="${y + 5}" r="5.5" fill="${col}"/>` +
      `<line x1="${fx}" y1="${y + 5}" x2="${fx}" y2="${y - 22}" stroke="${col}" stroke-width="2.2"/>` +
      `<path d="M${fx} ${y - 22} L${fx + d} ${y - 17} L${fx} ${y - 12} z" fill="${col}"/>`
    );
  };
  const s = [
    cap(0, 14, copy.ownershipClockNarrowLabel1),
    `<rect x="0" y="24" width="${NW}" height="48" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="16" y="45" font-size="13.5" font-weight="700" fill="currentColor">${format(copy.ownershipClockNarrowLabel2, { subMonthly: c(subMonthly), months: months })}</text>`,
    `<text x="16" y="63" font-size="12.5" ${DIM}>${format(copy.ownershipClockNarrowLabel3, { subTotal: c(subTotal) })}</text>`,
    `<text x="${NW}" y="84" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClockNarrowLabel4}</text>`,
    track(112, true),
    `<text x="0" y="148" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.ownershipClockNarrowLabel5}</text>`,
    cap(0, 196, copy.ownershipClockNarrowLabel6),
    `<rect x="0" y="206" width="${NW}" height="48" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="16" y="227" font-size="13.5" font-weight="700" fill="currentColor">${format(copy.ownershipClockNarrowLabel7, { ourPrice: c(ourPrice) })}</text>`,
    `<text x="16" y="245" font-size="12.5" ${DIM}>${format(copy.ownershipClockNarrowLabel8, { ourRun: c(ourRun) })}</text>`,
    `<text x="0" y="266" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClockNarrowLabel9}</text>`,
    track(294, false),
    `<text x="0" y="330" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClockNarrowLabel10}</text>`,
  ];
  return [s.join(''), `0 0 ${NW} 342`];
}

const flag = (x: number, y: number, ok = true) => {
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  return (
    `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 26}" stroke="${col}" stroke-width="2.4"/>` +
    `<path d="M${x} ${y - 26} L${x + 22} ${y - 20} L${x} ${y - 14} z" fill="${col}"/>` +
    `<circle cx="${x}" cy="${y}" r="4.5" fill="${col}"/>`
  );
};

export function ownershipClock(
  subMonthly: number,
  subTotal: number,
  ourPrice: number,
  ourRun: number,
  months = 36,
) {
  const x0 = 116,
    x1 = 646;
  const mx = (m: number) => x0 + ((x1 - x0) * m) / months;
  const s: string[] = [];
  for (const [m, lab] of [
    [0, copy.afterTwoYears],
    [12, copy.afterTwoYears2],
    [months, format(copy.ownershipClock, { months: months })],
  ] as [number, string][]) {
    s.push(
      `<line x1="${mx(m)}" y1="30" x2="${mx(m)}" y2="252" stroke="currentColor" stroke-width="1" stroke-dasharray="3 5" opacity=".28"/>`,
    );
    s.push(`<text x="${mx(m)}" y="272" text-anchor="middle" font-size="12.5" ${DIM}>${lab}</text>`);
  }
  s.push(
    `<text x="0" y="58" font-size="13.5" font-weight="700" fill="currentColor">${copy.ownershipClockNarrowLabel1}</text>`,
    `<text x="0" y="77" font-size="12" ${DIM}>${copy.ownershipClock2}</text>`,
    `<rect x="${x0}" y="42" width="${x1 - x0}" height="44" rx="8" ${BOX_F} ${BOX_S}/>`,
    `<text x="${(x0 + x1) / 2}" y="70" text-anchor="middle" font-size="13.5" fill="currentColor">${format(copy.ownershipClock3, { subMonthly: c(subMonthly), months: months, subTotal: c(subTotal) })}</text>`,
    flag(x1, 42, true),
    `<text x="${x1 - 6}" y="24" text-anchor="end" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClockNarrowLabel4}</text>`,
    `<path d="M${mx(12) - 8} 98 L${mx(12) + 8} 114 M${mx(12) + 8} 98 L${mx(12) - 8} 114" stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>`,
    `<text x="${mx(12) + 18}" y="112" font-size="12.5" font-weight="700" fill="var(--fig-bad)">${copy.ownershipClock4}</text>`,
    `<text x="0" y="176" font-size="13.5" font-weight="700" fill="currentColor">${copy.ownershipClockNarrowLabel6}</text>`,
    `<text x="0" y="195" font-size="12" ${DIM}>${copy.ownershipClock5}</text>`,
    flag(x0, 160, true),
    `<text x="${x0 + 28}" y="142" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClockNarrowLabel9}</text>`,
    `<rect x="${x0}" y="160" width="${x1 - x0}" height="44" rx="8" fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>`,
    `<text x="${(x0 + x1) / 2}" y="188" text-anchor="middle" font-size="13.5" fill="currentColor">${format(copy.ownershipClock6, { ourPrice: c(ourPrice), ourRun: c(ourRun) })}</text>`,
    `<path d="M${mx(12) - 7} 222 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${mx(12) + 18}" y="230" font-size="12.5" font-weight="700" fill="var(--fig-ok)">${copy.ownershipClock7}</text>`,
  );
  return fig(
    s.join(''),
    format(copy.ownershipClock8, { months: months }),
    format(copy.ownershipClock9, { subMonthly: c(subMonthly), months: months }),
    '0 0 722 288',
    ownershipClockNarrow(subMonthly, subTotal, ourPrice, ourRun, months),
  );
}
