#!/usr/bin/env python3
"""
標準仕様の自動検証 ── これが「納品する仕様」の実体。
1つでも FAIL があれば納品しない。顧客サイトにも同じスクリプトをかける。

    python verify.py              # 静的＋ブラウザ検証
    python verify.py --static     # 静的のみ（ブラウザ不要）
    python verify.py --write      # LCP実測値を config.py に書き戻す

出力: 標準出力のレポート ＋ dist/../verify-report.json
"""
import json
import re
import socket
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent

# 検査するディレクトリは差し替えられる。Astro 版への移行中、
# 同じ検査を両方の出力にかけて突き合わせるため。
#   python verify.py --dist ../svc-astro/dist --scaffold
def _prices():
    """金額の正本を読む。
       Astro版は prices.ts が正本なので、ビルドが書き出した prices.json を使う。
       それが無ければ Python版の prices.py を読む（移行が終わるまでの両対応）。
       どちらの場合も『計算し直した値』ではなく『正本の値』とページを突き合わせる。"""
    j = DIST.parent / "prices.json"
    if j.exists():
        return json.loads(j.read_text(encoding="utf-8"))
    import prices as _P
    rows = _P.compare_rows()
    return {
        "single_price": _P.SINGLE["price"],
        "monthly_std": _P.monthly_all_in("standard", "run_standard"),
        "compare_first": {"sub_total": rows[0]["sub_total"], "our_total": rows[0]["our_total"]},
        "subs_source": _P.SUBS_SOURCE,
        "build_prices": [b["price"] for b in _P.BUILD],
        "run_prices": [r["price"] for r in _P.RUN],
    }


def _arg(flag, default):
    a = sys.argv
    return a[a.index(flag) + 1] if flag in a and a.index(flag) + 1 < len(a) else default


DIST = Path(_arg("--dist", str(ROOT / "dist"))).resolve()

# 移行の途中は、まだ全ページが揃っていない。
# サイト全体を前提にする検査（ページ数・業種4枚・必須ページの相互リンク・
# 他社比較の金額）だけを外し、1ページずつの検査はすべて通常どおりかける。
SCAFFOLD = "--scaffold" in sys.argv
REFERENCE = ROOT / "dist"      # 移行元（Python版）の出力。未移植ページの判定に使う
WHOLE_SITE_CHECKS = ("04 料金の明示", "05 業種別ページ", "25 必須ページ",
                     "26 主張の一貫性", "29 価格の一致", "30 他社比較の出典")

LCP_BUDGET_MS = 2500
TAP_MIN = 44            # WCAG 2.5.8 の最小は24。読み手が50〜60代なので44を採用
HTML_BUDGET_KB = 100
CONTRAST_BODY = 4.5     # WCAG AA（通常テキスト）
CONTRAST_LARGE = 3.0    # WCAG AA（大きいテキスト）
MOBILE_W = 390        # ガイドの検証寸法（18 再現性）
WIDTHS = (390, 768, 1440)
MIN_FONT_MB = 12      # スマホでの本文・補助文字の下限（ロゴの添え字などは下の除外に入れる）
IC_RATIO_MIN, IC_RATIO_MAX = 1.10, 1.30   # アイコンの高さ ÷ 隣の文字の大きさ

SMALL_TEXT_JS = """
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
"""

ICON_RATIO_JS = """
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
"""

R = []          # (level, check, page, detail)  level: PASS/FAIL/WARN


def rec(level, check, page, detail=""):
    if SCAFFOLD and check in WHOLE_SITE_CHECKS:
        return          # 全ページが揃ってから見る検査
    R.append((level, check, page, detail))


def pages():
    return sorted(p for p in DIST.glob("*.html"))


