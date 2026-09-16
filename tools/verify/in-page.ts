/**
 * ブラウザの中で実行する計測。browser.ts がページに文字列のまま渡して呼ぶ。
 * 変換を通さないので、ページに届くコードはここに書いてあるものと完全に同じになる。
 */

export const SMALL_TEXT = String.raw`
(min) => {
  const bad = [];
  // 屋号まわりの添え字と図の中の文字は別の基準で決めているので外す
  const skip = el => el.closest('svg, .logo, .tel-hours, .nav, .draft');
  for (const el of document.querySelectorAll('body *')) {
    if (!el.textContent.trim() || skip(el)) continue;
    const kids = [...el.childNodes];
    if (el.children.length && kids.every(n => n.nodeType !== 3 || !n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < min) bad.push({px: fs, cls: el.className || el.tagName,
                            txt: el.textContent.trim().slice(0, 18)});
  }
  return bad;
}
`;

/** 図解の文字の画面上の実寸。SVG の font-size に表示倍率（getScreenCTM）を掛ける。
    出していない側の図（広い図 / 狭い図の片方）は大きさ 0 なので数えない */
export const FIG_TEXT = String.raw`
(min) => {
  let seen = 0;
  const bad = [];
  for (const t of document.querySelectorAll('.fig svg text')) {
    if (!t.textContent.trim()) continue;
    const r = t.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const m = t.getScreenCTM();
    if (!m) continue;
    seen++;
    const px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b);
    if (px < min - 0.05) bad.push({px: Math.round(px * 100) / 100, txt: t.textContent.trim().slice(0, 18)});
  }
  return {seen, bad};
}
`;

export const ICON_RATIO = String.raw`
() => {
  const seen = {}, out = [];
  for (const svg of document.querySelectorAll('svg.ic')) {
    if (svg.closest('.icb')) continue;          // 40pxの丸は文字と並べない部品
    const r = svg.getBoundingClientRect();
    if (!r.height) continue;                     // 画面外・非表示
    const p = svg.parentElement;
    const fs = parseFloat(getComputedStyle(p).fontSize);
    const key = (svg.getAttribute('class') || '') + '|' + (p.className.baseVal || p.className || p.tagName);
    if (seen[key]) continue;
    seen[key] = 1;
    out.push({key, ratio: Math.round(r.height / fs * 100) / 100});
  }
  return out;
}
`;

export const LCP = String.raw`
() => new Promise(res => {
  let v = 0, el = '';
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) { v = e.startTime; el = e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') : e.url || ''; }
  }).observe({type: 'largest-contentful-paint', buffered: true});
  setTimeout(() => res({lcp: v, el}), 1200);
})
`;

export const TAP = String.raw`
(min) => {
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button]';
  const bad = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;          // 非表示
    if (r.right < 0 || r.bottom < 0) continue;              // 画面外に退避（スキップリンク等）
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // インライン文中のリンクは対象外（本文の途中のリンク）
    if (cs.display === 'inline' && el.tagName === 'A' && el.closest('p, li, td')) continue;
    // 視覚的に隠した入力は、対応する label が押し面になる（セグメント切替などの実装）
    if (el.tagName === 'INPUT' && el.id && (r.width <= 2 || r.height <= 2 || cs.opacity === '0')) {
      const lb = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (lb) {
        const lr = lb.getBoundingClientRect();
        if (lr.height >= min - 0.6 && lr.width >= min - 0.6) continue;
      }
    }
    if (r.height < min - 0.6 || r.width < min - 0.6) {
      bad.push({t: el.tagName, c: el.className || '', txt: (el.textContent||'').trim().slice(0,18),
                w: Math.round(r.width), h: Math.round(r.height)});
    }
  }
  return bad;
}
`;

export const OVERFLOW = String.raw`
() => {
  const de = document.documentElement;
  const over = [];
  if (de.scrollWidth > de.clientWidth + 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
        // 自前で横スクロールを持つ器は許容
        let a = el, ok = false;
        while (a && a !== document.body) {
          const o = getComputedStyle(a).overflowX;
          if (o === 'auto' || o === 'scroll') { ok = true; break; }
          a = a.parentElement;
        }
        if (!ok) over.push({t: el.tagName, c: String(el.className).slice(0,40),
                            right: Math.round(r.right), vw: de.clientWidth});
      }
    }
  }
  return {doc: de.scrollWidth, view: de.clientWidth, offenders: over.slice(0, 6)};
}
`;

// Let Chromium normalize CSS Color 4 (including color-mix) into sRGB + alpha.
// Reading the numbers in color(srgb ...) as 0–255 would report false contrast failures.
const COLOR_READER = String.raw`
  const context = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('Color measurement requires a 2D canvas');
  const colors = new Map();
  const rgba = s => {
    if (!colors.has(s)) {
      if (!CSS.supports('color', s)) throw new Error('Unsupported measured color: ' + s);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = s;
      context.fillRect(0, 0, 1, 1);
      colors.set(s, [...context.getImageData(0, 0, 1, 1).data]);
    }
    return colors.get(s);
  };
  const parse = s => rgba(s).slice(0, 3);
  const alphaOf = s => rgba(s)[3] / 255;
`;