# ═══════════════════════════════════ 静的検証
def check_static():
    import config as C
    files = pages()
    # dist の中に実在するものを、相対パスのまま全部拾う（og/ や fonts/ も対象にする）
    names = {str(q.relative_to(DIST)) for q in DIST.rglob("*") if q.is_file()}

    if not files:
        rec("FAIL", "出力", "-", "dist/ にHTMLがありません。build.py を先に実行してください")
        return

    # トークンは design.tokens.json が正本。生成物とずれていたら納品しない（16 導入と運用）
    import subprocess
    r = subprocess.run(["node", str(ROOT / "native" / "build-tokens.mjs"), "--check"],
                       capture_output=True, text=True)
    rec("PASS" if r.returncode == 0 else "FAIL", "20 トークンの同期", "design.tokens.json",
        (r.stdout or r.stderr).strip().splitlines()[0] if (r.stdout or r.stderr) else "")

    css = (DIST / "theme.css").read_text(encoding="utf-8")

    # ガイドの数値がそのまま出ているか。書き換えたら気づけるようにする
    GUIDE = [
        ("--nah-size-header-pc: 62px", "ヘッダー高 PC 62px"),
        ("--nah-size-header-mb: 54px", "ヘッダー高 モバイル 54px"),
        ("--nah-size-cta-w-pc: 315px", "主要CTA幅 PC 315px"),
        ("--nah-size-cta-h-pc: 57px", "主要CTA高 PC 57px"),
        ("--nah-size-cta-w-mb: 260px", "主要CTA幅 モバイル 260px"),
        ("--nah-size-cta-h-mb: 48px", "主要CTA高 モバイル 48px"),
        ("--nah-size-container: 1104px", "器 1104px"),
        ("--nah-size-measure-read: 720px", "読み幅 720px"),
        ("--nah-font-size-hero-pc: 45px", "ヒーロー PC 45px"),
        ("--nah-font-size-hero-mb: 24px", "ヒーロー モバイル 24px"),
        ("--nah-color-ink: #0B0B0D", "暗い章 #0B0B0D"),
        ("--nah-color-green: #42D083", "LPの緑 #42D083"),
        ("--nah-color-muted: #626873", "補助文字の推奨値 #626873"),
        ("--nah-radius-media: 8px", "角丸 media 8px"),
        ("--nah-radius-pill: 999px", "角丸 pill 999px"),
    ]
    bad = [d for t, d in GUIDE if t not in css]
    rec("PASS" if not bad else "FAIL", "21 ガイドの実測値", "tokens.css",
        f"{len(GUIDE)}項目すべて一致" if not bad else f"ずれ: {bad}")

    # 観測値のうち、使わないと決めたもの（05 色とテーマ）
    banned = [("#858A95", "補助文字は #626873 を使う"),
              ("Shippori", "日本語はガイドの端末書体スタックを使う"),
              ("fonts.googleapis.com", "外部フォントに依存しない")]
    css_nc = re.sub(r"/\*.*?\*/", "", css, flags=re.S)   # 説明のコメントは対象外
    hit = [m for t, m in banned if t in css_nc]
    rec("PASS" if not hit else "FAIL", "22 使わないと決めた値", "theme.css",
        "混入なし" if not hit else f"混入: {hit}")

    # 図の色。accent（勧める側）と ok（残るもの）は同じ意味圏なので同色でよいが、
    # bad（失われるもの）が同色になると、良い話と悪い話が区別できなくなる。
    def _tok(name):
        m = re.search(rf"--nah-{name}:\s*([^;]+);", css)
        return m.group(1).strip() if m else None
    good = {_tok("theme-campaign-accent-text"), _tok("color-ok")} - {None}
    badc = _tok("color-alert")
    ok = badc and badc not in good
    rec("PASS" if ok else "FAIL", "24 図の色（良／悪の区別）", "tokens.css",
        f"良={sorted(good)} 悪={badc}" if ok else f"良と悪が同色: {badc}")

    used = set(re.findall(r"var\(--([a-z0-9-]+)\)", css))
    declared = set(re.findall(r"--([a-z0-9-]+)\s*:", css))
    missing = sorted(used - declared)
    rec("FAIL" if missing else "PASS", "17 CSSトークンの定義", "theme.css",
        f"未定義: {missing}" if missing else f"{len(declared)}個すべて定義済み")

    # 25 説明文の行き先。約束を書いておく場所が無いまま「やめても残ります」と書かない。
    #    3枚はどのページからも1タップで行ける必要がある（フッターに置いてある）。
    MUST = {"terms.html": "ご契約とお約束", "privacy.html": "個人情報の取り扱い",
            "legal.html": "特定商取引法に基づく表記", "owned.html": "借地と所有"}
    for f, label in MUST.items():
        if not (DIST / f).exists():
            rec("FAIL", "25 必須ページ", f, f"{label} がありません")
            continue
        miss = [p.name for p in files if f'href="{f}"' not in p.read_text(encoding="utf-8")]
        rec("PASS" if not miss else "FAIL", "25 必須ページ", f,
            f"{label}（全ページから到達可）" if not miss else f"リンクが無いページ: {miss}")

    # 29 価格の一致。prices.py の計算結果が、実際にページに出ているか。
    #    運用プランを1つ足したとき、添字で引いていた箇所が静かにずれて
    #    全ページの月額が下振れした。同じ事故を二度やらないための検査。
    _P = _prices()
    PRICE_FACTS = [
        (f"{_P['monthly_std']:,}円／月", "price.html", "スタンダードの毎月の合計"),
        (f"{_P['single_price']:,}", "index.html", "シングルの価格"),
        (f"{_P['single_price']:,}", "price.html", "シングルの価格"),
        (f"{_P['compare_first']['sub_total']:,}円", "price.html", "月額制1ページの36か月総額"),
        (f"{_P['compare_first']['our_total']:,}円", "price.html", "当方1ページの36か月総額"),
    ]
    for txt, fname, what in PRICE_FACTS:
        h = (DIST / fname).read_text(encoding="utf-8") if (DIST / fname).exists() else ""
        # 「28,000<span class="u">円／月」のようにタグで割れているので、外してから探す
        flat = re.sub(r"<[^>]+>", "", h)
        rec("PASS" if txt in flat else "FAIL", "29 価格の一致", fname,
            f"{what} {txt}" if txt in flat else f"{what} {txt} がページに出ていません")

    # 30 他社比較の出典。金額を並べる以上、いつ時点の公開情報かを必ず添える。
    for fname in ("index.html", "price.html"):
        if not (DIST / fname).exists():
            continue
        h = (DIST / fname).read_text(encoding="utf-8")
        if "月額制" not in h:
            continue
        ok = _P['subs_source'] in h
        rec("PASS" if ok else "FAIL", "30 他社比較の出典", fname,
            _P['subs_source'] if ok else "比較の金額に出典・時点の記載がありません")

    # 26 主張の一貫性。トップの1番の主張と、その根拠ページが同じ言葉で書かれていること。
    idx = (DIST / "index.html").read_text(encoding="utf-8") if (DIST / "index.html").exists() else ""
    own = (DIST / "owned.html").read_text(encoding="utf-8") if (DIST / "owned.html").exists() else ""
    words = [w for w in ("借地", "所有", "名義", "ソースコード") if not (w in idx and w in own)]
    rec("PASS" if not words else "FAIL", "26 主張の一貫性", "index.html / owned.html",
        "借地・所有・名義・ソースコードが両方にあります" if not words
        else f"片方にしか無い語: {words}")

    if (DIST / "llms.txt").exists():
        rec("FAIL", "禁止 llms.txt", "-", "根拠がないため作らない方針に反しています")
    else:
        rec("PASS", "禁止 llms.txt", "-", "作られていません（方針どおり）")

    for p in files:
        n = p.name
        h = p.read_text(encoding="utf-8")
        kb = len(h.encode()) / 1024

        # 01 電話番号：tel: リンクがあり、番号が文字で入っている
        tels = re.findall(r'href="tel:([0-9+\-]+)"', h)
        tel_text = C.TEL in h
        if tels and tel_text:
            ok = all(t.replace("-", "") == C.TEL_LINK for t in tels)
            rec("PASS" if ok else "FAIL", "01 電話番号(tel:＋文字)", n,
                f"{len(tels)}箇所" if ok else f"config と不一致: {set(tels)}")
        else:
            rec("FAIL", "01 電話番号(tel:＋文字)", n,
                f"tel:リンク={len(tels)} / 番号の文字={tel_text}")

        # 02/03 営業時間・住所（フッターに文字で）
        has_hours = C.TEL_HOURS in h
        has_addr = C.ADDRESS_REGION in h and C.POSTAL_CODE in h
        rec("PASS" if (has_hours and has_addr) else "FAIL", "02-03 営業時間・住所", n,
            "" if (has_hours and has_addr) else f"時間={has_hours} 住所={has_addr}")

        # 12 lang / viewport
        rec("PASS" if 'lang="ja"' in h else "FAIL", "12 lang属性", n)
        vp = 'name="viewport" content="width=device-width' in h
        rec("PASS" if vp else "FAIL", "12 viewport", n)

        # h1 はちょうど1つ
        h1 = len(re.findall(r"<h1[\s>]", h))
        rec("PASS" if h1 == 1 else "FAIL", "見出し h1 が1つ", n, f"{h1}個")

        # title / description
        t = re.search(r"<title>(.*?)</title>", h, re.S)
        d = re.search(r'name="description" content="(.*?)"', h, re.S)
        tl = len(t.group(1)) if t else 0
        dl = len(d.group(1)) if d else 0
        rec("PASS" if 0 < tl <= 70 else "WARN", "title の長さ", n, f"{tl}文字")
        rec("PASS" if 40 <= dl <= 160 else "WARN", "description の長さ", n, f"{dl}文字")

        # 17 構造化データ
        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
        if not m:
            rec("FAIL", "17 構造化データ", n, "JSON-LD がありません")
        else:
            try:
                sd = json.loads(m.group(1))
                need = ["@type", "name", "address", "telephone"]
                lack = [k for k in need if k not in sd]
                is_faq = "FAQPage" in m.group(1)
                if lack:
                    rec("FAIL", "17 構造化データ", n, f"不足: {lack}")
                elif is_faq:
                    rec("FAIL", "17 構造化データ", n, "FAQPage は2026-05-07に表示終了。使わない方針に反します")
                else:
                    rec("PASS", "17 構造化データ", n, f"@type={sd['@type']}")
            except json.JSONDecodeError as ex:
                rec("FAIL", "17 構造化データ", n, f"JSONが不正: {ex}")

        # 07/14 画像：alt 必須・先頭画像に lazy をかけない
        imgs = re.findall(r"<img\b[^>]*>", h)
        noalt = [i for i in imgs if "alt=" not in i]
        rec("PASS" if not noalt else "FAIL", "07 imgのalt", n,
            f"{len(imgs)}枚すべてalt有り" if not noalt else f"alt無し {len(noalt)}枚")
        if imgs:
            first = imgs[0]
            bad = 'loading="lazy"' in first
            prio = 'fetchpriority="high"' in first
            rec("FAIL" if bad else "PASS", "14 先頭画像にlazyを付けない", n,
                "lazy が付いています" if bad else "")
            rec("PASS" if prio else "WARN", "14 先頭画像に fetchpriority", n,
                "" if prio else "fetchpriority=\"high\" 推奨")
        else:
            rec("PASS", "14 先頭画像にlazyを付けない", n, "画像なし（文字がLCP要素＝最速）")

        # 23 共有カード。URLを送るのが主要導線なので、真っ白なカードを出さない
        og = re.search(r'property="og:image" content="https://[^"]*?/og/([^"]+)"', h)
        tw = 'name="twitter:card"' in h
        favi = 'rel="icon"' in h and 'rel="apple-touch-icon"' in h
        if not og:
            rec("FAIL", "23 共有カード(OGP)", n, "og:image がありません")
        elif f"og/{og.group(1)}" not in names:
            rec("FAIL", "23 共有カード(OGP)", n,
                f"og/{og.group(1)} が dist にありません。python make_og.py を実行してください")
        elif not (tw and favi):
            rec("FAIL", "23 共有カード(OGP)", n,
                f"twitter:card={tw} / ファビコン={favi}")
        else:
            rec("PASS", "23 共有カード(OGP)", n, f"og/{og.group(1)}")

        # インラインSVG（アイコン）は装飾なので aria-hidden が必須
        svgs = re.findall(r"<svg\b[^>]*>", h)
        bad_svg = [x for x in svgs if 'aria-hidden="true"' not in x and 'role="img"' not in x]
        rec("PASS" if not bad_svg else "FAIL", "インラインSVGの aria-hidden", n,
            f"{len(svgs)}個すべて aria-hidden" if not bad_svg else f"欠落 {len(bad_svg)}個")

        # 実行時JSなし（0バイトを主張しているので検証する）
        scripts = re.findall(r'<script\b(?![^>]*application/ld\+json)[^>]*>', h)
        inline_ev = re.findall(r"\son(?:click|load|error|change|submit)=", h)
        rec("PASS" if not scripts and not inline_ev else "FAIL", "実行時JSなし", n,
            "" if not scripts and not inline_ev else f"script={len(scripts)} inline={len(inline_ev)}")

        # 内部リンクの解決。
        # 移行中は、まだ移していないページへのリンクを「リンク切れ」とは呼ばない。
        # Python版の出力に実在するものは「未移植」、どこにも無いものだけが本当の切れ。
        hrefs = re.findall(r'href="([^"#:]+?)(?:#[^"]*)?"', h)
        dead = sorted({x for x in hrefs
                       if not x.startswith(("http", "mailto", "tel", "//")) and x not in names})
        if SCAFFOLD:
            todo = sorted(x for x in dead if (REFERENCE / x).exists())
            dead = [x for x in dead if x not in todo]
            rec("PASS" if not dead else "FAIL", "内部リンクの解決", n,
                f"未移植 {len(todo)}件（Python版には実在）" if not dead
                else f"リンク切れ: {dead}")
        else:
            rec("PASS" if not dead else "FAIL", "内部リンクの解決", n,
                "" if not dead else f"リンク切れ: {dead}")

        # ページ容量
        rec("PASS" if kb <= HTML_BUDGET_KB else "WARN", "ページ容量", n, f"{kb:.1f} KB")

        # スキップリンクと form label
        rec("PASS" if 'class="skip"' in h else "WARN", "スキップリンク", n)
        ids = set(re.findall(r'<(?:input|textarea|select)[^>]*\bid="([^"]+)"', h))
        fors = set(re.findall(r'<label[^>]*\bfor="([^"]+)"', h))
        if ids or fors:
            rec("PASS" if fors <= ids and ids <= fors else "FAIL", "フォームのlabel対応", n,
                "" if fors == ids else f"label側={sorted(fors-ids)} 入力側={sorted(ids-fors)}")

    # 04 料金の明示（料金ページに金額が入っている）
    P4 = _prices()
    pr = (DIST / "price.html").read_text(encoding="utf-8") \
        if (DIST / "price.html").exists() else ""
    want = [f"{v:,}" for v in P4["build_prices"] + P4["run_prices"]]
    lack = [w for w in want if w not in pr]
    rec("PASS" if not lack else "FAIL", "04 料金の明示", "price.html",
        "全プランの金額を掲載" if not lack else f"欠落: {lack}")

    # 05 業種でCTAを入れ替える（業種ページが4本ある）
    ind = [f for f in {"restaurant.html", "koumuten.html", "salon.html", "shigyo.html"}
           if (DIST / f).exists()]
    rec("PASS" if len(ind) == 4 else "FAIL", "05 業種別ページ", "-", f"{len(ind)}/4")

    # 仮の値のまま公開していないか
    if C.PLACEHOLDER:
        rec("WARN", "公開前チェック", "config.py",
            "PLACEHOLDER=True。ブランド名・エリア・電話番号が仮の値です")
    else:
        stale = [k for k, v in [("TEL", C.TEL), ("DOMAIN", C.DOMAIN), ("EMAIL", C.EMAIL)]
                 if "example" in str(v) or "0000" in str(v)]
        rec("FAIL" if stale else "PASS", "公開前チェック", "config.py",
            f"仮の値が残っています: {stale}" if stale else "")


# ═══════════════════════════════════ ブラウザ検証
def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def serve(port):
    handler = partial(SimpleHTTPRequestHandler, directory=str(DIST))
    handler.log_message = lambda *a, **k: None
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


LCP_JS = """
() => new Promise(res => {
  let v = 0, el = '';
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) { v = e.startTime; el = e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') : e.url || ''; }
  }).observe({type: 'largest-contentful-paint', buffered: true});
  setTimeout(() => res({lcp: v, el}), 1200);
})
"""

TAP_JS = """
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
"""

OVERFLOW_JS = """
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
"""

CONTRAST_JS = """
() => {
  const lum = c => {
    const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const parse = s => { const m = s.match(/[\\d.]+/g); return m ? m.slice(0,3).map(Number) : null; };
  const alphaOf = s => { const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return 1; const p = m[1].split(',').map(x => parseFloat(x));
    return p.length > 3 ? p[3] : 1; };
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
                   '.hero h1', '.hero .sub', '.hero .kick', '.logo .n', '.logo .s',
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
"""

# 図のSVGテキストは fill と opacity で色が決まるので、本文用の検査では捕まらない。
# 明るい節・墨紺の節の両方を見るため、全ページで最悪値を出す。
FIG_CONTRAST_JS = """
() => {
  const lum = c => {
    const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const parse = s => { const m = s.match(/[\\d.]+/g); return m ? m.slice(0,3).map(Number) : null; };
  const alphaOf = s => { const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return 1; const p = m[1].split(',').map(x => parseFloat(x));
    return p.length > 3 ? p[3] : 1; };
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
"""