export const CONTRAST = String.raw`
() => {
  const lum = c => {
    const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
${COLOR_READER}
  const bgOf = el => {
    // 半透明の背景は下の色と合成してから評価する（合成しないと誤検出になる）
    const stack = [];
    let a = el;
    while (a) {
      const cs = getComputedStyle(a).backgroundColor;
      const p = parse(cs), al = alphaOf(cs);
      if (p && al > 0) { stack.push([p, al]); if (al >= 0.999) break; }
      a = a.parentElement;
    }
    let base = [255,255,255];
    for (let i = stack.length - 1; i >= 0; i--) {
      const [c, al] = stack[i];
      base = [0,1,2].map(j => Math.round(c[j] * al + base[j] * (1 - al)));
    }
    return base;
  };
  const ratio = (f,b) => { const L1 = lum(f), L2 = lum(b);
    const hi = Math.max(L1,L2), lo = Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
  const targets = ['.nah-app', '.lede', '.dim', '.nav a', '.tel', '.tel .num', '.tel .lbl',
                   '.btn-1', '.btn-2', '.card .meta', '.plan .why', '.plan .pmeta',
                   '.hero h1, .hero .service-intro-title', '.hero .sub', '.hero .kick', '.logo .n', '.logo .s',
                   '.brand-hero-copy h1', '.brand-hero-copy p',
                   '.header-contact', '.logo .roman', '.menu > summary', '.header-phone',
                   '.footer-contact', '.footer-phone', '.footer-links a', '.footer-industries a', '.ftr-legal a', '.footer-top',
                   '.amt', '.pricebox .alt li', '.amtwrap .pre',
                   'thead th', '.ftr p', '.ftr .fine', '.sh .lab', '.calc .r .k em',
                   '.calc .r.net .v', '.calc .r.net .k', '.stat .k', '.vs .nm em',
                   'ol.steps li .d', '.tbl caption', '.tbl tfoot td', '.segnote',
                   '.plan .tag', '.draft', '.fig figcaption', '.ind .p',
                   '.calc .r.net .k em', '.entry .lab', '.entry .sub2',
                   '.flow .d', '.flow .tags span', '.tbl-note', '.fine-note'];
  const out = [];
  for (const s of targets) {
    // 最初の1つだけでなく全部見る。明るい節と暗い節で同じクラスの色が変わるので、
    // 1つ目だけ測っていると暗い節の側を素通りする（緑地に緑の補足文字を実際に出した）。
    let worst = null;
    for (const el of [...document.querySelectorAll(s)].slice(0, 40)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!el.textContent.trim()) continue;
      const fg = parse(cs.color); if (!fg) continue;
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const r = +ratio(fg, bgOf(el)).toFixed(2);
      if (!worst || r < worst.ratio) {
        worst = {sel: s, ratio: r, size: +size.toFixed(1), large};
      }
    }
    if (worst) out.push(worst);
  }
  return out;
}
`;

/**
 * 図のSVGテキストは fill と opacity で色が決まるので、本文用の検査では捕まらない。
 * 明るい節・墨紺の節の両方を見るため、全ページで最悪値を出す。
 */
export const FIG_CONTRAST = String.raw`
() => {
  const lum = c => {
    const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
${COLOR_READER}
  const bgOf = el => {
    const stack = []; let a = el;
    while (a) {
      const cs = getComputedStyle(a).backgroundColor;
      const p = parse(cs), al = alphaOf(cs);
      if (p && al > 0) { stack.push([p, al]); if (al >= 0.999) break; }
      a = a.parentElement;
    }
    let base = [255,255,255];
    for (let i = stack.length - 1; i >= 0; i--) {
      const [c, al] = stack[i];
      base = [0,1,2].map(j => Math.round(c[j] * al + base[j] * (1 - al)));
    }
    return base;
  };
  const ratio = (f,b) => { const L1 = lum(f), L2 = lum(b);
    const hi = Math.max(L1,L2), lo = Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
  let worst = null;
  for (const t of document.querySelectorAll('figure.fig svg text')) {
    if (!t.textContent.trim()) continue;
    const cs = getComputedStyle(t);
    let fg = parse(cs.fill); if (!fg) continue;
    // opacity / fill-opacity は下地と合成してから評価する
    let a = parseFloat(cs.opacity || '1') * parseFloat(cs.fillOpacity || '1');
    let p = t.parentElement;
    while (p && p !== document.documentElement) {
      a *= parseFloat(getComputedStyle(p).opacity || '1'); p = p.parentElement;
    }
    const bg = bgOf(t.closest('figure'));
    if (a < 0.999) fg = [0,1,2].map(j => Math.round(fg[j] * a + bg[j] * (1 - a)));
    const size = parseFloat(cs.fontSize) || 12;
    const bold = parseInt(cs.fontWeight) >= 700;
    const r = +ratio(fg, bg).toFixed(2);
    if (!worst || r < worst.ratio)
      worst = {ratio: r, size: +size.toFixed(1), bold,
               text: t.textContent.trim().slice(0, 20)};
  }
  return worst;
}
`;

/** レイアウトの計測は theme.css が適用されてからでなければ意味がない */
export const STYLES_READY = String.raw`
() => [...document.styleSheets].some(s => {
  try { return (s.href||'').includes('theme.css') && s.cssRules.length > 0 }
  catch(e) { return false } })
`;