def check_browser(write_back=False):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        rec("WARN", "ブラウザ検証", "-", "playwright が入っていません。--static で実行してください")
        return None

    port = free_port()
    srv = serve(port)
    base = f"http://127.0.0.1:{port}"
    lcps = {}
    blocked = []

    def block_external(route):
        """検証環境は外部に出られないので、サードパーティは遮断して自前のバイトだけを測る。
           font-display:swap を指定しているため、本番でも文字はフォールバックで即描画され、
           LCPはフォント取得を待たない。この測定値は本番の下限として扱う。"""
        u = route.request.url
        if u.startswith(f"http://127.0.0.1:{port}"):
            route.continue_()
        else:
            blocked.append(u.split("/")[2])
            route.abort()

    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(args=["--no-sandbox"])
            # ── デスクトップ：LCP・コントラスト・コンソール
            pg = br.new_page(viewport={"width": 1280, "height": 900})
            pg.route("**/*", block_external)
            errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda x: errs.append(str(x)))

            for f in pages():
                pg.goto(f"{base}/{f.name}", wait_until="domcontentloaded")
                r = pg.evaluate(LCP_JS)
                lcps[f.name] = r["lcp"]
                ok = r["lcp"] <= LCP_BUDGET_MS
                rec("PASS" if ok else "FAIL", "13 LCP 2.5秒以内", f.name,
                    f"{r['lcp']:.0f}ms / 要素={r['el']}")

                w = pg.evaluate(FIG_CONTRAST_JS)
                if w:
                    need = CONTRAST_LARGE if (w["size"] >= 24 or (w["bold"] and w["size"] >= 18.66)) \
                        else CONTRAST_BODY
                    rec("PASS" if w["ratio"] >= need else "FAIL", "図のコントラスト比 AA", f.name,
                        f"最悪 {w['ratio']}:1 (必要 {need}, {w['size']}px) 「{w['text']}」")

            have = {f.name for f in pages()}
            targets = [c for c in ("index.html", "price.html", "owned.html", "flow.html")
                       if c in have] or [sorted(have)[0]]
            for cf in targets:
                pg.goto(f"{base}/{cf}", wait_until="domcontentloaded")
                for c in pg.evaluate(CONTRAST_JS):
                    need = CONTRAST_LARGE if c["large"] else CONTRAST_BODY
                    rec("PASS" if c["ratio"] >= need else "FAIL", "コントラスト比 AA", cf,
                        f"{c['sel']} = {c['ratio']}:1 (必要 {need}, {c['size']}px)")

            # 自前で遮断した外部通信の ERR_FAILED は検証上のノイズなので除外する
            real = [x for x in errs if "net::ERR_FAILED" not in x]
            rec("PASS" if not real else "FAIL", "コンソールエラー", "-",
                f"自前の遮断による {len(errs)-len(real)}件を除外" if not real
                else f"{len(real)}件: {real[:3]}")
            pg.close()

            # ── モバイル 400px：横スクロール・タップ領域
            mp = br.new_page(viewport={"width": MOBILE_W, "height": 780},
                             device_scale_factor=2, is_mobile=True, has_touch=True)
            mp.route("**/*", block_external)
            for f in pages():
                mp.goto(f"{base}/{f.name}", wait_until="domcontentloaded")
                # レイアウトの計測はCSS適用後でなければ意味がない
                mp.wait_for_function(
                    "() => [...document.styleSheets].some(s => {"
                    "  try { return (s.href||'').includes('theme.css') && s.cssRules.length > 0 }"
                    "  catch(e) { return false } })", timeout=5000)
                ov = mp.evaluate(OVERFLOW_JS)
                clean = not ov["offenders"]
                rec("PASS" if clean else "FAIL", f"横スクロールなし({MOBILE_W}px)", f.name,
                    "" if clean else f"doc={ov['doc']} > view={ov['view']} / {ov['offenders']}")
                bad = mp.evaluate(TAP_JS, TAP_MIN)
                rec("PASS" if not bad else "FAIL", f"16 タップ領域 {TAP_MIN}px", f.name,
                    "" if not bad else f"{len(bad)}件: {bad[:3]}")

                # 27 手に持つ画面での文字の下限。
                # ガイド06の寸法はPC向けなので、スマホでは別に測る。読み手が50〜60代
                # である前提はタップ領域44pxと同じで、文字にも同じ根拠で効かせる。
                small = mp.evaluate(SMALL_TEXT_JS, MIN_FONT_MB)
                rec("PASS" if not small else "FAIL", f"27 文字の下限 {MIN_FONT_MB}px", f.name,
                    "" if not small else f"{len(small)}件: {small[:3]}")

                # 28 アイコンと文字の大きさの比。
                # px で固定すると置き場所ごとに 0.88〜1.20 倍とばらつき、行の中で浮く。
                # em で決めているので、比は常に一定になるはず。崩れたら気づけるようにする。
                ir = mp.evaluate(ICON_RATIO_JS)
                off = [x for x in ir if not (IC_RATIO_MIN <= x["ratio"] <= IC_RATIO_MAX)]
                rec("PASS" if not off else "FAIL", "28 アイコンと文字の比", f.name,
                    f"{len(ir)}種すべて {IC_RATIO_MIN}〜{IC_RATIO_MAX} 倍"
                    if not off else f"外れ {len(off)}件: {off[:3]}")

            shot = "index.html" if (DIST / "index.html").exists() else sorted(
                f.name for f in pages())[0]
            mp.goto(f"{base}/{shot}", wait_until="domcontentloaded")
            (ROOT / "shot-mobile.png").write_bytes(mp.screenshot(full_page=False))
            mp.close()

            dp = br.new_page(viewport={"width": 1280, "height": 900})
            dp.route("**/*", block_external)
            dp.goto(f"{base}/{shot}", wait_until="domcontentloaded")
            (ROOT / "shot-desktop.png").write_bytes(dp.screenshot(full_page=False))
            if (DIST / "price.html").exists():
                dp.goto(f"{base}/price.html", wait_until="domcontentloaded")
                (ROOT / "shot-price.png").write_bytes(dp.screenshot(full_page=False))
            dp.close()
            br.close()
    finally:
        srv.shutdown()

    if blocked:
        rec("WARN", "測定条件", "-",
            f"サードパーティ遮断下で測定: {sorted(set(blocked))}。"
            "font-display:swap のため本番でも文字はフォールバックで即描画されるが、"
            "確定値は公開後にフィールドデータで再測定すること")
    worst = max(lcps.values()) if lcps else 0
    if write_back and lcps:
        # 実測値は、いま検査した dist を作った側の設定に書き戻す。
        # Astro版を検査したのに Python版の config.py を書き換えると、
        # サイトに出る数字と測った対象がずれる。
        txt = f"{worst/1000:.2f}秒（全{len(lcps)}ページの最大値・実測）"
        ts = DIST.parent / "src" / "data" / "config.ts"
        if ts.exists():
            src = ts.read_text(encoding="utf-8")
            ts.write_text(re.sub(r"^export const LCP_MEASURED = .*$",
                                 f"export const LCP_MEASURED = '{txt}';", src, flags=re.M),
                          encoding="utf-8")
            print(f"\nconfig.ts の LCP_MEASURED を {txt} に更新しました。再ビルドしてください。")
        else:
            cfg = (ROOT / "config.py").read_text(encoding="utf-8")
            cfg = re.sub(r"^LCP_MEASURED = .*$", f'LCP_MEASURED = "{txt}"', cfg, flags=re.M)
            (ROOT / "config.py").write_text(cfg, encoding="utf-8")
            print(f"\nconfig.py の LCP_MEASURED を {txt} に更新しました。build.py を再実行してください。")
    return worst


# ═══════════════════════════════════ レポート
def report():
    fails = [r for r in R if r[0] == "FAIL"]
    warns = [r for r in R if r[0] == "WARN"]
    passes = [r for r in R if r[0] == "PASS"]

    # チェック名ごとに集約して表示
    by = {}
    for lvl, chk, pg, dt in R:
        by.setdefault(chk, []).append((lvl, pg, dt))

    print("\n" + "=" * 74)
    print("  標準仕様の自動検証レポート")
    print("=" * 74)
    for chk in sorted(by, key=lambda c: (0 if any(l == "FAIL" for l, _, _ in by[c]) else
                                         1 if any(l == "WARN" for l, _, _ in by[c]) else 2, c)):
        rows = by[chk]
        nf = sum(1 for l, _, _ in rows if l == "FAIL")
        nw = sum(1 for l, _, _ in rows if l == "WARN")
        mark = "FAIL" if nf else ("WARN" if nw else " ok ")
        print(f"\n[{mark}] {chk}  ({len(rows)-nf-nw}/{len(rows)} pass)")
        shown = [r for r in rows if r[0] != "PASS"][:6]
        if not shown:
            samp = next((d for _, _, d in rows if d), "")
            if samp:
                print(f"        例: {samp}")
        for lvl, pg, dt in shown:
            print(f"        {lvl} {pg}: {dt}")

    print("\n" + "-" * 74)
    print(f"  PASS {len(passes)}   WARN {len(warns)}   FAIL {len(fails)}")
    print("-" * 74)
    verdict = "納品可" if not fails else "納品不可"
    print(f"  判定: {verdict}")
    if fails:
        print("  FAIL が1件でもあれば納品しません。上の指摘を直してから再実行してください。")
    print("=" * 74 + "\n")

    (DIST.parent / "verify-report.json").write_text(json.dumps({
        "verdict": verdict,
        "pass": len(passes), "warn": len(warns), "fail": len(fails),
        "results": [{"level": l, "check": c, "page": p, "detail": d} for l, c, p, d in R],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if not fails else 1


if __name__ == "__main__":
    static_only = "--static" in sys.argv
    write_back = "--write" in sys.argv
    check_static()
    if not static_only:
        check_browser(write_back=write_back)
    sys.exit(report())
