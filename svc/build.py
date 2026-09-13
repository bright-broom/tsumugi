#!/usr/bin/env python3
"""
静的サイトジェネレータ。
このジェネレータは自社サイトと顧客サイトで共用する（テンプレート資産化）。
出力は依存ゼロの静的HTML。npm も実行時JSも使わない。

    python build.py            # dist/ に出力
    python verify.py           # 標準仕様20項目を自動検証
"""
import html
import json
import re
import shutil
from pathlib import Path

import config as C
import diagrams as D
import prices as P
from icons import ICONS

ROOT = Path(__file__).parent
OUT = ROOT / "dist"
NATIVE = ROOT / "native"

# スタイルは native/ の4ファイルを @layer 順に連結して1本にする。
# @import は直列で読み込まれてLCPを落とすので、ビルド時に結合する。
CSS_PARTS = ["tokens.css", "index.css", "components.css", "guide.css"]
# @view-transition は層の中に置かない（層内では効かない実装があるため先頭に出す）。
# 対応していないブラウザでは単に無視される＝実行時JSは0バイトのまま。
CSS_LAYERS = ("@layer base, components, screens, overrides;\n"
              "@view-transition { navigation: auto; }\n")

def ic(name, cls="", size=None):
    """Lucide を SVG で直接埋め込む。実行時JSは使わない。"""
    p = ICONS.get(name)
    if p is None:
        raise KeyError(f"unknown icon: {name}")
    st = f' style="width:{size}px;height:{size}px"' if size else ""
    c = f"ic {cls}".strip()
    return (f'<svg class="{c}"{st} viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true" focusable="false">{p}</svg>')


NAV_IC = {
    "index.html": "circle-dollar-sign", "owned.html": "key", "price.html": "calculator",
    "unlimited.html": "repeat-2", "source.html": "code-xml",
    "cost-cut.html": "trending-down", "subsidy.html": "hand-coins",
    "spec.html": "list-checks", "flow.html": "route", "works.html": "image",
    "faq.html": "circle-help", "about.html": "users", "contact.html": "message-circle",
    "terms.html": "scroll-text", "privacy.html": "shield", "legal.html": "landmark",
}

NAV = [
    ("index.html", "ホーム"),
    ("owned.html", "借地と所有"),
    ("price.html", "料金"),
    ("unlimited.html", "変更は何回でも"),
    ("source.html", "ソースコードの納品"),
    ("cost-cut.html", "掲載費の見直し"),
    ("subsidy.html", "補助金"),
    ("spec.html", "納品する仕様"),
    ("flow.html", "制作の流れ"),
    ("works.html", "制作事例"),
    ("faq.html", "よくあるご質問"),
    ("about.html", "私たちについて"),
    ("contact.html", "相談する"),
]

# C01 の「階層入口」。全部はヘッダーに入らないので、判断に効く4本だけ置く。
# 主張の1番は「借地か所有か」なので、先頭はそこに使う。
NAV_MAIN = [
    ("owned.html", "借地と所有"),
    ("price.html", "料金"),
    ("cost-cut.html", "掲載費の見直し"),
    ("subsidy.html", "補助金"),
]

# 約束を書いた場所。フッターの下段に別枠で置く（本編の案内と混ぜない）
NAV_LEGAL = [
    ("terms.html", "ご契約とお約束"),
    ("privacy.html", "個人情報の取り扱い"),
    ("legal.html", "特定商取引法に基づく表記"),
]

IND_IC = {"restaurant.html": "utensils-crossed", "koumuten.html": "hammer",
          "salon.html": "scissors", "shigyo.html": "scale"}

INDUSTRIES = [
    ("restaurant.html", "飲食店", "メニューと写真と予約導線。食べログの掲載費の見直しまで。"),
    ("koumuten.html", "工務店・建設", "施工事例が増えていく設計。問い合わせフォームが主役。"),
    ("salon.html", "美容室・サロン", "全メニューの料金表と予約導線。掲載費の棚卸しから。"),
    ("shigyo.html", "士業・専門事務所", "料金を明示して、人柄が伝わること。電話を最上部に。"),
]

PAGES = {}   # filename -> dict(title, desc, body, h1)

# title・フッター用の表記。一文字の屋号なので読みを括弧で添える
BRAND_T = C.BRAND + (f"（{C.BRAND_READING}）" if getattr(C, "BRAND_READING", "") else "")


def _verify_pass():
    """verify-report.json の PASS 件数。測っていない数字は書かない、を守るため実測から取る。"""
    try:
        return json.loads((ROOT / "verify-report.json").read_text(encoding="utf-8"))["pass"]
    except Exception:
        return "—"


VERIFY_PASS = _verify_pass()


# ══════════════════════════════════════════════ helpers
def e(s):
    return html.escape(str(s), quote=False)


def yen(n):
    return f"{n:,}円"


def structured_data():
    """LocalBusiness の最も具体的なサブタイプを使う。
       Google公式が推奨するプロパティを、載せるべき情報のチェックリストとして使っている。"""
    d = {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "name": C.BRAND,
        "description": f"小規模事業者向けのホームページ制作と運用。全国対応。"
                       f"変更は何回でも無料、ソースコードを納品、掲載費の見直しまで。",
        "url": f"https://{C.DOMAIN}/",
        "telephone": C.TEL,
        "priceRange": f"{P.BUILD[0]['price']:,}〜{P.BUILD[-1]['price']:,}円",
        "address": {
            "@type": "PostalAddress",
            "addressCountry": "JP",
            "addressRegion": C.ADDRESS_REGION,
            "addressLocality": C.ADDRESS_CITY,
            "streetAddress": C.ADDRESS_STREET,
            "postalCode": C.POSTAL_CODE,
        },
        "areaServed": {"@type": "Country", "name": "日本"},
        "openingHoursSpecification": [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "09:00", "closes": "18:00",
        }],
        "knowsLanguage": "ja",
    }
    return json.dumps(d, ensure_ascii=False, indent=2)


CUR = ' aria-current="page"'


def shell(fname, page):
    # C01 CompactHeader：ロゴ、階層入口、主要CTA。階層入口は主要4本に絞る
    nav = "".join(
        '<li><a href="%s"%s>%s%s</a></li>'
        % (u, CUR if u == fname else "", ic(NAV_IC[u], "ic-sm"), e(t))
        for u, t in NAV_MAIN)

    # C02 NavigationPanel：狭い画面は details で開閉する（JavaScript を使わない）
    menu_items = "".join(
        '<li><a href="%s"%s>%s</a></li>' % (u, CUR if u == fname else "", e(t))
        for u, t in NAV)
    menu_inds = "".join(f'<li><a href="{u}">{e(n)}</a></li>' for u, n, _ in INDUSTRIES)

    draft = (f'<div class="draft">{ic("triangle-alert","ic-sm")}'
             '<span>準備中の見本です。電話番号・所在地・ドメインは仮の値です。</span></div>'
             if C.PLACEHOLDER else "")

    line_btn = (f'<a href="{C.LINE_URL}">{ic("message-circle")}LINEで相談</a>' if C.LINE_URL else
                f'<a href="contact.html">{ic("message-circle")}相談する</a>')

    ftr_nav = "".join(f'<li><a href="{u}">{e(t)}</a></li>' for u, t in NAV)
    ftr_ind = "".join(f'<li><a href="{u}">{e(n)}</a></li>' for u, n, _ in INDUSTRIES)
    ftr_leg = "".join(f'<li><a href="{u}">{ic(NAV_IC[u], "ic-sm")}{e(t)}</a></li>'
                      for u, t in NAV_LEGAL)

    body = page["body"]
    body = body.replace('<span class="yes">', '<span class="yes">' + ic("circle-check", "ic-sm"))
    body = body.replace('<span class="no">', '<span class="no">' + ic("circle-x", "ic-sm"))
    body = re.sub(r'<ul class="plain">(.*?)</ul>', _plain, body, flags=re.S)
    page = dict(page, body=body)

    # 一文字の屋号は読みが割れるので、ロゴに読みを添える
    reading = getattr(C, "BRAND_READING", "")
    one = " one" if len(C.BRAND) <= 2 else ""
    mark = (f'<span class="n">{e(C.BRAND)}</span>'
            + (f'<span class="rd">{e(reading)}</span>' if reading else ""))

    tel_block = (f'<a class="tel" href="tel:{C.TEL_LINK}">{ic("phone")}'
                 f'<span class="t"><span class="lbl">タップで発信</span>'
                 f'<span class="num">{e(C.TEL)}</span></span></a>')

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(page['title'])}</title>
<meta name="description" content="{e(page['desc'])}">
<link rel="canonical" href="https://{C.DOMAIN}/{fname}">
<meta property="og:title" content="{e(page['title'])}">
<meta property="og:description" content="{e(page['desc'])}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="{e(BRAND_T)}">
<meta property="og:url" content="https://{C.DOMAIN}/{fname}">
<meta property="og:image" content="https://{C.DOMAIN}/og/{fname.replace('.html', '')}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B0B0D">
<link rel="icon" href="og/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="og/apple-touch-icon.png">
<link rel="stylesheet" href="theme.css">
<script type="application/ld+json">
{structured_data()}
</script>
</head>
<body>
<div class="nah-app" data-profile="{C.PROFILE}">
<a class="skip" href="#main">本文へ移動</a>
{draft}
<header class="hdr">
  <div class="hdr-in">
    <a class="logo{one}" href="index.html">{mark}<span class="s">ホームページ制作と運用｜全国対応</span><span class="s2">ホームページ制作</span></a>
    <nav class="nav" aria-label="主なご案内"><ul>{nav}</ul></nav>
    <span class="tel-hours"><span>お電話でのご相談<br>{e(C.TEL_HOURS)}</span></span>
    {tel_block}
    <details class="menu">
      <summary aria-label="サイト内のご案内を開く"><span>メニュー</span></summary>
      <div class="menu-panel">
        <p class="hd">ご案内</p>
        <ul>{menu_items}</ul>
        <p class="hd">業種別のご案内</p>
        <ul>{menu_inds}</ul>
      </div>
    </details>
  </div>
</header>
<main id="main">
{page['body']}
</main>
<footer class="ftr">
  <div class="wrap">
    <div class="ftr-g">
      <div>
        <h4>{e(BRAND_T)}</h4>
        <p>飲食店・工務店・美容室・士業のホームページを作って、運用まで一緒にやります。<br>
           {e(C.SERVICE_NOTE)}</p>
        <p>{tel_block}</p>
        <p class="meta"><span class="mk">受付</span><span>{e(C.TEL_HOURS)}</span></p>
        <p class="meta"><span class="mk">所在地</span><span>〒{e(C.POSTAL_CODE)} {e(C.ADDRESS_REGION)}{e(C.ADDRESS_CITY)}{e(C.ADDRESS_STREET)}</span></p>
        <p class="meta"><span class="mk">メール</span><a href="mailto:{C.EMAIL}">{e(C.EMAIL)}</a></p>
      </div>
      <div><h4>ご案内</h4><ul>{ftr_nav}</ul></div>
      <div><h4>業種別のご案内</h4><ul>{ftr_ind}</ul></div>
    </div>
    <ul class="ftr-legal">{ftr_leg}</ul>
    <p class="fine">
      掲載している他社サービスの料金は各社が公開している情報です（2026年9月時点）。
      補助金の要件・締切は変更されることがあります。金額はすべて税別表記です。
      補助金は採択された場合の金額で、採択を保証するものではありません。<br>
      &copy; {e(C.LEGAL_NAME)}
    </p>
  </div>
</footer>
<div class="fixbar">
  <a href="tel:{C.TEL_LINK}">{ic("phone")}電話する</a>
  {line_btn}
</div>
</div>
</body>
</html>
"""


def sec(body, *, alt=False, tint=False, dark=False, wide=False,
        eyebrow=None, h=None, lede=None, tag="section", key=None):
    """key にページ名を渡すと、そのページの目印アイコンが章ラベルに付く。
       ナビ・章見出し・カードで同じ字を繰り返すので、読まずに行き先が分かる。
       道しるべなので、この6ページ以外には付けない。"""
    cls = "dark" if dark else ("tint" if (tint or alt) else "")
    w = "wrap-w" if wide else "wrap"
    head = ""
    if eyebrow or h or lede:
        head = '<div class="sh">'
        if eyebrow:
            mk = ic(NAV_IC[key], "ic-sm") if key else ""
            head += f'<span class="lab">{mk}{e(eyebrow)}</span>'
        if h:
            head += f"<h2>{h}</h2>"
        if lede:
            head += f'<p class="lede">{lede}</p>'
        head += "</div>"
    return f'<{tag} class="{cls}"><div class="{w}">{head}{body}</div></{tag}>'


NCLS = ' class="n"'


def _bare(s):
    """列見出しから飾りを落として、スマホで各セルの頭に出す短いラベルにする"""
    return re.sub(r"<[^>]+>", "", str(s)).lstrip("#").strip()


def table(headers, rows, *, caption=None, foot=None, minw=None):
    # 見出しが全部空の表（項目と内容だけの表記欄）は、見出し行そのものを出さない。
    # 空の帯が1本入るだけで「何かが抜けている」ように見えるため。
    head = "".join('<th scope="col"%s>%s</th>' % (NCLS if h.startswith("#") else "", h.lstrip("#"))
                   for h in headers)
    th = f"<thead><tr>{head}</tr></thead>" if any(h.strip() for h in headers) else ""
    trs = []
    for r in rows:
        if isinstance(r, str):
            trs.append(f'<tr><td class="grp" colspan="{len(headers)}">{r}</td></tr>')
            continue
        tds = []
        for i, c in enumerate(r):
            n = NCLS if headers[i].startswith("#") else ""
            # data-h は、狭い画面で行を縦に開いたときに各セルの頭へ出す列名。
            # 表を横に引かせずに済ませるための情報で、広い画面では使われない。
            lab = _bare(headers[i])
            dh = f' data-h="{e(lab)}"' if lab else ""
            tds.append('<th scope="row">%s</th>' % c if i == 0 and not n
                       else '<td%s%s>%s</td>' % (n, dh, c))
        trs.append("<tr>%s</tr>" % "".join(tds))
    style = f' style="min-width:{minw}px"' if minw else ""
    notes = "".join(f'<p class="tbl-note">{x}</p>' for x in (foot, caption) if x)

    # 2〜3列で、1列目が行見出しの表は、狭い画面では横に引かず1行ずつ縦に開く。
    # 4列以上は縦に開くと1行が長くなりすぎるので、横スクロール＋見出し固定のまま。
    stack = ""
    if 2 <= len(headers) <= 3 and not headers[0].startswith("#"):
        stack = " stack"
    hint = "" if stack else '<p class="tbl-hint" aria-hidden="true">指でヨコに動かせます</p>'
    return (f'<div class="tblwrap{stack}"><div class="tbl"><table{style}>{th}'
            f"<tbody>{''.join(trs)}</tbody></table></div>"
            f"{hint}{notes}</div>")


def calc(title, rows, ttl_icon="calculator"):
    """追える計算。(項目, 金額, cls, 補足, アイコン)"""
    out = [f'<div class="calc"><div class="ttl">{title}</div>']
    for r in rows:
        k, v = r[0], r[1]
        cls = r[2] if len(r) > 2 else ""
        sub = f"<em>{r[3]}</em>" if len(r) > 3 and r[3] else ""
        out.append(f'<div class="r {cls}"><span class="k"><span>{k}{sub}</span></span>'
                   f'<span class="v tnum">{v}</span></div>')
    return "".join(out) + "</div>"


def vs(rows, maxv):
    """比較バー。rows = (アイコン, 名前, 補足, 金額, ours?)"""
    out = ['<div class="vs">']
    for icon, name, sub, amount, ours in rows:
        w = max(4, round(amount / maxv * 100))
        out.append(
            f'<div class="row{" ours" if ours else ""}">'
            f'<span class="nm"><span>{name}<em>　{sub}</em></span></span>'
            f'<span class="amtv">{amount:,}円</span>'
            f'<span class="bar"><i style="width:{w}%"></i></span></div>')
    return "".join(out) + "</div>"


PLAN_IC = {"basic": "zap", "standard": "target", "pro": "sparkles"}


def entry_block(full=False):
    """入口の1ページ商品。3プランの上に置く。
       月額制の『1ページ 月◯◯円』と同じ土俵に、買い切りを並べるための枠。"""
    sg = P.SINGLE
    sub = P.SUBS_MARKET[0]
    items = sg["includes"] if full else sg["includes"][:4]
    more = ("" if full else
            f'<a class="more" href="price.html">ほか{len(sg["includes"]) - 4}項目</a>')
    outs = ("" if not full else
            '<p class="dim" style="margin:-6px 0 16px">含まれないもの：'
            + "／".join(e(x) for x in sg["not_includes"]) + "</p>")
    return f"""
<div class="entry">
  <div>
    <span class="lab">{ic("key", "ic-sm")}まず1枚から</span>
    <div class="pn">{e(sg['name'])}　{sg['pages']}ページ</div>
    <span class="amt tnum">{sg['price']:,}<span class="u">円</span></span>
    <span class="sub2">買い切り・税別／約{sg['weeks']}週間でお渡し<br>
      運用をつける場合は月{P.run('run_light')['price']:,}円から（いつでもやめられます）</span>
  </div>
  <div>
    <p style="margin-bottom:12px">{e(sg['lede'])}</p>
    <ul class="plain">{"".join(f"<li>{e(i)}</li>" for i in items)}</ul>
    {outs}{more}
    <div class="btns">
      <a class="btn btn-2" href="contact.html">1ページで相談する</a>
      <a class="btn btn-2" href="owned.html">なぜ買い切りなのか</a>
    </div>
  </div>
</div>
<p class="fine-note">月額制の1ページは月{sub['monthly']:,}円。
  {P.COMPARE_MONTHS}か月で{P.subs_total(sub):,}円になり、
  <strong>{P.SUBS_TRANSFER_MONTHS}か月未満でやめるとサイトは非公開</strong>になります
  （{e(P.SUBS_SOURCE)}）。</p>"""


def plans_block(with_switch=True, feat=6):
    """プランは3枚並列にしない。真ん中を大きくして、選ぶ理由を書く。
       支払い方の切り替えは JavaScript を使わず CSS だけで行う。"""
    cards = []
    for p in P.BUILD:
        k = p["key"]
        ins = P.INSTALLMENT[k]
        pick = p.get("recommended")
        run = P.run({"basic": "run_basic", "standard": "run_standard",
                     "pro": "run_growth"}[k])
        monthly = ins["monthly"] + run["price"]
        feats = "".join(f"<li>{e(i)}</li>" for i in p["includes"][:feat])
        more = ("" if feat >= len(p["includes"])
                else f'<a class="more" href="price.html">ほか{len(p["includes"]) - feat}項目</a>')
        cards.append(f"""
<div class="plan{' pick' if pick else ''}">
  {'<span class="tag">迷ったらこれです</span>' if pick else ''}
  <div class="pn">{e(p['name'])}</div>
  <div class="pmeta">{p['pages']}ページ・約{p['weeks']}週間でお渡し</div>
  <div class="pv">
    <span class="v-m">
      <span class="amt tnum">{monthly:,}<span class="u">円／月</span></span>
      <span class="sub2">初回 {ins['initial']:,}円 ＋ 毎月 {ins['monthly']:,}円×{P.INSTALLMENT_COUNT}回
        ＋ 運用 {run['price']:,}円／月</span>
    </span>
    <span class="v-b">
      <span class="amt tnum">{p['price']:,}<span class="u">円</span></span>
      <span class="sub2">一度だけ。このあと運用 {run['price']:,}円／月</span>
    </span>
  </div>
  <div class="why">{e(p['lede'])}</div>
  <ul>{feats}</ul>
  {more}
  <div class="flex"></div>
  <a class="btn {'btn-1' if pick else 'btn-2'}" href="contact.html">このプランで相談する</a>
</div>""")
    body = f'<div class="cq"><div class="plans">{"".join(cards)}</div></div>'
    if not with_switch:
        return body
    return f"""
<div class="switcher">
  <div class="seg" role="group" aria-label="お支払い方法の表示切り替え">
    <input type="radio" name="pay" id="pm" checked><label for="pm">毎月払う</label>
    <input type="radio" name="pay" id="pb"><label for="pb">まとめて払う</label></div>
  <p class="segnote"><span>
    <span class="n-m">制作費{P.INSTALLMENT_COUNT}回＋運用費の合計です。手数料0円なので総額は同じ。</span>
    <span class="n-b">制作費を一度で払う場合。このあと運用費が毎月かかります。</span></span>
  </p>
  {body}
</div>"""


ALERT_IC = {"": "info", "good": "circle-check", "warn": "triangle-alert", "bad": "circle-x"}


def note(h, body, kind=""):
    """アイコンは状態を示すとき（warn / bad）だけ。ふつうの補足には付けない（原則E）"""
    k = f" {kind}" if kind else ""
    icon = ic(ALERT_IC[kind]) if kind in ("warn", "bad") else ""
    return (f'<div class="alert{k}">{icon}'
            f'<div class="bd"><span class="h">{h}</span>{body}</div></div>')


def acc(summary, body, icon="info"):
    """詳しい説明は畳んでおく。details なので JavaScript は不要。"""
    return (f'<details class="acc"><summary><span>{summary}</span>'
            f'</summary><div class="bd">{body}</div></details>')


def cards(items, cls="g3"):
    """アイコン＋見出し＋1行。文章を減らすための主力部品。"""
    out = []
    for it in items:
        icon, title, desc = it[0], it[1], it[2]
        link = it[3] if len(it) > 3 else None
        tone = it[4] if len(it) > 4 else "p"
        a = (f'<a class="more" href="{link[1]}">{link[0]}</a>' if link else "")
        mk = ic(NAV_IC[link[1]], "ic-sm") if link and link[1] in NAV_IC else ""
        out.append(f'<div class="card"><h3>{mk}{title}</h3>'
                   f'<p class="meta">{desc}</p>{a}</div>')
    return f'<div class="cards"><div class="g {cls}">{"".join(out)}</div></div>'


def flow(items):
    """手順の縦軸。(見出し, 補足, だれが, 目安, 強調するか)
       表にすると4列になり、スマホでは横に引かないと右2列が見えない。
       手順は時間の並びなので、縦に積んだほうが形が意味に合っている。"""
    out = []
    for i, it in enumerate(items, 1):
        title, desc, who, when = it[0], it[1], it[2], it[3]
        hi = " acc-step" if len(it) > 4 and it[4] else ""
        tags = (f'<span>{ic("users", "ic-sm")}{e(who)}</span>'
                f'<span>{ic("clock", "ic-sm")}{e(when)}</span>')
        out.append(f'<li class="fl{hi}"><span class="num">{i}</span>'
                   f'<b>{title}</b><p class="d">{desc}</p>'
                   f'<p class="tags">{tags}</p></li>')
    return f'<ol class="flow">{"".join(out)}</ol>'


def stats(items):
    out = "".join(
        f'<div class="stat">{ic(icon, "ic-sm")}'
        f'<div class="v tnum">{v}{u}</div><div class="k">{lab}</div></div>'
        for icon, v, u, lab in items)
    return f'<div class="stats">{out}</div>'


def ensure_h1(body):
    """各ページに h1 をちょうど1つ置く。
       ヒーローが無いページは、最初のセクション見出し(h2)を h1 に昇格させる。
       この不変条件は verify.py が機械的に検査する。"""
    if "<h1" in body:
        return body
    return body.replace("<h2>", "<h1>", 1).replace("</h2>", "</h1>", 1)


def cta(primary="まず話を聞いてみる", where="contact.html"):
    return (f'<div class="btns">'
            f'<a class="btn btn-1" href="tel:{C.TEL_LINK}">{ic("phone")}電話する　{e(C.TEL)}</a>'
            f'<a class="btn btn-2" href="{where}">{e(primary)}</a></div>')


# ══════════════════════════════════════════════ トップ
def page_index():
    sd = P.subsidy_calc()
    bk = {p["key"]: p for p in P.BUILD}
    m_std = P.monthly_all_in("standard", "run_standard")
    m_basic = P.monthly_all_in("basic", "run_basic")
    tabelog_basic = 27_500
    spot = P.MARKET_SPOT

    # ── ヒーロー：主張の1番は「借地か、所有か」。金額はその次に置く。
    #    喩えだけで終わると信じてもらえないので、価格面の1行目に名義の話を入れてある。
    hero = f"""
<section class="hero"><div class="wrap">
  <p class="kick">全国の飲食店・工務店・美容室・士業の方へ</p>
  <h1>そのホームページ、<br>借りた土地に建っていませんか。</h1>
  <p class="sub">いまのホームページは、土地でいえば<strong>借地権</strong>。
     地代を払うあいだだけ建っていて、やめた日に更地にして返します。<br>
     紬がつくるのは、<strong>所有権を持てる</strong>ホームページです。</p>
  <div class="pricebox">
    <span class="amtwrap">
      <span class="pre">1ページから・買い切り</span>
      <span class="amt tnum">{P.SINGLE['price']:,}<span class="u">円</span></span>
    </span>
    <ul class="alt">
      <li><b>払った日から、ドメインもソースコードもお客様の名義</b>です</li>
      <li>運用は月{P.run('run_light')['price']:,}円から。<b>つけなくても、サイトは動き続けます</b></li>
      <li>9ページの本格的な構成は{bk['standard']['price']:,}円（分割なら月{m_std:,}円）</li>
    </ul>
  </div>
  <div class="btns">
    <a class="btn btn-1" href="tel:{C.TEL_LINK}">{ic("phone")}電話する　{e(C.TEL)}</a>
    <a class="btn btn-2" href="owned.html">借地と所有のちがいを見る</a>
  </div>
</div></section>"""

    # ── 主張の中心。ここを読まずに帰る人がいないよう、金額の話より前に置く
    owned = sec(f"""
<p class="lede">借地は、土地を借りて<strong>自分のお金で家を建てる</strong>仕組みです。
   月額制のホームページで起きているのは、これと同じことです。
   <strong>建てるものは同じで、違うのは土地の名義だけ</strong>です。</p>
{D.land_vs_own()}
{cards([
    ("map-pin", "① 住所 ── ドメイン",
     "初日からお客様の名義で取得します。登録簿でお名前を確認できます。",
     ("名義のお約束", "terms.html")),
    ("code-xml", "② 建物 ── ソースコード",
     "一式をお渡しします。他社がそのまま引き継げる状態にします。",
     ("納品の中身", "source.html")),
    ("globe", "③ 地盤 ── 置き場所",
     "実行時のプログラムが0バイトなので、どのサーバーにも置けます。",
     ("仕様を見る", "spec.html")),
    ("camera", "④ 家具 ── 写真と原稿",
     "撮影した元データをお渡しします。チラシにもSNSにも使えます。",
     ("権利の扱い", "terms.html")),
], cls="g2")}
{note("「所有」を、気分の話にしません",
      "<p>上の4つは、どれも<strong>その場で確かめられる形</strong>にしてあります。"
      "名義は登録簿で、納品物は契約書で、置き場所は仕様で確認できます。</p>")}
<div class="btns"><a class="btn btn-2" href="owned.html">
  借地と所有のちがいを、全部見る</a></div>""",
        tint=True, key="owned.html", eyebrow="いちばんお伝えしたいこと",
        h="借地権のホームページか、所有権のホームページか")

    # ── アンカー：いま払っているものと比べる
    anchor = sec(f"""
<p class="lede">地代がいくらか、という話です。単体では高いか安いか判断できません。
   <strong>いま出ているお金と比べます。</strong></p>
{vs([
    ("receipt", "食べログ プレミアム5", "掲載料のみ＋手数料", 55_000, False),
    ("receipt", "食べログ ベーシック", "掲載料のみ＋手数料", 27_500, False),
    ("shield-check", "当方 スタンダード", "制作費＋運用費。サイトはお客様のもの", m_std, True),
    ("receipt", "食べログ ライト", "掲載料のみ", 11_000, False),
], 55_000)}
{D.rent_vs_own(tabelog_basic, P.PORTAL_FEE_DINNER, P.run("run_standard")["price"])}
{note("手数料は、常連さんの予約にもかかります",
      f"<p>ディナー{P.PORTAL_FEE_DINNER}円・ランチ{P.PORTAL_FEE_LUNCH}円は"
      "<strong>新規と常連を区別しません。</strong></p>", "good")}
<div class="btns"><a class="btn btn-2" href="cost-cut.html">
  掲載費の見直しについて</a></div>
<p class="dim fine-note">
  食べログの金額は同社の公開料金（税込）。当方は税別です。</p>""",
        key="cost-cut.html", eyebrow="では、地代はいくらですか",
        h="借りた場所に月27,500円、自分の場所に月28,000円")

    # ── 痛み：ちりも積もる
    total_spot = 3_000 + 5_000 * 3 + 3_000 + 3_000 + 3_000
    pain = sec(f"""
<p class="lede">文章の修正は1箇所3,000円、画像の差し替えは5,000円が相場です。1年分を積むと。</p>
{calc("ある1年間の、よくあるご依頼", [
    ("メニューの値段を変更", "3,000円", "small", "", "pen-line"),
    ("料理の写真を3枚差し替え", "15,000円", "small", "", "image"),
    ("臨時休業のお知らせを出す", "3,000円", "small", "", "calendar-off"),
    ("スタッフを1人追加", "3,000円", "small", "", "user-plus"),
    ("年末年始の営業時間を変更", "3,000円", "small", "", "clock"),
    ("1年間の合計", f"{total_spot:,}円", "sum", "", "receipt"),
    ("当方の場合", "0円", "net", "運用の月額に入っています", "repeat-2"),
], ttl_icon="receipt")}
{note("お金より、毎回気にすることをやめていただきたい",
      "<p>見積もりを待つほうが実際には重く、その日に直せないサイトは放置されます。</p>", "good")}
<div class="btns"><a class="btn btn-2" href="unlimited.html">
  含まれる範囲を全部見る</a></div>""",
        key="unlimited.html", eyebrow="よくあるお金の話", h="「1文字直すのに5,000円」をやめます")

    # ── 3つの約束
    three = sec(cards([
        ("key", "サイトはお客様のものです",
         "ドメインもソースコードも写真の元データも、初日からお客様の名義でお渡しします。",
         ("借地と所有のちがい", "owned.html")),
        ("repeat-2", "変更は何回でも無料",
         "値段も写真も休業のお知らせも、回数の上限なし。運用の月額に入っています。",
         ("含まれる範囲を見る", "unlimited.html")),
        ("trending-down", "いまの掲載費から見直す",
         "食べログは無料プランに戻してもネット予約が使えます。まず請求書を拝見します。",
         ("進め方を見る", "cost-cut.html")),
    ]), dark=True, eyebrow="お約束は3つ", h="他社と違うのはここです")
    _old_three = f"""
<ol class="steps">
  <li><b>変更は何回でも、追加料金なし</b>
    <div class="d">値段の変更、写真の差し替え、臨時休業のお知らせ、スタッフの入れ替え、施工事例の追加。
      <strong>回数の上限を設けていません。</strong>そのぶんを運用の月額に含めています。
      含まれるものと別途になるものは、<a href="unlimited.html" style="color:#fff">全部公開しています</a>。</div></li>
  <li><b>中身のプログラムごとお渡しします</b>
    <div class="d">ソースコード一式を、GitHubという保管場所にご招待してお渡しします。
      アカウントの作り方からお手伝いします。<strong>使わなくても構いません。</strong>
      当方と何かあったときに、<strong>他の会社がそのまま引き継げる</strong>という意味です。
      <a href="source.html" style="color:#fff">なぜお渡しするのか</a>。</div></li>
  <li><b>新しい予算をつくる前に、いまの費用を見ます</b>
    <div class="d">掲載料・手数料・広告費を一緒に棚卸しします。
      食べログは<strong>無料プランに戻してもネット予約が使えます</strong>（固定費0円・手数料の単価は同じ）。
      ただし<strong>準備なしにやめると売上はゼロに近づく</strong>ので、3〜6か月かけて移します。
      <a href="cost-cut.html" style="color:#fff">進め方</a>。</div></li>
</ol>"""  # 旧版（残さない）

    # ── プラン
    plans = sec(f"""
<p class="lede"><strong>1ページから始められます。</strong>
   効いたら足す、で構いません。払ったぶんは差額に充てます。</p>
{entry_block()}
<h3 style="margin:44px 0 18px">最初から一式で作る場合</h3>
{plans_block(feat=3)}
<p class="dim fine-note">すべて税別。
   <a href="price.html">オプションと、標準で含まれるものの一覧</a></p>""",
        key="price.html", eyebrow="料金", h="1ページ39,800円から、9ページ398,000円まで")

    # ── 値段の中身（追える計算）
    inside = sec(f"""
<p class="lede">高いか安いかは、中身が分からないと判断できません。</p>
{calc("スタンダード 9ページの中身", [
    ("撮影・原稿・解説記事・ドメイン・Googleマップ・ソース納品", "", "small",
     "単品で頼むと、撮影55,000円＋原稿148,500円＋記事99,000円"),
    ("単品で積んだ場合", "600,000円前後", "sum"),
    ("スタンダードの価格", f"{bk['standard']['price']:,}円", "net"),
])}
{note("まとめてやるから安いだけで、作業は減らしていません",
      "<p>効果の根拠がないものは最初から入れていません。"
      "<a href='price.html'>内訳の全部</a>／<a href='spec.html'>売らないと決めているもの</a></p>")}""",
        tint=True, key="price.html", eyebrow="値段の中身", h="この金額に何が入っているか")

    # ── 月額制との総額比較。相手の土俵（月いくら）から、こちらの土俵（総額と所有）へ移す
    cmp_rows = P.compare_rows()
    one = cmp_rows[0]
    after = sec(f"""
<p class="lede">月額制は、月々だけ見ると安く見えます。
   <strong>{P.COMPARE_MONTHS}か月の総額と、サイトがお客様のものになる時点</strong>で比べてください。</p>
{D.ownership_clock(one['sub_monthly'], one['sub_total'], one['our_price'], one['our_run'],
                  P.COMPARE_MONTHS)}
{calc(f"1ページを{P.COMPARE_MONTHS}か月使ったとき", [
    (f"月額制（月{one['sub_monthly']:,}円＋初期{P.SUBS_MARKET[0]['init']:,}円）",
     f"{one['sub_total']:,}円", "small", f"{P.SUBS_TRANSFER_MONTHS}か月未満でやめると非公開"),
    (f"{e(C.BRAND)} シングル（買い切り）", f"{P.SINGLE['price']:,}円", "sum",
     "この日からお客様のもの"),
    ("差", f"{one['sub_total'] - P.SINGLE['price']:,}円", "net",
     f"月額制の約{P.single_vs_subs_months():.0f}か月分で、ずっと自分のものになります"),
], ttl_icon="calculator")}
{table(["同じくらいのページ数で", "月額制（公開料金）", f"{e(C.BRAND)}"], [
    [f"{r['sub_pages']}ページ前後",
     f"月{r['sub_monthly']:,}円 × {P.COMPARE_MONTHS}か月<br>"
     f"<strong>{r['sub_total']:,}円</strong><br>"
     f"<span class='dim'>{P.SUBS_TRANSFER_MONTHS}か月未満でやめるとサイトは非公開</span>",
     f"買い切り{r['our_price']:,}円 ＋ 運用 月{r['our_run']:,}円<br>"
     f"<strong>{r['our_total']:,}円</strong><br>"
     f"<span class='dim'>初日からお客様のもの。運用はいつでもやめられます</span>"]
    for r in cmp_rows
], foot=f"{e(P.SUBS_SOURCE)}。金額は税別です。"
   f"<strong>{cmp_rows[2]['sub_pages']}ページ前後ではこちらのほうが"
   f"{cmp_rows[2]['diff']:,}円高くなります。</strong>その差の中身は下に書きました。")}
{note(f"高いほうの行を消していません",
      f"<p>{cmp_rows[2]['sub_pages']}ページ前後だと、{P.COMPARE_MONTHS}か月で"
      f"<strong>{cmp_rows[2]['diff']:,}円（月あたり{cmp_rows[2]['diff']//P.COMPARE_MONTHS:,}円）</strong>"
      "こちらが高くなります。差は出張撮影・取材による原稿・修正の回数制限なし・"
      "Googleマップの運用です。</p>"
      f"<p>月額制の制作は<strong>お客様がフォームに素材を入力する</strong>ところから始まります。"
      f"撮影を単品で頼むと{P.OPTIONS[1][1]:,}円、原稿の取材は別料金です。"
      "そこが要らない方には、月額制のほうが合っています。</p>", "good")}""",
        dark=True, key="price.html", eyebrow="月額制と比べる",
        h="月額を止めた日に、何が残りますか")

    # ── 補助金
    subsidy = sec(f"""
<p class="lede">{e(P.SUBSIDY['name'])}を使うと、<strong>ご負担は{yen(sd['net'])}</strong>になります。</p>
{D.subsidy_bar(sd['total'], sd['web'], sd['pr'], sd['grant'], sd['net'])}
{note(f"採択率は{e(P.SUBSIDY['adoption_rate'])}。半分は落ちます",
      "<p>「必ず通ります」とは申し上げません。"
      "<strong>通らなかった場合の扱いは、契約前に書面で決めます。</strong></p>"
      "<p>全額を立て替えたあとに入金される精算払いです。"
      f"締切{e(P.SUBSIDY['deadline'])}、商工会の書類は{e(P.SUBSIDY['form4_deadline'])}まで。"
      "<a href='subsidy.html'>手順と注意点</a></p>", "warn")}""",
        key="subsidy.html", eyebrow="補助金", h=f"{yen(sd['total'])}が、実質{yen(sd['net'])}になります")

    # ── 業種
    inds = sec(f"""
<p class="lede"><strong>数字が出ているものだけ作ります。</strong>効かないページは作りません。</p>
<div class="cq"><div class="inds">{"".join(
    f'<a class="ind" href="{u}"><span class="n">{ic(IND_IC[u], "ic-sm")}{e(n)}</span><span class="p">{e(dd)}</span></a>'
    for u, n, dd in INDUSTRIES)}</div></div>""", tint=True, eyebrow="業種ごとのご案内", h="何を作るかは業種で変わります")

    # ── 正直に
    honest = sec(f"""
<p class="lede">できないこと、やらないことを先に書きます。</p>
{acc("制作事例は、まだ1件目です",
     "<p>他社の事例を自分の実績のようには見せません。"
     "1件目から表示速度・マップ閲覧数・問い合わせ件数を数字のまま出します。</p>")}
{acc("ポータルを、いきなりやめる提案はしません",
     "<p>準備なしにやめると売上が落ちます。3〜6か月は必ず併走し、"
     "やめるべきでないお店には「やめないでください」と言います。</p>")}
{acc("広告も「やめましょう」とは言いません",
     "<p>止めた実測例では、予算3.45倍に対し売上は1.07倍。"
     "止めずに入札単価を下げます。</p>")}
{acc("AI検索対策（LLMO）は売りません",
     "<p>Googleが公式に「不要」と明記している施策です。</p>", "ban")}
{acc("新規のお客様が増えることは約束しません",
     "<p>美容室の市場は前年比5.9%縮んでいます。できるのは"
     "<strong>手数料の削減と再来店の導線づくり</strong>です。</p>")}""", key="spec.html", eyebrow="はじめにお伝えすること", h="盛らずに書きます")

    # ── 最後
    last = sec(f"""
<p class="lede">ご相談は無料。{e(C.RESPONSE_PROMISE)}に返信します。聞くのは3つだけです。</p>
{stats([
    ("receipt", "1", "", "いまの掲載料"),
    ("percent", "2", "", "予約1件あたりの手数料"),
    ("users", "3", "", "そこ経由の月間来店数"),
    ("calculator", "=", "", "新規1人あたりの獲得コスト"),
])}
<p style="margin-top:18px">この3つで<strong>その場で計算できます。</strong>
   多くの店主が、この数字を見るのは初めてです。</p>
<div class="btns">
  <a class="btn btn-1" href="tel:{C.TEL_LINK}">電話する　{e(C.TEL)}</a>
  <a class="btn btn-2" href="contact.html">フォームで相談する</a>
</div>""", dark=True, h="まず、いまの請求書を見せてください")

    return {
        "title": f"所有できるホームページ制作｜1ページ{P.SINGLE['price']:,}円から・買い切り｜{BRAND_T}",
        "desc": f"月額制のホームページは借りた土地に建てた家と同じです。紬は1ページ"
                f"{P.SINGLE['price']:,}円の買い切りから。払った日からドメインもソースコードも"
                "お客様の名義で、運用をやめてもサイトは残ります。全国対応。",
        "body": (hero + owned + anchor + pain + three + plans + inside
                 + after + subsidy + inds + honest + last),
    }


# ══════════════════════════════════════════════ 料金
def page_price():
    bk = {p["key"]: p for p in P.BUILD}
    m_std = P.monthly_all_in("standard", "run_standard")

    run_cards = "".join(f"""
<div class="plan{' pick' if r.get('recommended') else ''}">
  {'<span class="tag">いちばん多い選択</span>' if r.get('recommended') else ''}
  <div class="pn">{e(r['name'])}</div>
  <div class="pmeta">{e(P.RUN_TERM)}のご契約</div>
  <div class="pv"><span class="amt tnum">{r['price']:,}<span class="u">円／月</span></span></div>
  <div class="why">{e(r['lede'])}</div>
  <ul>{''.join(f'<li>{e(i)}</li>' for i in r['includes'])}</ul>
</div>""" for r in P.RUN)

    build_rows = []
    for p in P.BUILD:
        ins = P.INSTALLMENT[p["key"]]
        tot, _ = P.total_installment(p["key"])
        build_rows.append([
            f"<strong>{e(p['name'])}</strong><br><span class=\"dim\">{p['pages']}ページ・約{p['weeks']}週間</span>",
            f"{p['price']:,}", f"{ins['initial']:,}", f"{ins['monthly']:,}",
            f'{tot:,}<br><span class="yes">手数料0円</span>'])

    opts = table(["項目", "#金額", "備考"],
                 [[e(n), f"{a:,}", e(m)] for n, a, m in P.OPTIONS],
                 caption="税別。運用プランに含まれないものだけを載せています")
    free = table(["標準で含まれるもの（追加料金なし）", "他社の一般的な料金"],
                 [[f"<strong>{e(n)}</strong>", f'<span class="dim">{e(m)}</span>'] for n, m in P.FREE_ITEMS])

    rival_total = 29_800 * 24
    ours_total = (P.INSTALLMENT["standard"]["initial"]
                  + P.INSTALLMENT["standard"]["monthly"] * 24 + P.run("run_standard")["price"] * 24)

    body = (
        sec(f"""
<p class="lede">金額はすべて税別です。<strong>業種によって値段は変えません。</strong>
   変わるのはページ数と、作るページの中身です。</p>
<p><strong>1ページから始められます。</strong>あとから増やすときは差額だけで、
   最初に払ったぶんは無駄になりません。</p>
{entry_block(full=True)}
<h3 style="margin:48px 0 18px">最初から一式で作る場合</h3>
{plans_block()}""", key="price.html", eyebrow="料金",
            h=f"1ページ{P.SINGLE['price']:,}円から、<br>9ページ{bk['standard']['price']:,}円まで")

        + sec(f"""
<p class="lede">月額制のホームページは、月々だけ見ると安く見えます。
   <strong>{P.COMPARE_MONTHS}か月の総額</strong>と、
   <strong>サイトがお客様のものになる時点</strong>の2つで比べてください。</p>
{table(["同じくらいのページ数で", "月額制（公開料金）", f"{e(C.BRAND)}"], [
    [f"{r['sub_pages']}ページ前後",
     f"月{r['sub_monthly']:,}円＋初期{P.SUBS_MARKET[0]['init']:,}円<br>"
     f"<strong>{r['sub_total']:,}円</strong>",
     f"買い切り{r['our_price']:,}円＋運用月{r['our_run']:,}円<br>"
     f"<strong>{r['our_total']:,}円</strong><br>"
     + (f'<span class="yes">{-r["diff"]:,}円 安い</span>' if r["diff"] < 0
        else f'<span class="dim">{r["diff"]:,}円 高い</span>')]
    for r in P.compare_rows()
], caption=f"{e(P.SUBS_SOURCE)}。金額は税別です。"
   f"月額制は最低契約{P.SUBS_MIN_TERM}か月で、"
   f"<strong>{P.SUBS_TRANSFER_MONTHS}か月未満で解約するとサイトは非公開</strong>と明記されています。",
   foot="当方は買い切りなので、運用を途中でやめても表の左側の金額だけが減り、"
        "<strong>サイトは残ります。</strong>")}
{note("ページ数が多い側は、こちらのほうが高くなります",
      f"<p>{P.compare_rows()[2]['sub_pages']}ページ前後だと"
      f"{P.COMPARE_MONTHS}か月で{P.compare_rows()[2]['diff']:,}円"
      f"（月あたり{P.compare_rows()[2]['diff']//P.COMPARE_MONTHS:,}円）の差になります。</p>"
      f"<p>差の中身は、<strong>出張撮影（単品{P.OPTIONS[1][1]:,}円）</strong>、"
      "<strong>取材して書く原稿</strong>、<strong>修正の回数制限なし</strong>、"
      "<strong>Googleマップの運用</strong>です。"
      "月額制の制作は、お客様がフォームに素材を入力するところから始まります。"
      "写真も文章も手元にあって、更新もあまりしない、という方には月額制のほうが向いています。</p>",
      "good")}""", tint=True, eyebrow="月額制と比べる", h=f"{P.COMPARE_MONTHS}か月の総額で並べます")

        + sec(f"""
<p class="lede">「なぜこの金額なのか」が分からないと、判断のしようがありません。
   スタンダード{bk['standard']['price']:,}円の中身を、単品で頼んだ場合の金額と並べて書きます。</p>
{calc(f"スタンダード 9ページ {bk['standard']['price']:,}円（税別）の中身", [
    ("サイトの設計と9ページの制作", "—", "small", "業種ごとに作るページが決まっています"),
    ("出張撮影 半日（30カット・加工込み）", "55,000円", "small", "単品の場合。交通費は実費"),
    ("原稿の聞き取りと執筆 9ページ分", "148,500円", "small", "単品なら16,500円／ページ"),
    ("解説記事 3本", "99,000円", "small", "単品なら33,000円／本"),
    ("ドメイン取得・Googleマップ整備・速度計測・ソース納品", "—", "small", ""),
    ("単品で積んだ場合のおよその金額", "600,000円前後", "sum"),
    ("スタンダードの価格", f"{bk['standard']['price']:,}円", "net"),
])}
{note("撮影と原稿をまとめてやるから安くできるだけで、作業は減らしていません",
      "<p>逆に、効果の根拠がないものは最初から入れていません。"
      "<a href='spec.html'>売らないと決めているもの</a>も公開しています。</p>")}
{note("全国どこでもお受けします",
      "<p>打ち合わせ・原稿の聞き取り・納品後の修正は、<strong>すべてオンラインと電話で完結します。</strong>"
      "対面が必要な工程はありません。</p>"
      "<p>出張撮影だけは現地に伺うので、<strong>交通費は実費をご負担いただきます。</strong>"
      "お手持ちの写真や、すでに撮影済みの素材をお使いいただく場合は撮影を省けます"
      "（その分の減額はご相談ください）。</p>", "warn")}""",
              tint=True, eyebrow="値段の中身", h="この金額に何が入っているか")

        + sec(f"""
{table(["プラン", "#買い切り", "#分割の初回", f"#分割 月額×{P.INSTALLMENT_COUNT}回", "#分割の総額"],
       build_rows,
       caption="金額は税別。分割の総額は買い切りと同額です",
       foot="分割払いは運用プランとの同時ご契約が条件です。"
            f"{P.INSTALLMENT_COUNT}回のお支払いが終わったあとは、運用の月額だけになります。"
            "ドメイン・ホームページ・ソースコードは、最初からお客様のものです。")}
{table(["あとからページを増やすとき", "扱い"], [
    ["シングルからベーシックへ",
     f"差額のみ（{bk['basic']['price']:,}円 − {P.SINGLE['price']:,}円 ＝ "
     f"<strong>{bk['basic']['price'] - P.SINGLE['price']:,}円</strong>）"],
    ["ベーシックからスタンダードへ",
     f"差額のみ（<strong>{bk['standard']['price'] - bk['basic']['price']:,}円</strong>）"],
    ["構成にないページを1枚だけ足す", f"{P.OPTIONS[0][1]:,}円／ページ"],
], caption="最初に払った金額は、次の段の差額に充てます。払い直しにはなりません。",
   foot="この扱いは契約書にも書きます（<a href='terms.html'>ご契約とお約束</a>）。")}
{note("分割にしても、総額は1円も変わりません",
      "<p>金融機関やクレジット会社を通さず、当方とお客様の間だけで分割にするので、"
      "手数料が発生しません。だからお客様に手数料を請求する理由がありません。</p>"
      "<p>契約期間の縛りもありません。"
      "<strong>途中でまとめてお支払いいただくこともできますし、やめてもサイトは残ります。</strong></p>", "good")}""",
              eyebrow="お支払いの方法", h="買い切りでも、分割でも、総額は同じです")

        + sec(f"""
<p class="lede">作ったあとを一緒にやる部分です。<strong>ここに更新も集客も全部入れています。</strong>
   オプションの足し算にはしません。</p>
<div class="plans">{run_cards}</div>
{note("運用の中心は「口コミの鮮度を保つこと」です",
      "<p>ホームページを直すことより、Googleマップの投稿と口コミへの返信のほうが来店に効きます。"
      "調査では<strong>74%の方が直近3か月以内の口コミを重視し、"
      "42%は口コミに返信していないお店を避ける</strong>という結果が出ています。"
      "スタンダード以上では、ここを当方が代行します。</p>")}""",
              tint=True, eyebrow="運用（月額）", h="制作して放置、がいちばんもったいない")

        + sec(f"""
<p class="lede">月額制のサービスは、月々の金額だけを見ると安く見えます。
   <strong>2年経ったときに何が残るか</strong>で比べてください。</p>
{D.after_two_years(29_800, P.INSTALLMENT["standard"]["initial"],
                   P.INSTALLMENT["standard"]["monthly"] + P.run("run_standard")["price"])}
{table(["図に出ていない条件", "ある工務店向けサービス", "当方 スタンダード"], [
    ["契約期間の縛り", '<span class="no">2年（必須）</span>', '<span class="yes">なし</span>'],
    ["ソースコード", '<span class="no">お渡しなし</span>', '<span class="yes">お渡しします</span>'],
    ["修正・更新", '<span class="dim">月1回1時間／月3箇所などの上限があるのが一般的</span>',
     '<span class="yes">何回でも</span>'],
    ["一括で払った場合", '<span class="dim">649,800円。2年払い切ると'
     f'{rival_total - 649_800:,}円多く払うことになります</span>',
     f"{bk['standard']['price']:,}円（総額は分割と同じ）"],
])}
{note("解約したらサイトが消える契約は、実際にあります",
      "<p>削除か買い取りかを選ばされる、移管に手数料がかかる、"
      "36か月未満だと非公開になる。契約書に書かれているので違法ではありませんが、"
      "<strong>知らずに契約されている方が多いです。</strong></p>"
      "<p>当方は<strong>ドメインを最初からお客様の名義で取得します。</strong></p>", "bad")}""",
              dark=True, eyebrow="2年後にどうなるか", h="安い月額には、たいてい理由があります")

        + sec(free + opts, eyebrow="そのほか", h="標準で含まれるもの・追加のもの")

        + sec(f"""
{note("こういうものは売りません",
      '<ul class="plain">' + "".join(
          f"<li><strong>{e(n)}</strong><br>{e(r)}</li>" for n, r in P.NOT_SELLING) + "</ul>"
      + "<p>根拠は<a href='spec.html'>納品する仕様</a>に全部書いています。</p>", "bad")}
<div class="btns">
  <a class="btn btn-1" href="tel:{C.TEL_LINK}">電話する　{e(C.TEL)}</a>
  <a class="btn btn-2" href="contact.html">フォームで相談する</a>
</div>""", tint=True, h="売らないと決めているもの")
    )
    return {"title": f"料金｜1ページ{P.SINGLE['price']:,}円から・買い切り｜{BRAND_T}",
            "desc": f"1ページ{P.SINGLE['price']:,}円から。9ページの本格的な構成は"
                    f"{bk['standard']['price']:,}円です。月額制との{P.COMPARE_MONTHS}か月の総額も"
                    "並べて出しています。分割の手数料は0円、契約期間の縛りもありません。",
            "body": body}


# ══════════════════════════════════════════════ 変更は何回でも
def page_unlimited():
    yes = table(["何回でも無料でお受けするもの"],
                [[f"<strong>{e(x)}</strong>"] for x in P.UNLIMITED_IN])
    no = table(["別途お見積りになるもの", "内容", "#目安"],
               [[f"<strong>{e(n)}</strong>", e(d), e(p)] for n, d, p in P.UNLIMITED_OUT])
    mkt = table(["他社の一般的な料金（相場）", "#金額"],
                [[e(n), e(v)] for n, v in P.MARKET_SPOT],
                caption="制作会社が公開している一般的なスポット料金の相場")

    body = (
        sec(f"""<p class="lede">「無制限」と書いてある以上、
        <strong>どこまでが含まれてどこからが別料金なのかを、全部書いておきます。</strong>
        曖昧にしておくと、必ずあとで揉めるからです。</p>""",
            key="unlimited.html", eyebrow="変更は何回でも", h="どこまで含まれるかを、先に全部書きます")
        + sec(yes + no + note("作業時間の目安", f"<p>{e(P.UNLIMITED_NOTE)}</p>", "warn"))
        + sec(mkt + f"""
<p>相場でいうと、文章の修正が1箇所3,000円、画像の差し替えが5,000円です。
   メニューの値段を年に4回変えるお店なら、それだけで年12,000円。
   臨時休業のお知らせを月1回出すだけで年36,000円になります。</p>
{note('「無料」ではなく「月額に含まれている」とお考えください',
      '<p>タダで何でもやります、という話ではありません。'
      f'運用の月額（{P.run("run_light")["price"]:,}円から）に、通常のご依頼の分が入っています。'
      'そのかわり、<strong>「これは追加料金ですか」と毎回気にしなくてよくなります。</strong>'
      'そこがいちばんの価値だと考えています。</p>', 'good')}""",
              alt=True, h="他社だといくらかかるか")
        + sec(f"""
<ol class="steps">
  <li><b>ご依頼の窓口はひとつにします</b>
    <div class="d">電話・LINE・メールに散ると、対応漏れが起きます。
      納品時に窓口を決めて、そこに集めていただきます。急ぎのときは電話で構いません。</div></li>
  <li><b>作業した時間を記録して、毎月お知らせします</b>
    <div class="d">「今月は何を何分やったか」を運用レポートに書きます。
      <strong>測っていない「無制限」は信用できないと考えているので、数字を出します。</strong></div></li>
  <li><b>3か月の平均で大きく超えた場合だけ、上位プランをご案内します</b>
    <div class="d">その場でお断りしたり、追加請求したりはしません。
      «月4時間» を大きく超えるご利用が続く場合に、次の更新でご相談させてください。</div></li>
</ol>""".replace("«", "").replace("»", ""), h="運用のしかた")
        + sec(cta(), h="ご相談は無料です")
    )
    return {"title": f"変更は何回でも｜{BRAND_T}",
            "desc": "文章の修正、写真の差し替え、料金の変更、お知らせの投稿。"
                    "回数の上限はありません。含まれるもの・別途になるものを全部公開しています。",
            "body": body}


# ══════════════════════════════════════════════ ソースコード
def page_source():
    body = (
        sec("""<p class="lede">ホームページの中身のプログラム（ソースコード）を、
        お客様にお渡しします。<strong>使わなくても構いません。</strong>
        当方と何かあったときに、他の会社がそのまま引き継げるという意味です。</p>""",
            eyebrow="ソースコードの納品", h="作ったものは、全部お渡しします")
        + sec(f"""
{table(["お渡しするもの", "内容"], [
    ["ソースコード一式", "HTML・CSS・画像・設定ファイルのすべて"],
    ["GitHubの閲覧権限", "GitHubというプログラムの保管場所に、お客様のアカウントをご招待します"],
    ["引き継ぎの手順書", "構成・更新のしかた・公開のしかたを日本語で書いたものを同梱します"],
    ["ドメイン", "<strong>最初からお客様の名義で取得します。</strong>当方の名義にはしません"],
])}
{note('GitHubのアカウントは、作り方からお手伝いします',
      '<p>GitHubを使ったことがなくて当然です。アカウントの作成から、'
      '中の見かたまで、納品の作業の一部としてご一緒します。追加料金はいただきません。</p>'
      '<p>そのあと使わなくても問題ありません。<strong>「いつでも取り出せる状態にある」</strong>'
      'ことが目的です。</p>', 'good')}""", h="具体的に何をお渡しするか")
        + sec(f"""
<p>ホームページを他社に預けたままにしておくと、こういうことが起こります。</p>
{table(["起きたこと", "内容"], [
    ["Googleが無料サイトを止めた",
     "Googleは<strong>2024年3月に、自社が提供していた無料のホームページ機能を停止</strong>しました。"
     "同年6月10日には転送も終了し、それまでのURLは「ページが見つかりません」になりました。"
     "これは予想ではなく、実際に起きたことです。"],
    ["解約したら消える契約になっている",
     "月額制のサービスでは、解約するとホームページが非公開になる、"
     "削除か買い取りかを選ばされる、移管に手数料がかかる、といった条件が実際にあります。"
     "契約書に書かれているので違法ではありませんが、<strong>知らずに契約している方が多いです。</strong>"],
    ["ドメインが制作会社の名義になっている",
     "この場合、解約するとドメインごと使えなくなります。名刺やチラシに印刷したURLが死にます。"],
])}
{note('だから、最初からお客様のものにしておきます',
      '<p>当方がいなくなっても、事業は続きます。'
      '<strong>そのときに困らない形で納品するのが、まともな仕事だと考えています。</strong></p>')}""",
              alt=True, eyebrow="なぜお渡しするのか", h="預けたままにしておくと、こうなります")
        + sec(f"""
{table(["項目", "当方のやり方", "理由"], [
    ["権限", "<strong>閲覧（読み取り）権限でご招待します</strong>",
     "書き込み権限だと、操作を誤ってプログラムが壊れることがあります。"
     "見ること・コピーすることはできます。お客様の管理下に移すこともできます"],
    ["保護設定", "主要な部分への直接の書き換えを禁止しておきます", "事故を防ぐためです。納品時に設定します"],
    ["パスワード類", "プログラムの中には入れません（別管理にします）",
     "お客様をご招待するので、履歴に残ると取り消せなくなります"],
    ["手順書", "日本語で、構成・更新・公開の手順を書きます",
     "プログラムだけ渡されても引き継げません。<strong>ここが実質的な価値です</strong>"],
])}
{note('技術的な話が不要な方へ',
      '<p>ここは、あとで別の会社に見せたときに「ちゃんとしている」と言ってもらうための部分です。'
      'お客様が理解する必要はありません。'
      '<strong>「預けっぱなしになっていない」ということだけ覚えておいてください。</strong></p>')}""",
              eyebrow="技術的な設計", h="どう渡すか")
        + sec(cta(), h="ご相談は無料です")
    )
    return {"title": f"ソースコードの納品｜{BRAND_T}",
            "desc": "ホームページのソースコード一式をお渡しします。GitHubに閲覧権限でご招待し、"
                    "アカウントの作り方からお手伝いします。ドメインは最初からお客様の名義です。",
            "body": body}


# ══════════════════════════════════════════════ 掲載費の見直し
def page_costcut():
    tb = table(["食べログのプラン", "#月額（税込）", "#1段下げた差額", "運用スタンダードに足りるか"],
               [[e(n), f"{a:,}" if a else "0",
                 f"{P.PORTAL_TABELOG[i-1][1]-a:,}" if i > 0 else "—",
                 ('<span class="yes">足ります</span>'
                  if i > 0 and (P.PORTAL_TABELOG[i-1][1]-a) >= P.run("run_standard")["price"]
                  else '<span class="no">足りません</span>' if i > 0 else "—")]
                for i, (n, a) in enumerate([(n, a) for n, a in P.PORTAL_TABELOG])][::-1],
               caption="食べログが公開している料金（月額は税抜表記のため1.1倍して税込に換算）",
               foot=f"このほかに、ネット予約の送客手数料が"
                    f"ランチ{P.PORTAL_FEE_LUNCH}円・ディナー{P.PORTAL_FEE_DINNER}円"
                    f"（お一人あたり・税込）かかります。")

    need = P.run("run_standard")["price"] * 1000 // P.PORTAL_FEE_DINNER / 1000
    people = int(P.run("run_standard")["price"] / P.PORTAL_FEE_DINNER) + 1

    body = (
        sec(f"""<p class="lede">新しい予算をつくる前に、<strong>いま出ている費用を見ます。</strong>
        ホームページの運用費は、多くの場合ここから出せます。</p>""",
            key="cost-cut.html", eyebrow="掲載費の見直し", h="いま払っている掲載費から見直します")
        + sec(f"""
{tb}
{D.money_flow(27_500, P.run("run_standard")["price"])}
{note('いちばん効くのは「1段下げる」ではなく「無料プランに戻す」です',
      '<p>食べログのネット予約は、<strong>導入費・固定費が0円で、無料プランでも使えて、'
      '手数料の単価は有料プランと同じ</strong>です（食べログが公式に明記しています）。'
      'つまり<strong>予約の受付を失わずに、掲載料だけをゼロにできます。</strong></p>'
      '<p>優先的に上位に表示される扱いは失いますが、'
      'これは公正取引委員会が「より高額な手数料を支払えば他の飲食店よりも上位に掲載される」と'
      '報告している仕組みから降りる、という話です。</p>', 'good')}
{note('ライトプランと無料掲載のお店には、この話は使えません',
      f'<p>ライト（税込11,000円）をやめても11,000円で、運用スタンダード{P.run("run_standard")["price"]:,}円には'
      '足りません。もともと無料掲載のお店は削減のしようがありません。'
      '<strong>お店のプランを確認せずに「1段下げれば出ます」と言うのは不誠実なので、'
      '最初に必ずお伺いします。</strong></p>', 'warn')}""", h="飲食店の場合")
        + sec(f"""
<p>送客手数料のディナー{P.PORTAL_FEE_DINNER}円は、<strong>新しいお客様にも、
   常連のお客様にも同じようにかかります。</strong>
   いつも来てくださる方がネット予約するたびに{P.PORTAL_FEE_DINNER}円です。</p>
<p>運用スタンダード{P.run('run_standard')['price']:,}円は、
   <strong>ディナーのご予約を月{people}人分だけ自分のサイトに移せば出る金額</strong>です。
   毎晩4名×30日＝月120人のお店なら、送客手数料だけで月26,400円払っていることになります。</p>""",
              alt=True, eyebrow="もっと痛いところ", h="常連さんの予約にも、毎回手数料がかかっています")
        + sec(f"""
{note('ホットペッパービューティーの掲載料は公開されていません',
      '<p>正規の代理店自身が「リクルート社を含め、どこのホームページにも記載されていない」と'
      '書いています。エリア・業種・契約期間・プランで変わります。</p>'
      '<p>なので<strong>推測で金額を申し上げません。直近の請求書を見せていただくのが'
      'いちばん確実です。</strong></p>', 'warn')}
<p>確実に言えるのは2つです。</p>
<ul class="plain">
  <li><strong>ホットペッパービューティーには無料プランがありません。</strong>
      掲載を続けるかぎり、固定費を払い続けることになります。</li>
  <li><strong>美容室の市場は前年比5.9%縮んでいて、利用が減った理由の1位は
      「美容代を節約する必要が出てきた」</strong>です（リクルート自身の調査）。
      市場が縮むなかで掲載費は下がりません。</li>
</ul>""", eyebrow="美容室の場合", h="請求書を見せてください")
        + sec(f"""
<p>広告については<strong>「やめましょう」と申し上げません。</strong>
   止めた実測の例では、自然検索の流入は一時的に増えたものの続かず、
   <strong>予算は3.45倍に増えて売上は1.07倍にしかなりませんでした。</strong></p>
<p>正解は止めることではなく、入札の単価を下げることです。
   別の事例では、この方法でクリック単価を約30%下げながら、
   検索結果の上部にほぼ常に表示され続けています。
   あわせて、商圏の外への配信を止める、成約ゼロの検索語を除外する、といった整理をします。</p>""",
              alt=True, eyebrow="広告", h="止めるのではなく、単価を下げます")
        + sec(f"""
<ol class="steps">
  <li><b>3つの数字をお聞きします</b>
    <div class="d">掲載料はいくらか、手数料はいくら払っているか、
      そのサイト経由で月に何人の新しいお客様が来ているか。</div></li>
  <li><b>新しいお客様1人あたりの獲得コストを、一緒に計算します</b>
    <div class="d">多くの店主の方が、この数字をご覧になるのは初めてです。
      <strong>ここだけでも意味があります。</strong></div></li>
  <li><b>そのお客様の粗利と比べます</b>
    <div class="d">1人5,000円かけて獲得したお客様の粗利が3,000円なら、そのプランは合っていません。</div></li>
  <li><b>3〜6か月の併走計画を作ります</b>
    <div class="d"><strong>いきなり掲載をやめません。</strong>
      Googleマップと自分のサイトの導線が育つまで、両方を並行して使います。</div></li>
  <li><b>契約の更新月に合わせてプランを下げます</b>
    <div class="d">食べログは6か月または12か月ごとの自動更新、
      ホットペッパーグルメは契約の途中でプランを下げられない場合があります。
      <strong>「いますぐ安くなります」とは申し上げません。</strong></div></li>
</ol>
{note('やめるべきでないお店には、やめないでくださいと申し上げます',
      '<p>次のいずれかに当てはまる場合、掲載をやめるのは危険です。</p>'
      '<ul class="plain">'
      '<li>既存のお客様の連絡先が整理されておらず、再来店の導線がない</li>'
      '<li>再来店率が業界平均（3割前後）を下回っている</li>'
      '<li>開業して間もなく、まだ知られていない</li>'
      '<li>ご予約の件数が多い（プランを下げると手数料の単価が上がるサービスがあります。'
      'あるサービスでは有料プランのディナー50円が、無料プランでは実質215円になります）</li>'
      '</ul>'
      '<p><strong>この場合は「まだやめないでください」と申し上げます。</strong>'
      'そのほうが結果的に長くお付き合いできると考えています。</p>', 'bad')}""",
              eyebrow="進め方", h="いきなりやめません。5段階で進めます")
        + sec(cta("請求書を見てもらう"), h="まず数字を一緒に見ましょう")
    )
    return {"title": f"掲載費の見直し｜{BRAND_T}",
            "desc": "食べログ・ぐるなび・ホットペッパーの掲載費と手数料を棚卸しして、"
                    "ホームページの運用費に振り替えます。いきなりやめる提案はしません。",
            "body": body}


# ══════════════════════════════════════════════ 補助金
def page_subsidy():
    sd = P.subsidy_calc()
    rows = [[e(k), e(d), f"{a:,}"] for k, d, a in P.SUBSIDY["package"]]
    pkg = table(["科目", "内容", "#金額"], rows,
                caption="金額は税別",
                foot=f"合計 {yen(sd['total'])}。ホームページ単独では申請できないため、"
                     "チラシ・看板・撮影とまとめた「販路開拓」の形にしています。")

    body = (
        sec(f"""<p class="lede">{e(P.SUBSIDY['name'])}（{e(P.SUBSIDY['round'])}）は、
        補助率が{e(P.SUBSIDY['rate_text'])}、上限が{yen(P.SUBSIDY['cap'])}です。
        ホームページに使える分は<strong>補助金額で{yen(P.SUBSIDY['web_cap'])}まで</strong>と決まっています。</p>""",
            key="subsidy.html", eyebrow="補助金", h=f"{yen(sd['total'])}が、実質{yen(sd['net'])}になります")
        + sec(f"""{pkg}
{D.subsidy_bar(sd['total'], sd['web'], sd['pr'], sd['grant'], sd['net'])}
{note('なぜチラシや看板を一緒に組むのか',
      '<p>この補助金は<strong>ホームページ関連費だけでは申請できません。</strong>'
      '必ずほかの経費と一緒に申請する必要があります。'
      'ですので、ホームページと同じ写真・同じ文章を使って、'
      'チラシ・ショップカード・看板・メニュー表までまとめて作ります。'
      '<strong>撮影も原稿も一度で済むので、別々に頼むより安くなります。</strong></p>')}""",
              h="内訳")
        + sec(f"""
{note('採択率は約半分です',
      f"<p>直前の回（第19回）の採択率は<strong>{e(P.SUBSIDY['adoption_rate'])}</strong>"
      f"（{e(P.SUBSIDY['adoption_detail'])}）。"
      '「必ず通ります」「実質無料です」とは申し上げません。</p>'
      '<p><strong>通らなかった場合の取り扱いを、契約書に先に書きます。</strong>'
      'ベーシックプランに縮小するか、白紙に戻すか。'
      'どちらかをご契約の前に決めておきます。口約束にはしません。</p>', 'bad')}
{note('補助金はあとから入ってきます',
      '<p>補助金は精算払いです。<strong>お客様がいったん全額を立て替えて、'
      '報告したあとに入金されます。</strong>'
      'この点を最初にお伝えしておかないと、資金の段取りで困ることになります。</p>', 'warn')}
{note('申請書はお客様ご自身に書いていただきます',
      '<p>2026年1月に行政書士法が改正され、<strong>名目を問わず報酬を得て申請書類を作成することが'
      '明確に違反</strong>となりました。制作費に申請の代行を含めることもできません。</p>'
      '<p>ですので、計画づくりは<strong>商工会・商工会議所</strong>にお願いします。'
      '無料で支援していただけますし、申請に必要な「事業支援計画書」の発行窓口でもあります。'
      '当方がお出しするのは<strong>お見積書と、効果の根拠になる資料</strong>です。'
      'お客様がそれを自分の言葉で申請書に書く、という進め方になります。</p>')}""",
              alt=True, h="先にお伝えしておくこと")
        + sec(f"""
{D.subsidy_timeline(P.SUBSIDY['form4_deadline'], P.SUBSIDY['deadline'])}
{acc("各段階でやること",
     "<ul class='plain'>"
     "<li><b>ご相談・お見積り</b>　補助金を使うかを含めて進め方を決めます</li>"
     f"<li><b>商工会へご一緒します</b>　様式4の発行を依頼。年末は混むので11月上旬までが安全</li>"
     "<li><b>申請はお客様ご自身で</b>　当方は見積書と根拠資料をお渡しします</li>"
     "<li><b>交付決定を待つ</b>　契約書の日付も決定日より後にします</li>"
     "<li><b>着手・納品</b>　決定後に契約して着手します</li>"
     "<li><b>報告して入金</b>　書類づくりもご一緒します（代行はできません）</li>"
     "</ul>")}
{note('お見積りが50万円を超える場合は、他社のお見積りも必要です',
      '<p>1件50万円（税込）を超える発注には、2者以上のお見積りが必要という決まりがあります。'
      '<strong>これは最初にお伝えします。</strong>あとから言うと段取りが崩れるからです。</p>')}""",
              eyebrow="手順", h="交付決定の前に着手しないことが、いちばん大事です")
        + sec(f"""
<p>市町村ごとの補助金もあります。ただし<strong>「ホームページ補助金」という名前ではなく、
   「販路開拓」「産業振興」「DX推進」といった枠のなかの1メニュー</strong>になっていることが多いです。</p>
<p>しかも予算に達すると早期に終了します（ある県では9月30日締切の制度が8月28日に終了しました）。
   当方で毎週チェックして、使えそうなものがあればお知らせします。</p>""",
              alt=True, h="市町村の補助金も見ます")
        + sec(cta("補助金を使えるか聞く"), h="ご相談は無料です")
    )
    return {"title": f"補助金で実質いくらになるか｜{BRAND_T}",
            "desc": f"小規模事業者持続化補助金（{P.SUBSIDY['round']}）を使うと、"
                    f"{yen(sd['total'])}の販路開拓パッケージが実質{yen(sd['net'])}になります。"
                    f"採択率は{P.SUBSIDY['adoption_rate']}。通らなかった場合の扱いも先に決めます。",
            "body": body}


# ══════════════════════════════════════════════ 納品する仕様
SPEC_ITEMS = [
    ("電話番号を全ページの上部に、文字で置きます",
     "画像にした電話番号はGoogleが読めず、スマホでタップしても発信できません。"
     "連絡先を決める段階で重視される要素の1位は「営業時間・住所・電話がはっきり書かれていること」（32%）です。"),
    ("営業時間を、定休日・臨時休業・年末年始まで書きます",
     "同じく1位の要素です。文字で書くので検索にも反映されます。"),
    ("住所・地図・アクセス・駐車場の有無を書きます",
     "お店を探す段階で最も見られている要素が「住所・近さ」（44%）。"
     "Googleマップ経由の行動の38%が経路検索です。"),
    ("料金を必ず何らかの形で出します",
     "連絡しなかった理由の2位が「料金が不明確」（32%）で、星の評価（30%）より上です。"
     "「お見積り」でも、算出の考え方と目安の幅は出します。<strong>ただし安く見せることはしません。</strong>"),
    ("業種によって、電話とフォームのどちらを主役にするかを入れ替えます",
     "調査では士業は電話が56%・フォームが44%、美容室はフォームが92%・電話が8%と真逆でした。"
     "同じ作りを全業種に当てるのは合いません。"),
    ("対応エリアを書きます（工務店・士業は市町村ごとに）",
     "「近さ」はGoogleが公表しているマップの順位の3要因のひとつです。"),
    ("写真は明るく、実物を撮ります",
     "飲食店のサイトを見て来店をやめた理由の36%が「料理写真が良くない」。"
     "写真が選択に影響すると答えた人は87%です。"),
    ("スタッフ・代表の顔写真と人柄が伝わる紹介を入れます",
     "税理士を選ぶときに最も重視された項目の1位は「相談しやすさ・人柄・相性」（21%）でした。"),
    ("実績・事例は一覧と詳細の2段にします（工務店は最優先）",
     "注文住宅の購入者調査では、施工事例が「参考になった」58%・「決め手になった」57%で両方1位。"
     "一方、会社紹介は参考58%→決め手11%に落ちるので、そこには工数を割きません。"),
    ("お客様の声には、依頼した旨を明記します",
     "謝礼や依頼があるものは、事業者の表示だと分かるように書くことが景品表示法で必要です"
     "（2023年10月施行）。守らない制作会社が多いので、テンプレートに入れています。"),
    ("料金・費用・選び方の解説を3〜5本だけ書きます",
     "料金についての検索では、8割以上でAIの回答が表示されます。ここがAIに引用される入口です。"
     "<strong>ただし記事の量産はしません。</strong>ページ数と引用されやすさの相関はほぼゼロでした。"),
    ("スマホとパソコンで同じ内容にします。スマホ用に内容を削りません",
     "Googleが「モバイルのコンテンツを減らすと流入の減少を想定すべき」と明記しています。"),
    ("表示速度は2.5秒以内を納品条件にします",
     "スマホでこの基準を満たしているサイトは62%しかなく、最大のつまずきどころです。"
     "写真が主役のお店のサイトは、構造的にここで遅くなります。"
     "0.1秒の改善で問い合わせページへの遷移が21.6%増えたという実測があります。"),
    ("最初に表示される画像は、遅延読み込みにしません",
     "よくある設定ミスです。全部の画像に遅延読み込みをかけると、"
     "いちばん最初に見える画像の表示が逆に遅くなります。"),
    ("表示速度スコアの満点は狙いません",
     "Google自身が「SEOのために満点を狙うのは時間の使い方として最善ではない」と書いています。"
     "反応速度の指標はスマホでも77%が基準を満たしており、"
     "お店のサイトでは実質的に問題になりません。監視だけします。"),
    ("押せる部分は、指で押しやすい大きさにします",
     "国際的な指針の最低ラインは24ピクセル四方ですが、"
     "読み手が50〜60代の方であることを前提に<strong>44ピクセル四方</strong>を基準にしています。"),
    ("構造化データを、業種に合った種類で設定します",
     "Googleに事業所の情報を正しく伝える設定です。実装の手間が小さいので無料で入れています。"
     "<strong>ただしこれを「AI検索対策」として売ることはしません。</strong>"
     "Googleの公式ガイドが「生成AIの検索に構造化データは不要」と明記しています。"),
    ("Googleビジネスプロフィールのリンクを、正しく紐付けます",
     "GoogleはSNS・メッセージアプリ・短縮URLをリンク先に使うことを禁止しており、"
     "店舗ごとの専用ページを求めています。"
     "<strong>これが「GoogleマップやInstagramだけでは足りない」ことのはっきりした根拠です。</strong>"
     "マップ経由の行動の47%はウェブサイトへの訪問で、最も多い行動です。"),
    ("問い合わせの通知を2系統にして、返答までの時間を書きます",
     "米国2,241社を調べた研究では23%が返答せず、平均42時間かかっていました。"
     "1時間以内に接触した企業は約7倍、見込み客になりやすいという結果です。"
     "税理士を変えた理由の1位も「レスポンスの遅さ」（30%）でした。"),
    ("納品後の運用は「口コミの鮮度を保つこと」に集約します",
     "74%が直近3か月以内の口コミを重視し、47%は口コミが20件未満のお店を使わず、"
     "42%は口コミに返信していないお店を避け、50%は定型的な返信だと選ぶ確率が下がります。"),
]


SPEC_GROUP_IC = {"情報": "list-checks", "中身": "camera", "技術": "gauge", "運用": "repeat-2"}
SPEC_GROUP_LEDE = {
    "情報": "調査で「連絡されない理由」の1位と2位だった項目です。",
    "中身": "見た人が判断材料にしている中身です。",
    "技術": "数字で効果が確認できるものだけ。やらないことも決めています。",
    "運用": "作ったあとに効く部分です。",
}


SPEC_ICONS = [('phone', '情報'), ('clock', '情報'), ('map-pin', '情報'), ('banknote', '情報'), ('target', '情報'), ('map', '情報'), ('camera', '中身'), ('users', '中身'), ('image', '中身'), ('star', '中身'), ('file-text', '中身'), ('smartphone', '技術'), ('gauge', '技術'), ('zap', '技術'), ('percent', '技術'), ('hand-coins', '技術'), ('code-xml', '技術'), ('link-2', '運用'), ('bell', '運用'), ('star', '運用')]


def page_spec():
    groups = {}
    for (t, d), (icon, grp) in zip(SPEC_ITEMS, SPEC_ICONS):
        groups.setdefault(grp, []).append((icon, t, d))
    items = ""
    for grp, rows in groups.items():
        items += (f'<h3 class="grp">{grp}</h3>'
                  f'<p class="dim" style="font-size:14px">{SPEC_GROUP_LEDE[grp]}</p>')
        items += "".join(acc(t, f"<p>{d}</p>") for icon, t, d in rows)
    lcp = (f'<strong class="tnum">{C.LCP_MEASURED}</strong>'
           if C.LCP_MEASURED else "（計測後に掲載します）")

    body = (
        sec(f"""<p class="lede">作るものを全部公開しています。
        <strong>数字が出ているものだけを入れます。</strong></p>
{stats([
    ("list-checks", "20", "項目", "全業種に共通する仕様"),
    ("gauge", C.LCP_MEASURED.split("秒")[0] if C.LCP_MEASURED else "—", "秒", "表示速度の実測（基準2.5秒）"),
    ("code-xml", "0", "バイト", "実行時のJavaScript"),
    ("ban", "5", "項目", "売らないと決めたもの"),
])}
<p style="margin-top:20px">20項目すべてを自動でチェックする仕組みを作り、
   <strong>1つでも落ちたら納品しません。</strong></p>""",
            key="spec.html", eyebrow="納品する仕様", h="作るものを、先に全部書きます")
        + sec(items, h="全業種に共通する20項目",
              eyebrow="機械で検証しています")
        + sec(f"""
{"".join(acc(e(n), f"<p>{e(r)}</p>", "ban") for n, r in P.NOT_SELLING)}
{note("同じ商品棚に並ばないことが、いちばんの違いです",
      "<p>これらを売っている制作会社は実際にあります。"
      "根拠がないものを売らないと決めています。</p>", "bad")}""",
              alt=True, h="売らないもの")
        + sec(f"""
<p>当方のこのサイトも、上の20項目で作って、同じ検証をかけています。</p>
{table(["#", "項目", "このサイトの実測値"], [
    [ic("gauge", "ic-p"), "表示速度（最大要素の描画）", lcp],
    [ic("image", "ic-p"), "最初に見える要素", "画像を使わず文字にしています（いちばん速い作り）"],
    [ic("code-xml", "ic-p"), "実行時のプログラム", "ありません（0バイト）"],
    [ic("hand-coins", "ic-p"), "押せる部分の大きさ", "44ピクセル四方以上"],
    [ic("map", "ic-p"), "構造化データ", "設定済み（このページのソースで確認できます）"],
])}
{note('自分のサイトで守っていないことは、お客様にもおすすめしません',
      '<p>このサイト自体が見本です。実行時のプログラムを使っていないので、'
      'ブラウザの「ページのソースを表示」で<strong>そのまま全部お読みいただけます。</strong>'
      '納品するサイトも同じ作りです（<a href="owned.html">なぜそうしているか</a>）。</p>'
      '<p><strong>「速いサイトを作ります」と言う会社のサイトが遅い、という状況は避けたい</strong>ので、'
      '数字を出しています。</p>', 'good')}""", h="このサイト自身の数字")
        + sec(cta(), h="ご相談は無料です")
    )
    return {"title": f"納品する仕様｜{BRAND_T}",
            "desc": "調査で数字が出ている20項目だけを入れます。表示速度2.5秒以内を納品条件にし、"
                    "自動検証にかけています。売らないものも公開しています。",
            "body": body}


# ══════════════════════════════════════════════ 制作事例
def page_works():
    body = (
        sec("""<p class="lede">まだ1件目です。正直に書きます。</p>""",
            key="works.html", eyebrow="制作事例", h="事例は、これから積みます")
        + sec(f"""
{note('他社の事例を、自分の実績のように見せることはしません',
      '<p>この業界には、制作に関わっていないサイトを実績として載せる会社があります。'
      '当方はやりません。</p>'
      '<p>そのかわり、1件目から<strong>次の数字をそのまま公開します。</strong></p>'
      '<ul class="plain">'
      '<li>納品時の表示速度（実測値）</li>'
      '<li>Googleマップの閲覧数の変化（公開前後）</li>'
      '<li>問い合わせ・予約の件数の変化</li>'
      '<li>ポータルサイトの掲載費を見直した場合、削減できた金額</li>'
      '<li>うまくいかなかったこと</li>'
      '</ul>')}
{note('「脱ポータルの成功事例」は、どこにも公開されていません',
      '<p>ポータルサイトの掲載をやめたお店の売上が前後でどう変わったか、という'
      '検証できるデータを探しましたが、<strong>公開されているものは'
      'すべてサービス提供側の試算か一般論でした。</strong></p>'
      '<p>なので当方も「事例があります」とは申し上げません。'
      '構造としてこうなる、というところまでにとどめます。'
      '<strong>1件目の数字が、当方の唯一の事例になります。</strong></p>', 'warn')}""")
        + sec(f"""
<p class="lede">お見せできる事例は、いまのところ<strong>このサイト1件です。</strong>
   自分たちのサイトなので手加減できますが、<strong>手加減しない基準で作って、数字を出しています。</strong></p>
{stats([
    ("gauge", C.LCP_MEASURED.split("秒")[0] if C.LCP_MEASURED else "—", "秒",
     "表示速度の実測（全ページの最大値。基準は2.5秒）"),
    ("list-checks", f"{VERIFY_PASS}", "項目", "自動チェックに通った数。1つでも落ちたら納品しません"),
    ("code-xml", "0", "バイト", "実行時のJavaScript"),
    ("zap", "0", "件", "外部サーバーへの読み込み（フォントも自前）"),
])}
<p style="margin-top:22px">この数字は<strong>毎回のビルドで測り直しています。</strong>
   手で書いた値ではありません。検証スクリプトごとお渡しするので、
   <strong>お客様のサイトでも同じ基準で測れます。</strong></p>
{note("自分のサイトを1号案件にしたのは、逃げ場をなくすためです",
      "<p>「速いサイトを作ります」と言いながら自社サイトが遅い会社は珍しくありません。"
      "先に自分で基準を満たしておかないと、お客様に同じ基準を約束できないと考えました。</p>"
      "<p>内訳は<a href='spec.html'>納品する仕様</a>に全部あります。"
      "ソースコードも公開しているので、<strong>本当に自分で作れるのかもそこで確認できます。</strong></p>",
      "good")}
{cta("1件目になってみる")}""", alt=True, h="いま出せるのは、このサイト自身の数字です")
    )
    return {"title": f"制作事例｜{BRAND_T}",
            "desc": "まだ1件目です。他社の事例を自分の実績のように見せることはしません。"
                    "1件目から表示速度・マップの閲覧数・問い合わせ件数をそのまま公開します。",
            "body": body}


# ══════════════════════════════════════════════ 業種別
IND_DATA = {
    "restaurant.html": {
        "name": "飲食店",
        "h1": "飲食店のホームページ",
        "median": "52.8万円",
        "must": [
            ("メニューを文字で載せます（PDFや画像にしません）",
             "来店をやめた理由の1位が「メニューが魅力的でない」（65%）、"
             "4位が「メニューが読みにくい」（30%）。画像のメニューはGoogleも読めません。"),
            ("料理写真を、明るく、メニューごとに撮ります",
             "写真が選択に影響すると答えた人は87%（Z世代は90%）。"
             "写真の質が離脱の理由の36%です。"),
            ("地図・アクセス・駐車場",
             "お店を探す段階で最も見られている要素が「住所・近さ」（44%）。"),
            ("電話と予約の両方を置きます",
             "50歳未満はネット予約、50歳以上は電話が多いという調査結果があります。片方だけにしません。"),
            ("営業時間（臨時休業・年末年始まで）",
             "「情報が欠けている・間違っている」は連絡されない理由の20%です。"),
        ],
        "skip": [("Googleの飲食店カルーセルを狙う設定",
                  "限られた事業者にしか表示されない機能なので、狙っても意味がありません。")],
        "cost": "食べログのベーシックプラン（税込27,500円）を無料プランに戻しても、"
                "ネット予約は固定費0円で使えます。常連さんの予約1件ごとに220円かかる構造から抜けます。",
        "plan": "standard",
    },
    "koumuten.html": {
        "name": "工務店・建設",
        "h1": "工務店・建設業のホームページ",
        "median": "63.4万円",
        "must": [
            ("施工事例を、増やしていける形で作ります",
             "注文住宅の購入者調査で、施工事例が「参考になった」58%・「決め手になった」57%。"
             "どちらも1位でした。プランプランでは絞り込み検索つきのデータベースにします。"),
            ("性能・構造の説明",
             "参考になった43%・決め手42%で、どちらも2位です。"),
            ("お客様の声（依頼した旨を明記して）",
             "参考42%・決め手38%。謝礼や依頼がある場合は、そう分かるように書く必要があります。"),
            ("対応エリアを市町村ごとに",
             "「近さ」はGoogleが公表しているマップの順位の3要因のひとつです。"),
            ("問い合わせフォームを主役にします",
             "建設・エンジニアリング業では、成約のうちフォームが78%・電話が22%でした。"
             "電話も置きますが、フォームを上に出します。"),
        ],
        "skip": [
            ("会社紹介の作り込み",
             "参考になった30%→決め手11%に大きく落ちます。その工数を施工事例に回します。"),
            ("「建設業許可番号の掲載は法律で必要」という説明",
             "掲示の義務は営業所と工事現場の標識についてのもので、"
             "ウェブサイトへの掲載は法律上の義務ではありません。"
             "信頼の材料として載せますが、義務だとは申し上げません。"),
        ],
        "cost": "この業種はポータルサイトより広告費の見直しが効きます。"
                "商圏の外への配信、成約ゼロの検索語、指名検索への過剰な出稿を整理します。",
        "plan": "pro",
    },
    "salon.html": {
        "name": "美容室・サロン",
        "h1": "美容室・サロンのホームページ",
        "median": "54.8万円",
        "must": [
            ("全メニューの料金表（税込・追加料金の条件まで）",
             "連絡しなかった理由の2位が「料金が不明確」（32%）。"
             "市場の利用が減った理由の1位が「美容代を節約する必要が出てきた」です。"),
            ("予約ボタンを最優先で置きます",
             "美容・コスメ分野では成約のうちフォームが92%・電話が8%でした。"),
            ("スタイリストの紹介（顔・得意なこと・指名のしかた）",
             "指名予約の導線になります。"),
            ("スタイルの写真",
             "写真が選択に影響するのは87%。プランプランでは長さや悩み別に絞り込めるようにします。"),
            ("電話も残します（50代以上のお客様向け）",
             "ネット予約が多いのは20〜40代で、50代以上は電話が優位という調査があります。"),
        ],
        "skip": [("新規のお客様が増えるという約束",
                  "美容室の市場は前年比5.9%縮小しています。"
                  "<strong>当方の提案の軸は、掲載費の削減と再来店の導線です。</strong>"
                  "新規集客を約束することはしません。")],
        "cost": "ホットペッパービューティーの掲載料は公開されていないので、"
                "<strong>まず直近の請求書を見せてください。</strong>"
                "無料プランが存在せず、予約売上の2%が手数料としてかかります。",
        "plan": "standard",
    },
    "shigyo.html": {
        "name": "士業・専門事務所",
        "h1": "士業・専門事務所のホームページ",
        "median": "40.0万円",
        "must": [
            ("料金の体系を明示します（範囲・別途費用まで）",
             "連絡しなかった理由の2位が「料金が不明確」（32%）。"
             "<strong>ただし安さは訴求しません。</strong>"
             "税理士を選ぶときに「低価格」を最重視した人は7.2%しかいませんでした。"),
            ("代表・担当者の顔写真と経歴、人柄が伝わる紹介",
             "選ぶときに最も重視された項目の1位が「相談しやすさ・人柄・相性」（21%）。"
             "AI時代に人に残ってほしい役割の1位は「経営者の悩みに寄り添う相談相手」（37%）でした。"),
            ("取扱分野を具体的に分けて書きます",
             "選定基準の3位が「業界の専門知識」（19%）です。"),
            ("電話を最上部に固定します",
             "法務分野では成約のうち電話が56%・フォームが44%。"
             "士業の成約率は全業種で最も高い（7.9%）ので、電話を取りこぼさない作りにします。"),
            ("返答までの時間を書きます",
             "税理士を変えた理由の1位が「レスポンスの遅さ・相談しにくさ」（30%）。"
             "書いたら守れる時間だけを書きます。"),
        ],
        "skip": [("弁護士の方の広告表現",
                  "日本弁護士連合会の会規で、誇大な広告・他の弁護士との比較・勝訴率の表示が禁止されています。"
                  "顧問先の掲載には書面での同意が必要です。"
                  "<strong>この範囲を守って作ります。</strong>")],
        "cost": "この業種は広告の獲得単価が高く（3万〜5万円という目安があります）、"
                "整理の余地が大きいです。商圏外への配信と、成約ゼロの検索語から見ます。",
        "plan": "pro",
    },
}


def page_industry(fname):
    d = IND_DATA[fname]
    plan = next(p for p in P.BUILD if p["key"] == d["plan"])
    run = next(r for r in P.RUN if r.get("recommended"))
    ins = P.INSTALLMENT[d["plan"]]
    must = "".join(f'<li><b>{t}</b><div class="d">{dd}</div></li>' for t, dd in d["must"])
    skip = "".join(f'<li><strong>{e(t)}</strong><br>{dd}</li>' for t, dd in d["skip"])
    others = "".join(
        f'<a class="ind" href="{u}"><span class="n">{ic(IND_IC[u], "ic-sm")}{e(n)}</span>'
        f'<span class="p">{e(dd)}</span></a>' for u, n, dd in INDUSTRIES if u != fname)

    body = (
        sec(f"""<p class="lede">{e(d['name'])}のホームページに必要なものは、調査でかなりはっきりしています。
        <strong>必要なものだけを入れて、効かないものは作りません。</strong></p>
        <p>ちなみに{e(d['name'])}のホームページ制作費の実際の発注額は、
        中央値で<strong>{e(d['median'])}</strong>です（846件の実発注データより）。</p>""",
            eyebrow=f"{d['name']}の方へ", h=d["h1"])
        # 業種ごとの話に入る前に、業種を問わない1番の主張を1枚はさむ
        + sec(note("どの業種でも、作ったものはお客様のものです",
                   "<p>ドメインは初日からお客様の名義で取ります。ソースコードも、"
                   "撮影した写真の元データもお渡しします。<strong>やめても残ります。</strong></p>"
                   "<p>月額制のホームページは、ここが逆になっていることがあります。"
                   "土地でいえば借地に家を建てている状態で、地代を止めた日に更地になります。"
                   "<a href='owned.html'>借地と所有のちがい</a></p>", "good"), tint=True)
        + sec(f'<ol class="steps">{must}</ol>', h="必ず入れるもの")
        + sec(note(f"{d['name']}では作らないもの", f'<ul class="plain">{skip}</ul>', "bad"),
              alt=True, h="やらないこと")
        + sec(f"""
<p>{d['cost']}</p>
<div class="btns"><a class="btn btn-2" href="cost-cut.html">掲載費の見直しについて</a></div>""",
              eyebrow="財源", h="新しい予算をつくる前に、いまの費用を見ます")
        + sec(f"""
<p>{e(d['name'])}には<strong>{e(plan['name'])}（{plan['pages']}ページ）</strong>をおすすめしています。</p>
<div class="ledger">
  <div class="hd">{e(plan['name'])} ＋ 運用{e(run['name'])}</div>
  <div class="row"><span>買い切りの場合</span><span class="v tnum">{yen(plan['price'])}</span></div>
  <div class="row"><span>分割の場合（初回）</span><span class="v tnum">{yen(ins['initial'])}</span></div>
  <div class="row"><span>分割の場合（月額×{P.INSTALLMENT_COUNT}回）</span><span class="v tnum">{yen(ins['monthly'])}</span></div>
  <div class="row"><span>運用（月額）</span><span class="v tnum">{yen(run['price'])}</span></div>
  <div class="row net"><span>分割なら毎月</span><span class="v tnum">{yen(ins['monthly'] + run['price'])}</span></div>
</div>
<p class="dim">税別。分割の手数料は0円で、総額は買い切りと同じです。</p>
<div class="btns">
  <a class="btn btn-2" href="price.html">料金の詳細</a>
  <a class="btn btn-2" href="subsidy.html">補助金を使う場合</a>
</div>""", alt=True, h="おすすめのプラン")
        + sec(f'<div class="cq"><div class="inds">{others}</div></div>', h="ほかの業種")
        + sec(cta(), h="ご相談は無料です")
    )
    return {"title": f"{d['h1']}｜{BRAND_T}",
            "desc": f"{d['name']}に必要なページと、作らないものを公開しています。"
                    f"{plan['name']}（{plan['pages']}ページ）{yen(plan['price'])}から。"
                    "掲載費の見直しから一緒にやります。",
            "body": body}


# ══════════════════════════════════════════════ 私たちについて
def page_about():
    ppl = "".join(f"""
<div class="card">
  <div class="ttl">{e(m['name'])}</div>
  <div class="meta">{e(m['role'])}</div>
  <div class="desc">{e(m['bio'])}</div>
</div>""" for m in C.MEMBERS)

    actual = (f'<p><strong>直近の実績：{e(C.RESPONSE_ACTUAL)}</strong></p>'
              if C.RESPONSE_ACTUAL else
              '<p class="dim">実績値は計測を始めたら掲載します。'
              '測っていない数字は書きません。</p>')

    body = (
        sec(f"""<p class="lede">2人でやっています。
        <strong>地域は限定せず、小規模事業者に絞っています。</strong><br>
        {e(C.SERVICE_NOTE)}</p>""",
            eyebrow="私たちについて", h="2人でやっています")
        + sec(f'<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">{ppl}</div>'
              + note("顔写真を載せます",
                     "<p>士業を選ぶときに最も重視される項目が「相談しやすさ・人柄・相性」だったという"
                     "調査があります。これは制作会社を選ぶときにも同じだと思うので、"
                     "<strong>顔と、何ができて何ができないかを出します。</strong></p>"))
        + sec(f"""
<p>ご連絡をいただいてから<strong>{e(C.RESPONSE_PROMISE)}</strong>にご返信します。</p>
{actual}
{note('なぜ返答の速さを約束するのか',
      '<p>米国で2,241社にテストの問い合わせを送った研究では、'
      '<strong>23%がそもそも返答せず、平均で42時間かかっていました。</strong>'
      '1時間以内に接触した企業は約7倍、見込み客になりやすいという結果が出ています。</p>'
      '<p>税理士を変えた理由の1位も「レスポンスの遅さ・相談しにくさ」（30%）でした。'
      '<strong>ホームページを作っても反響がない原因が、返答していないことだった</strong>'
      'というのは実際に起こります。まず自分たちが守ります。</p>')}""",
              alt=True, eyebrow="お約束", h=f"{C.RESPONSE_PROMISE}にご返信します")
        + sec(f"""
<ul class="plain">
  <li><strong>できないことは、できないと申し上げます。</strong>
      「必ず集客できます」「必ず補助金が通ります」とは言いません。</li>
  <li><strong>やめるべきでないことは、やめないでくださいと申し上げます。</strong>
      ポータルサイトの掲載も、広告も、状況によっては続けたほうがいいです。</li>
  <li><strong>根拠のない施策は売りません。</strong>
      <a href="spec.html">売らないと決めているもの</a>を公開しています。</li>
  <li><strong>お客様が所有権を持てる形で作ります。</strong>
      ドメインの名義も、ソースコードも、写真の元データも、お客様のものにします。
      当方がいなくなっても事業は続くからです。
      <a href="owned.html">借地と所有のちがい</a>／<a href="source.html">納品の中身</a>。</li>
  <li><strong>数字は測って出します。</strong>
      表示速度も、作業時間も、返答の速さも、測ってから書きます。</li>
</ul>""", h="仕事の進め方")
        + sec(cta(), h="ご相談は無料です")
    )
    return {"title": f"私たちについて｜{BRAND_T}",
            "desc": "小規模事業者に絞って2人でやっています。全国対応。"
                    f"ご連絡から{C.RESPONSE_PROMISE}にご返信します。",
            "body": body}


# ══════════════════════════════════════════════ 相談する
def page_contact():
    disabled = not C.FORM_ENDPOINT
    action = f' action="{C.FORM_ENDPOINT}" method="post"' if C.FORM_ENDPOINT else ""
    warn = (note("この見本ではフォームの送信先が未設定です",
                 "<p>config.py の FORM_ENDPOINT に送信先を設定すると有効になります。"
                 "設定と同時に、通知をメールとLINE（またはSMS）の2系統に分けます。</p>", "warn")
            if disabled else "")
    btn = ('<button class="btn btn-1" type="submit" disabled>送信（未設定）</button>'
           if disabled else '<button class="btn btn-1" type="submit">送信する</button>')

    ind_opts = "".join(f'<option>{e(n)}</option>' for _, n, _ in INDUSTRIES)
    line = (f'<p><a class="btn btn-2" href="{C.LINE_URL}">LINEで相談する</a></p>'
            if C.LINE_URL else "")

    body = (
        sec(f"""<p class="lede">ご相談は無料です。{e(C.RESPONSE_PROMISE)}にご返信します。</p>
<p>次の3つを聞かせていただければ、<strong>その場でだいたいの金額をお答えします。</strong></p>
<ol class="steps">
  <li><b>いまホームページはありますか</b>
    <div class="d">ない／食べログやInstagramだけ／古いものがある、のどれでも構いません。</div></li>
  <li><b>いま掲載費や広告費をいくら払っていますか</b>
    <div class="d">おおよそで構いません。請求書があれば、それを見ながらのほうが早いです。</div></li>
  <li><b>いちばん困っていることは何ですか</b>
    <div class="d">新規が来ない／手数料が重い／更新できない／人が採れない、など。</div></li>
</ol>""", eyebrow="相談する", h="ご相談は無料です")
        + sec(f"""
<h3>お電話</h3>
<p><a class="tel" href="tel:{C.TEL_LINK}">{ic("phone")}<span class="t"><span class="lbl">タップで発信</span><span class="num">{e(C.TEL)}</span></span></a></p>
<p>{e(C.TEL_HOURS)}　／　この時間に出られないときは折り返します。</p>
{line}
<h3>メール</h3>
<p><a href="mailto:{C.EMAIL}">{e(C.EMAIL)}</a></p>""", alt=True, h="連絡先")
        + sec(f"""{warn}
<form{action}>
  <div class="field">
    <label for="f-name">お名前<span class="req">必須</span></label>
    <input type="text" id="f-name" name="name" required autocomplete="name">
  </div>
  <div class="field">
    <label for="f-biz">お店・会社の名前</label>
    <input type="text" id="f-biz" name="business" autocomplete="organization">
  </div>
  <div class="field">
    <label for="f-ind">業種</label>
    <select id="f-ind" name="industry"><option>選んでください</option>{ind_opts}<option>その他</option></select>
  </div>
  <div class="field">
    <label for="f-tel">お電話番号<span class="req">必須</span></label>
    <input type="tel" id="f-tel" name="tel" required autocomplete="tel" inputmode="tel">
    <p class="hint">お急ぎの場合は、こちらからお電話でご連絡します。</p>
  </div>
  <div class="field">
    <label for="f-mail">メールアドレス</label>
    <input type="email" id="f-mail" name="email" autocomplete="email" inputmode="email">
  </div>
  <div class="field">
    <label for="f-msg">ご相談の内容<span class="req">必須</span></label>
    <textarea id="f-msg" name="message" required></textarea>
    <p class="hint">上の3つ（ホームページの有無／いまの掲載費・広告費／困っていること）に触れていただけると、
      1回のやりとりで概算までお答えできます。</p>
  </div>
  {btn}
</form>
<p class="dim">いただいた情報は、ご相談への回答とお見積りのためだけに使います。
  第三者に提供することはありません。</p>""", h="フォームから")
    )
    return {"title": f"相談する｜{BRAND_T}",
            "desc": f"ご相談は無料です。{C.RESPONSE_PROMISE}にご返信します。"
                    f"お電話は{C.TEL}（{C.TEL_HOURS}）。",
            "body": body}


# ══════════════════════════════════════════════ 借地と所有（主張の中心）
def page_owned():
    """このサイトでいちばん強く言うこと。他のページはここを支える材料として並べる。
       喩えで終わらせないために、所有を『4つが手元にあること』に分解して、
       それぞれ検証できる形（名義・納品物・置き場所・元データ）に落としてある。"""
    hero = f"""
<section class="hero"><div class="wrap">
  <p class="kick">{ic("key", "ic-sm")}いちばんお伝えしたいこと</p>
  <h1>そのホームページ、<br>借りた土地に建っていませんか。</h1>
  <p class="sub">月額制のホームページは、借地に建てた家と同じです。
     <strong style="color:#fff">やめた日に、更地にして返します。</strong>
     紬がつくるのは、土地ごとお客様のものになるホームページです。</p>
  {cta("まず話を聞いてみる")}
</div></section>"""

    compare = sec(f"""
<p class="lede">借地は、土地を借りて<strong>自分のお金で家を建てる</strong>仕組みです。
   地代を払い続けるあいだは住めますが、契約が終われば<strong>家を壊して更地にして返します。</strong>
   月額制のホームページで起きているのは、これと同じことです。</p>
{D.land_vs_own()}
{table(["借地で起きること", "ホームページで起きること"], [
    ["土地を借りる", "ドメインとサーバーが、制作会社の中にある"],
    ["地代を毎月払う", "月額を毎月払う"],
    ["家は自分のお金で建てる", "ページ・写真・原稿の費用は、お客様が出している"],
    ["契約が終われば更地にして返す",
     "解約するとサイトが非公開になる／削除か買い取りかを選ばされる"],
    ["建てた家は持ち出せない", "中身もURLも持ち出せない"],
], foot="すべての制作会社がこうだという意味ではありません。"
   "そうでない会社もあります。<strong>確かめ方はこのページの下に書きました。</strong>")}""",
        tint=True, key="owned.html", eyebrow="たとえ話ではなく、契約の話です",
        h="建てるものは同じ。違うのは土地の名義です")

    law = sec(f"""
<p class="lede">ここは正直に書きます。
   <strong>本物の借地のほうが、いまのホームページの契約よりずっと守られています。</strong></p>
{table(["", "契約の更新", "終わったときに手元に残るもの"], [
    ["普通借地権",
     "地主は<strong>正当な事由がなければ拒めません</strong>（借地借家法6条）",
     "<span class='yes'>建物を時価で買い取らせられます</span>（同13条）"],
    ["定期借地権", "更新はありません（同22〜24条）",
     "<span class='no'>買取の請求はできません</span>。更地にして返します"],
    ["月額制のホームページ", "契約書しだい",
     "<span class='no'>買取の規定がないことが多い</span>。<strong>公開が止まります</strong>"],
], foot="いまのホームページの契約は、いちばん下の行です。"
   "定期借地に近く、場合によってはそれより弱い条件になっています。")}
{note("法律の話は、喩えとして書いています",
      "<p>当方は弁護士ではありません。ここに書いた条文は仕組みを説明するためのもので、"
      "個別のご契約の効力を判断するものではありません。"
      "<strong>実際の条件は、必ずお手元の契約書でご確認ください。</strong>"
      "読み方が分からない場合は、一緒に読みます。</p>", "warn")}""",
        eyebrow="正確に言うと", h="借地のほうが、まだ守られています")

    keys = sec(f"""
<p class="lede">「所有」を気分の話にしないために、
   <strong>4つに分けて、それぞれ確かめられる形</strong>にしています。</p>
{cards([
    ("map-pin", "① 住所 ── ドメイン",
     "初日からお客様の名義で取得します。登録簿でお名前を確認できます。",
     ("名義のお約束", "terms.html")),
    ("code-xml", "② 建物 ── ソースコード",
     "HTML・CSS・画像・設定の一式をお渡しします。他社がそのまま引き継げます。",
     ("納品の中身を見る", "source.html")),
    ("globe", "③ 地盤 ── 置き場所",
     "実行時のプログラムが0バイトなので、どのサーバーにも置けます。",
     ("仕様を見る", "spec.html")),
    ("camera", "④ 家具 ── 写真と原稿",
     "撮影した元データをお渡しします。チラシにもSNSにも使えます。",
     ("権利の扱い", "terms.html")),
], cls="g2")}
{table(["", "借地のとき", f"{e(C.BRAND)}（所有）"], [
    ["ドメイン（住所）",
     '<span class="no">制作会社の名義。解約するとURLが死にます</span>',
     '<span class="yes">初日からお客様の名義で取得します</span>'],
    ["ソースコード（建物）",
     '<span class="no">渡されない。中を見ることもできない</span>',
     '<span class="yes">一式お渡し。GitHubにご招待します</span>'],
    ["置き場所（地盤）",
     '<span class="no">その会社のサーバーにしか置けない</span>',
     '<span class="yes">どのサーバーにも置ける形で作ります</span>'],
    ["写真と原稿（家具）",
     '<span class="no">そのサイトの中でしか使えない</span>',
     '<span class="yes">元データをお渡し。用途の制限は付けません</span>'],
], foot="③は技術の話ですが、意味は単純です。"
   "実行時に動くプログラムを使っていないので、<strong>置き場所を選びません。</strong>"
   "特定のサーバーでしか動かないサイトは、そのサーバーを離れられません。")}""",
        dark=True, eyebrow="所有権の中身", h="所有しているとは、この4つが手元にあることです")

    cost = sec(f"""
<p class="lede">所有すれば無料になる、とは申し上げません。
   <strong>土地を持っていても、固定資産税はかかります。</strong></p>
{calc("持ち続けるのにかかるもの", [
    ("ドメインの更新料", "年 1,500円前後", "small", "「.jp」「.com」など種類によります"),
    ("サーバー代", "月 0〜1,500円前後", "small",
     "実行時のプログラムがないので、無料の範囲に収まることもあります"),
    (f"運用をお任せいただく場合", f"月 {P.run('run_light')['price']:,}円〜", "small",
     "ご自身で更新される場合は不要です"),
], ttl_icon="wallet-minimal")}
{note("違うのは、払うのをやめたときです",
      "<p>借地は、地代を止めた時点で家ごと失います。所有なら、"
      "<strong>運用をやめてもサイトは動き続けます。</strong></p>"
      "<p>運用をやめられる場合は、<strong>サーバーとドメインの契約をお客様に引き継ぎます。"
      "手数料はいただきません。</strong>"
      f"引き継ぎの手順書は納品時に同梱しているので、その日から使えます。</p>", "good")}""",
        tint=True, eyebrow="正直に書きます", h="所有にも、維持費はかかります")

    transfer = sec(f"""
<p class="lede">「◯か月使えば無償譲渡します」と書いている会社があります。
   良心的に見えますが、<strong>渡されるものが2種類ある</strong>ので、そこだけ確かめてください。</p>
{table(["渡されるもの", "できること", "できないこと"], [
    ["<strong>建物ごと</strong><br><span class='dim'>ソースコード一式</span>",
     "<span class='yes'>どのサーバーにも置ける。他社がそのまま引き継げる</span>",
     "—"],
    ["<strong>借地権だけ</strong><br><span class='dim'>作成ツールのアカウント</span>",
     "<span class='yes'>そのツールの中では、自分の名義で使い続けられる</span>",
     "<span class='no'>ツールの外へは持ち出せない。以後もそのツールに毎月払い続ける</span>"],
], caption="サイト作成ツールで作られたページは、書き出せる形のプログラムになっていません。"
   "「譲渡」はアカウントの移し替えで、地主が変わるわけではありません。",
   foot="<strong>ツールが悪いという話ではありません。</strong>"
        "そのまま使い続けるなら、よくできた仕組みです。"
        "困るのは<strong>「移せると思っていたのに移せなかった」</strong>ときだけです。")}
{note("確かめ方は1つだけです",
      "<p><strong>「譲渡されたあと、別の会社に引き継げますか」</strong>と聞いてください。</p>"
      "<p>「はい」なら建物ごと。「そのツールを使い続けていただく形になります」なら借地権だけです。"
      "どちらも嘘ではないので、聞かないと分かりません。</p>", "good")}
{note("当方がお渡しするのは、建物ごとです",
      "<p>実行時に動くプログラムを使っていないので、"
      "<strong>HTMLとCSSと画像のまま、どのサーバーにも置けます。</strong>"
      "作成ツールのアカウントに縛られる形にはしていません"
      "（<a href='spec.html'>この点は機械で検証しています</a>）。</p>")}""",
        eyebrow="もうひとつの落とし穴", h="「譲渡します」にも、2種類あります")

    check = sec(f"""
<p class="lede">いまお使いのサイトが借地かどうかは、
   <strong>制作会社に5つ聞けば分かります。</strong>聞きにくければ、代わりに聞きます。</p>
{acc("① ドメインの契約者名は、どなたの名前になっていますか？",
     "<p>ドメインには公開の登録簿があるので、<strong>その場で確認できます。</strong>"
     "制作会社の名義だった場合、解約するとURLごと使えなくなります。"
     "名刺・チラシ・看板・車体に刷ったURLが、すべて死にます。</p>")}
{acc("② 解約したら、いまのページはどうなりますか？",
     "<p>「非公開になります」「データはお渡しできません」「買い取りになります」。"
     "どれも契約書に書いてあれば違法ではありません。"
     "<strong>書いてある場所を、一緒に探します。</strong></p>")}
{acc("③ ソースコードは、もらえますか？",
     "<p>「システムなのでお渡しできません」という答えが多いです。"
     "その場合、別の会社に移るには<strong>ゼロから作り直しになります。</strong>"
     "見積もりを取るときに、この一言があるかどうかで金額が変わります。</p>")}
{acc("④ サイトの写真の元データは、手元にありますか？",
     "<p>撮影費を払ったのに、サイト用に圧縮された小さい画像しか手元にない、はよくあります。"
     "<strong>チラシにもメニューにも使えません。</strong>元データの所在を確認してください。</p>")}
{acc("⑤ 別の会社に引き継ぐとき、いくらかかりますか？",
     "<p>移管手数料が決まっていることがあります。金額を聞いておくと、"
     "<strong>いまの契約がどちらの性質か</strong>がはっきりします。</p>")}
{acc("⑥ 「譲渡」されたあと、別の会社に引き継げますか？",
     "<p>「◯か月で無償譲渡」と書いてある場合の、いちばん大事な確認です。"
     "<strong>サイト作成ツールのアカウントを渡されるだけ</strong>のことがあります。"
     "その場合、譲渡されても<strong>そのツールの外へは持ち出せません。</strong></p>")}
{note("5つとも「わからない」で構いません",
      "<p>いちばん多い答えです。契約書をお持ちいただければ、一緒に読みます。無料です。</p>"
      "<p>読んだ結果<strong>「いまのままで問題ありません」</strong>になることもあります。"
      "そのときは、そう申し上げます。</p>", "good")}""",
        eyebrow="確かめ方", h="いまのサイトが借地かどうか、5つの質問")

    move = sec(f"""
<p class="lede">いまのサイトがある方も、移せます。
   <strong>移せないのは、ドメインが相手の名義のときだけ</strong>です。</p>
{table(["順番", "やること", "だれが"], [
    ["1", "いまの契約書を読んで、解約条件と名義を確かめる", "一緒に"],
    ["2", "ドメインをお客様の名義に移す（移管）", "当方が手続き"],
    ["3", "新しいサイトを作る。この間、いまのサイトは生かしたまま", "当方"],
    ["4", "公開を切り替える。URLは変わりません", "当方"],
    ["5", "いまの契約を解約する", "お客様（文面は用意します）"],
], foot="切り替えの順番を間違えると、数日間サイトが消えます。"
   "<strong>3と4を先に済ませてから5に進みます。</strong>")}
<div class="btns"><a class="btn btn-2" href="flow.html">制作の流れを見る</a></div>""",
        eyebrow="いまのサイトがある方へ", h="借地から、所有に移せます")

    last = sec(f"""
<p class="lede">聞くのは3つだけです。契約書があれば、一緒に読みます。</p>
{cta("フォームで相談する")}""", dark=True, h="まず、いまの契約書を見せてください")

    return {
        "title": f"借地と所有｜そのホームページ、借りた土地に建っていませんか｜{BRAND_T}",
        "desc": "月額制のホームページは、借地に建てた家と同じです。やめた日に更地にして返します。"
                "紬は土地ごとお渡しします。ドメイン・ソースコード・置き場所・写真の元データ、"
                "4つとも手元に残ります。",
        "body": hero + compare + law + keys + transfer + cost + check + move + last,
    }


# ══════════════════════════════════════════════ 制作の流れ
def page_flow():
    std = {p["key"]: p for p in P.BUILD}["standard"]
    # 無い窓口は約束しない。LINE は config.LINE_URL を設定してから出す
    ways = "メール・電話・LINE" if getattr(C, "LINE_URL", "") else "メールとお電話"
    body = (
        sec(f"""<p class="lede">スタンダード（{std['pages']}ページ）で
        <strong>約{std['weeks']}週間</strong>です。
        お客様にお願いするのは、取材と、ご確認の2回だけです。</p>
{stats([
    ("calendar-days", std['weeks'], "週間", "ご契約から公開まで"),
    ("users", "2", "回", "お客様にお時間をいただく回数"),
    ("list-checks", "20", "項目", "公開前の自動チェック"),
    ("repeat-2", "0", "円", "公開後の修正費用"),
])}""", eyebrow="制作の流れ", h="お申し込みから公開までにやること")
        + sec(f"""
{flow([
    ("ご相談", "オンラインか電話で30〜60分。いまの掲載費・困っていること・"
     "ホームページの有無の3つだけ伺います。", "ご一緒に", "無料"),
    ("お見積りとご契約", "解約条件・所有権の扱い・修正の範囲も、ここで書面にします。",
     "ご一緒に", "3日ほど"),
    ("ドメインの取得", "最初にやります。<strong>お客様の名義</strong>で取ります。",
     "当方", "1日", True),
    ("取材と撮影", "お店でお話を伺いながら撮ります。原稿の材料もここで集めます。",
     "ご一緒に", "半日〜1日"),
    ("構成と原稿のご確認", "作る前に、載せる内容を文字で確認していただきます。",
     "お客様", "1週間"),
    ("制作", "この間、お客様の作業はありません。", "当方", "2〜3週間"),
    ("できたものをご確認", "直したいところは何回でも。回数の上限はありません。",
     "お客様", "1週間"),
    ("検証", "20項目を機械でチェックします。1つでも落ちたら公開しません。", "当方", "1日"),
    ("公開とお引き渡し", "ソースコード・引き継ぎの手順書・撮影した写真の元データ。",
     "当方", "1日", True),
    ("運用", "変更のご連絡は" + ways + "のどちらでも。月次のご報告つき。", "当方", "毎月"),
])}
<p class="fine-note">お客様のお時間をいただくのは4と5・7だけです。
   ご確認が早ければ、その分だけ公開は早まります。
   <strong>緑の丸は、お客様のものが手元に増える手順</strong>です。</p>
{note("止まるのは、たいてい5番です",
      "<p>原稿のご確認が返ってこないまま数週間、というのがいちばん多い遅れ方です。"
      "<strong>叩き台はこちらで全部書きます。</strong>直すところだけ言っていただければ進みます。</p>",
      "warn")}""", tint=True, key="flow.html", h="10の手順")
        + sec(f"""
<p class="lede">補助金を使う場合は、<strong>順番が変わります。</strong>
   先に契約すると対象外になります。</p>
{table(["補助金を使わない場合", "補助金を使う場合"], [
    ["ご契約 → 着手", "見積書のお渡し → <strong>申請 → 交付決定 → ご契約 → 着手</strong>"],
    ["ご相談から公開まで約6週間",
     "交付決定を待つぶん、<strong>2〜3か月ほど長くなります</strong>"],
    ["お支払いは分割か一括", "<strong>全額を立て替えたあと</strong>に補助金が入ります（精算払い）"],
], foot="交付決定より前の日付の契約書・発注書は、補助の対象になりません。"
   "ここは戻せないので、必ず先にご相談ください。")}
<div class="btns"><a class="btn btn-2" href="subsidy.html">補助金の手順と注意点</a></div>""",
              eyebrow="順番が変わる場合", h="補助金を使うときは、契約が後になります")
        + sec(f"""
{acc("取材では何を聞かれますか？",
     "<p>創業のきっかけ、いちばん多いご注文、お客様によく聞かれること、"
     "他所と違うと思っているところ。<strong>準備はいりません。</strong>"
     "話していただいたものを、こちらで文章にします。</p>")}
{acc("写真は自分で用意してもいいですか？",
     "<p>もちろん構いません。お手元の写真を使って、足りないところだけ撮ります。"
     "撮影がまるごと不要な場合は、その分をお見積りから引きます。</p>")}
{acc("公開のあと、どこに連絡すればいいですか？",
     f"<p>{ways}のどちらでも同じです。"
     f"{e(C.RESPONSE_PROMISE)}にご返信し、内容によってはその日のうちに直します。</p>")}
{acc("途中でやめたくなったら？",
     "<p>制作の途中で中止される場合は、その時点までの作業分のみ精算します。"
     "<strong>違約金はいただきません。</strong>そこまでに作ったものはお渡しします。</p>")}""",
              eyebrow="よくいただく質問", h="流れについて、よくお聞きすること")
        + sec(f"""<p class="lede">ご相談は無料。{e(C.RESPONSE_PROMISE)}にご返信します。</p>
{cta("フォームで相談する")}""", dark=True, h="まずは30分、お話を聞かせてください"))
    return {
        "title": f"制作の流れ｜ご相談から公開まで約{std['weeks']}週間｜{BRAND_T}",
        "desc": f"ご相談から公開まで約{std['weeks']}週間。お客様にお時間をいただくのは取材とご確認の2回だけです。"
                "10の手順と、補助金を使う場合の順番の違いを先に公開しています。",
        "body": body,
    }


# ══════════════════════════════════════════════ よくあるご質問
def page_faq():
    """FAQ の構造化データは付けない（2026年5月7日に検索での表示が終了しているため）。
       ページとしては要る。電話の前に確かめたいことが、ここに集まる。"""
    m_std = P.monthly_all_in("standard", "run_standard")

    std_price = {p["key"]: p for p in P.BUILD}["standard"]["price"]

    def grp(title, qa, **kw):
        return sec("".join(acc(q, a) for q, a in qa), h=title, **kw)

    body = (
        sec("""<p class="lede">お電話の前に確かめたいことを集めました。
        ここに無いことは、<strong>そのままお電話でお聞きください。</strong></p>""",
            eyebrow="よくあるご質問", h="お問い合わせの前に")
        + grp("お金のこと", [
            ("結局、月々いくらですか？",
             f"<p>スタンダードで<strong>月{m_std:,}円（税別）</strong>です。"
             "制作費の分割分と運用費の両方が入っています。"
             "<a href='price.html'>内訳はこちら</a>。</p>"),
            ("初期費用はいくらかかりますか？",
             f"<p>分割の場合は初回{P.INSTALLMENT['standard']['initial']:,}円、"
             f"一括の場合は{std_price:,}円です。"
             "<strong>分割にしても総額は変わりません</strong>（手数料0円）。</p>"),
            ("1ページだけでもお願いできますか？",
             f"<p>できます。<strong>シングル {P.SINGLE['price']:,}円（税別・買い切り）</strong>です。"
             "1ページでも、ドメインもソースコードも初日からお客様の名義です。"
             "あとからページを増やすときは<strong>差額だけ</strong>いただきます。</p>"),
            ("月額◯◯円のサービスと、どちらが安いですか？",
             f"<p>1ページなら、こちらが{P.COMPARE_MONTHS}か月で"
             f"<strong>{-P.compare_rows()[0]['diff']:,}円安く</strong>なります。"
             f"ページ数が多くなると逆転して、{P.compare_rows()[2]['sub_pages']}ページ前後では"
             f"こちらが{P.compare_rows()[2]['diff']:,}円高くなります。"
             "<a href='price.html'>総額を並べた表</a>を出しています。"
             "差の中身は撮影・取材・修正の回数です。</p>"),
            ("業種によって値段は変わりますか？",
             "<p>変わりません。変わるのは<strong>作るページの中身</strong>です。</p>"),
            ("あとから追加料金がかかることはありますか？",
             "<p>文章・写真・料金・営業時間の変更は何回でも無料です。"
             "<strong>ページそのものを増やす場合だけ</strong>別途いただきます"
             f"（{P.OPTIONS[0][1]:,}円）。"
             "<a href='unlimited.html'>含まれる範囲の全部</a>を公開しています。</p>"),
            ("支払い方法は？",
             "<p>銀行振込です。分割の場合は毎月のお振込みになります。</p>"),
        ])
        + grp("所有と解約のこと", [
            ("解約したら、サイトはどうなりますか？",
             "<p><strong>残ります。</strong>ドメインは最初からお客様の名義で、"
             "ソースコードもお渡ししてあります。"
             "サーバーとドメインの契約は、手数料なしでお客様に引き継ぎます。"
             "<a href='owned.html'>借地と所有のちがい</a>。</p>"),
            ("他社の「◯か月で無償譲渡」と何が違いますか？",
             "<p>渡される<strong>中身</strong>と<strong>時点</strong>が違います。</p>"
             "<p>時点：あちらは払い終えたときに渡ります。当方は初日に渡します。</p>"
             "<p>中身：サイト作成ツールで作られている場合、譲渡されるのは"
             "<strong>ツールのアカウント</strong>で、そのツールの外へは持ち出せません。"
             "当方はHTMLとCSSのままお渡しするので、どのサーバーにも置けます。"
             "<a href='owned.html'>「譲渡します」にも2種類あります</a>。</p>"),
            ("契約期間の縛りはありますか？",
             f"<p>制作は分割払いの{P.INSTALLMENT_COUNT}回が残る点を除き、縛りはありません。"
             f"運用は{e(P.RUN_TERM)}のご契約で、<strong>違約金はありません。</strong></p>"),
            ("ソースコードは本当にもらえるんですか？",
             "<p>もらえます。GitHubという保管場所にご招待してお渡しします。"
             "アカウントの作り方からお手伝いします。"
             "<a href='source.html'>納品の中身</a>。</p>"),
            ("いま他社で作ったサイトがあります。移せますか？",
             "<p>移せます。ドメインの名義と解約条件を先に確認します。"
             "<strong>いまのサイトを生かしたまま</strong>新しいものを作って、最後に切り替えます。</p>"),
            ("紬さんが廃業したら、どうなりますか？",
             "<p>サイトは動き続けます。<strong>そのために全部お渡ししています。</strong>"
             "引き継ぎの手順書も納品時に同梱しているので、他社がそのまま引き継げます。</p>"),
        ])
        + grp("作るもののこと", [
            ("どんなサイトになりますか？",
             "<p>作る内容を<a href='spec.html'>先に全部公開しています</a>。"
             "20項目すべてを機械で検証して、1つでも落ちたら納品しません。</p>"),
            ("自分で更新できますか？",
             "<p>スタンダード以上には管理画面が付きます。"
             "ただし<strong>ご自身で更新しなくても困らない</strong>ようにしています。"
             "ご連絡いただければこちらで直します。無料です。</p>"),
            ("写真は撮ってもらえますか？",
             "<p>全プランに出張撮影が含まれます（交通費は実費）。"
             "<strong>撮った写真の元データはお渡しします。</strong>"
             "チラシにもSNSにも使えます。</p>"),
            ("文章は自分で書くんですか？",
             "<p>書きません。取材でお話を伺って、<strong>こちらで全部書きます。</strong>"
             "できたものを直していただく形です。</p>"),
            ("スマートフォンでも見られますか？",
             "<p>もちろんです。<strong>パソコン版から内容を削りません。</strong>"
             "同じ内容が出ます。</p>"),
        ])
        + grp("集客のこと", [
            ("検索で1位になりますか？",
             "<p><strong>お約束しません。</strong>順位を保証する会社があれば、疑ったほうがいいです。"
             "やるのは、Googleが公表している要因のうち"
             "<strong>こちらで動かせるもの</strong>を全部揃えることです。</p>"),
            ("新規のお客様は増えますか？",
             "<p>増えるとは約束しません。確実にできるのは"
             "<strong>手数料の削減と、再来店の導線づくり</strong>です。"
             "そこは数字で確認できます。</p>"),
            ("食べログはやめたほうがいいですか？",
             "<p><strong>いきなりやめる提案はしません。</strong>"
             "準備なしにやめると売上が落ちます。3〜6か月は併走します。"
             "やめるべきでないお店には「やめないでください」と申し上げます。"
             "<a href='cost-cut.html'>進め方</a>。</p>"),
            ("AI検索の対策はしてもらえますか？",
             "<p><strong>売りません。</strong>Googleの公式ガイドが"
             "「生成AIの検索に構造化データもAI向けの書き方も不要」と明記しています。"
             "根拠のないものは商品にしていません。</p>"),
        ])
        + grp("補助金のこと", [
            ("補助金は必ず通りますか？",
             f"<p>通りません。採択率は{e(P.SUBSIDY['adoption_rate'])}です。"
             "<strong>通らなかった場合の扱いは、契約前に書面で決めます。</strong></p>"),
            ("申請は代わりにやってもらえますか？",
             "<p>申請そのものはお客様ご自身で行っていただきます。"
             "当方は<strong>見積書と根拠資料</strong>をお渡しし、書き方のご相談に乗ります。</p>"),
            ("お金はいつもらえますか？",
             "<p><strong>全額を立て替えたあと</strong>です（精算払い）。"
             "実績報告のあとに入金されます。<a href='subsidy.html'>手順と締切</a>。</p>"),
        ])
        + grp("そのほか", [
            ("対応エリアはどこまでですか？",
             f"<p>{e(C.AREA)}です。{e(C.SERVICE_NOTE)}"
             "撮影で伺う場合の交通費のみ実費でいただきます。</p>"),
            ("何人でやっているんですか？",
             "<p>2人です。<a href='about.html'>私たちについて</a>。"
             "<strong>人を増やして数をこなす形にはしません。</strong></p>"),
            ("制作事例を見せてください",
             "<p><strong>まだ1件目です。</strong>他社の事例を自分の実績のようには見せません。"
             "<a href='works.html'>いま出せる数字</a>は全部出しています。</p>"),
            ("相談したら、そのまま契約になりませんか？",
             "<p>なりません。ご相談は無料で、その場でお返事をいただく必要もありません。"
             "<strong>いまのままで大丈夫だと思えば、そう申し上げます。</strong></p>"),
        ])
        + sec(f"""<p class="lede">ここに無いことは、そのままお聞きください。
{e(C.RESPONSE_PROMISE)}にご返信します。</p>
{cta("フォームで相談する")}""", dark=True, h="答えが見つからなかった方へ"))
    return {
        "title": f"よくあるご質問｜料金・解約・所有権・補助金について｜{BRAND_T}",
        "desc": "料金、解約したらサイトはどうなるか、ソースコードは本当にもらえるのか、"
                "補助金は通るのか。お電話の前に確かめたいことへの答えをまとめています。",
        "body": body,
    }


# ══════════════════════════════════════════════ ご契約とお約束
def page_terms():
    """サイトで言っていることの根拠を1枚にまとめた場所。
       ここに書けないことは、トップにも書かない。"""
    draft_note = (note(
        "この文面は、契約書の下書きです",
        "<p>公開前に弁護士の確認を受けたうえで確定します。"
        "<strong>実際のご契約は、確認後の書面で取り交わします。</strong>"
        "ここに書いてあることと契約書が食い違う場合は、契約書が優先します。</p>", "warn")
        if C.PLACEHOLDER else "")

    body = (
        sec(f"""<p class="lede">サイトのあちこちで「何回でも無料」「やめても残ります」と書いています。
        <strong>その根拠を、1枚にまとめました。</strong>
        契約書に書く内容と同じものです。</p>
{draft_note}""", eyebrow="ご契約とお約束", h="書いたことは、契約書にも書きます")
        + sec(f"""
{table(["項目", "お約束する内容"], [
    ["ドメインの名義",
     "<strong>初日からお客様（またはお客様の法人）の名義で取得します。</strong>"
     "当方の名義では取得しません。"],
    ["ソースコード",
     "納品時に一式をお渡しします。お客様は<strong>自由に利用・改変・複製でき、"
     "他社へ移すことも制限しません。</strong>"],
    ["写真と原稿",
     "撮影した写真の元データをお渡しします。"
     "<strong>用途の制限は付けません</strong>（チラシ・SNS・ポータルサイトへの掲載も可）。"],
    ["置き場所",
     "特定のサーバーでしか動かない作り方はしません。"
     "他社のサーバーへ移せる形で納品します。"],
    ["共通部分の権利",
     "他のお客様にも使う共通の部品（テンプレート）の権利は当方に残りますが、"
     "<strong>お客様がサイトを使い続けること・他社へ移すことを妨げません。</strong>"],
    ["ページを増やすとき",
     "上の段のプランに移る場合は<strong>差額のみ</strong>いただきます。"
     "すでにお支払いいただいた金額は充当し、払い直しにはしません。"],
], caption="「所有権」と書いているのは、この5つのことです。")}""",
              tint=True, key="terms.html", h="所有権の扱い")
        + sec(f"""
{table(["項目", "お約束する内容"], [
    ["解約の申し出",
     f"運用は{e(P.RUN_TERM)}のご契約です。"
     "次の期間が始まる前にご連絡いただければ、<strong>違約金なしで終了します。</strong>"],
    ["解約したあと",
     "<strong>サイトは消しません。</strong>サーバーとドメインの契約を"
     "<strong>手数料なしで</strong>お客様に引き継ぎます。"],
    ["買い取り", "<strong>ありません。</strong>すでにお渡ししているものを買い戻していただく理由がありません。"],
    ["移管手数料", "<strong>いただきません。</strong>"],
    ["制作費の残り",
     f"分割中に運用を解約された場合、制作費の残り（{P.INSTALLMENT_COUNT}回のうち未払い分）は"
     "お支払いいただきます。<strong>一括でのご精算も可能です。</strong>"],
    ["制作の途中で中止",
     "その時点までの作業分のみ精算します。違約金はありません。"
     "できているものはお渡しします。"],
], caption="解約は、こちらから引き止めません。理由もお聞きしません。")}""",
              key="terms.html", h="解約したときにどうなるか")
        + sec(f"""
{table(["項目", "お約束する内容"], [
    ["何回でも無料の範囲",
     "文章・写真・料金・営業時間・お知らせ・スタッフ・施工事例の変更。"
     f"<a href='unlimited.html'>全部を公開しています</a>。"],
    ["別途いただくもの",
     f"ページそのものを増やす場合（{P.OPTIONS[0][1]:,}円〜）、"
     "デザインの全面的な作り直し、新しい機能の追加。"
     "<strong>着手前に必ずお見積りを出します。</strong>"],
    ["対応の時間",
     f"{e(C.RESPONSE_PROMISE)}にご返信します。"
     "内容によっては当日中に反映します。"],
    ["納品の条件",
     "表示速度2.5秒以内ほか20項目を満たすこと。"
     "<strong>1つでも満たさない場合は納品しません</strong>"
     "（<a href='spec.html'>項目の一覧</a>）。"],
], caption="「何回でも」と書く以上、どこまでかも同じ場所に書きます。")}""",
              tint=True, h="変更と対応の範囲")
        + sec(f"""
{table(["項目", "お約束する内容"], [
    ["集客の保証",
     "<strong>検索順位・問い合わせ件数・売上を保証しません。</strong>"
     "保証していると受け取れる表現も使いません。"],
    ["補助金の採択",
     "<strong>保証しません。</strong>不採択だった場合の取り扱い"
     "（契約の解除・減額・時期の変更のいずれにするか）は、"
     "<strong>着手前に書面で決めます。</strong>"],
    ["復旧",
     "表示されない・改ざんされたなどの障害は、運用のご契約中は無償で対応します。"
     "バックアップは毎週取ります。"],
    ["再委託",
     "撮影・記事など一部を外部にお願いすることがあります。"
     "<strong>その場合も窓口と責任は当方です。</strong>"],
    ["お客様にお願いすること",
     "掲載する情報（料金・資格・実績）が事実であること。"
     "他人の文章・写真を無断で使わないこと。"],
    ["お引き受けできない場合",
     "法令に反する内容、事実と異なる表示、"
     "反社会的勢力に関係する場合はお引き受けできません。"],
], caption="できないことを先に書くほうが、あとで揉めません。")}""",
              h="できること・できないこと")
        + sec(f"""
<p class="lede">上は要約です。<strong>実際のご契約は書面で取り交わします。</strong>
   ひな形は、ご相談の時点でお渡しします。読んでから決めていただけます。</p>
{cta("契約書のひな形をもらう")}""", dark=True, h="契約書は、契約前にお渡しします"))
    return {
        "title": f"ご契約とお約束｜解約・所有権・変更の範囲｜{BRAND_T}",
        "desc": "「何回でも無料」「やめても残ります」の根拠を1枚にまとめました。"
                "ドメインの名義、ソースコードの扱い、解約したときにどうなるか、"
                "できないこと。契約書に書く内容と同じものです。",
        "body": body,
    }


# ══════════════════════════════════════════════ 個人情報の取り扱い
def page_privacy():
    body = (
        sec(f"""<p class="lede">お預かりするのは、<strong>ご相談にお答えするために必要なものだけ</strong>です。
        それ以外の目的には使いません。</p>
{note("このサイトは、アクセス解析を入れていません",
      "<p>実行時に動くプログラムを使っていないので、"
      "<strong>Cookieも使っていませんし、閲覧の記録も取っていません。</strong>"
      "どのページを見られたかは、当方には分かりません。"
      "（<a href='spec.html'>この点は機械で検証しています</a>）</p>", "good")}""",
            eyebrow="個人情報の取り扱い", h="お預かりするものと、その使い道")
        + sec(f"""
{table(["お預かりするもの", "いただく場所", "使い道"], [
    ["お名前", "お問い合わせフォーム", "ご相談へのご返信"],
    ["お店・会社の名前", "お問い合わせフォーム", "ご相談へのご返信・お見積り"],
    ["業種", "お問い合わせフォーム", "お見積りの前提の確認"],
    ["お電話番号", "お問い合わせフォーム・お電話", "ご相談へのご返信"],
    ["メールアドレス", "お問い合わせフォーム・メール", "ご相談へのご返信"],
    ["ご相談の内容", "お問い合わせフォーム", "ご相談へのご返信・お見積り"],
], caption="必須は、お名前・お電話番号・ご相談の内容の3つだけです。"
   "メールアドレスは、いただければメールでもご返信します。")}""",
              tint=True, key="privacy.html", h="いただく情報")
        + sec(f"""
{table(["項目", "取り扱い"], [
    ["利用目的",
     "ご相談へのご返信、お見積りの作成、ご契約に至った場合の業務の遂行。"
     "<strong>これ以外には使いません。</strong>"],
    ["第三者への提供",
     "<strong>しません。</strong>名簿の売買・広告目的での共有は行いません。"],
    ["業務の委託",
     "お問い合わせフォームの送信・保管に外部のサービスを使う場合があります。"
     "その場合も、利用目的の範囲を超えて扱わせません。"],
    ["保管の期間",
     "ご契約に至らなかった場合は<strong>1年で削除します。</strong>"
     "ご契約中および契約終了後は、法令で定められた期間（帳簿等は7年）保管します。"],
    ["ご本人からのお求め",
     "内容の開示・訂正・削除・利用停止をお求めいただけます。"
     f"お電話（{e(C.TEL)}）かメール（{e(C.EMAIL)}）でご連絡ください。"
     f"{e(C.RESPONSE_PROMISE)}にご返信します。"],
    ["安全の管理",
     "お預かりした情報は、担当する2名以外がアクセスできない場所に保管します。"
     "端末には画面の自動ロックと暗号化を設定しています。"],
])}
{note("メールでお送りいただく場合のお願い",
      "<p>メールは、途中の経路で第三者に見られる可能性がゼロではありません。"
      "<strong>口座番号など、他人に知られて困る情報をメールでお送りになるのはお控えください。</strong>"
      "必要な場合は、お電話でお伺いします。</p>", "warn")}""",
              h="取り扱いの方針")
        + sec(f"""
{table(["", ""], [
    ["事業者", f"{e(C.LEGAL_NAME)}"],
    ["所在地", f"〒{e(C.POSTAL_CODE)} {e(C.ADDRESS_REGION)}{e(C.ADDRESS_CITY)}{e(C.ADDRESS_STREET)}"],
    ["お問い合わせ", f"{e(C.TEL)}（{e(C.TEL_HOURS)}）／ {e(C.EMAIL)}"],
    ["改定", "内容を変えたときは、このページに掲載した時点から適用します。"],
])}""", tint=True, h="お問い合わせ先"))
    return {
        "title": f"個人情報の取り扱い｜{BRAND_T}",
        "desc": "お預かりするのは、ご相談にお答えするために必要なものだけです。"
                "第三者には提供しません。このサイトはアクセス解析もCookieも使っていません。",
        "body": body,
    }


# ══════════════════════════════════════════════ 特定商取引法に基づく表記
def page_legal():
    bk = {p["key"]: p for p in P.BUILD}
    body = (
        sec(f"""<p class="lede">お申し込みの前にご確認ください。
        金額はすべて<strong>税別</strong>で表示しています。</p>
{table(["", ""], [
    ["販売事業者", f"{e(C.LEGAL_NAME)}"],
    ["運営責任者", f"{e(C.MEMBERS[0]['name'])}"],
    ["所在地", f"〒{e(C.POSTAL_CODE)} {e(C.ADDRESS_REGION)}{e(C.ADDRESS_CITY)}{e(C.ADDRESS_STREET)}"],
    ["電話番号", f"{e(C.TEL)}（{e(C.TEL_HOURS)}）"],
    ["メールアドレス", f"{e(C.EMAIL)}"],
    ["販売価格",
     f"ホームページ制作 {bk['basic']['price']:,}円〜{bk['pro']['price']:,}円（税別）／"
     f"運用 月{P.run('run_light')['price']:,}円〜{P.run('run_growth')['price']:,}円（税別）。"
     "<a href='price.html'>料金の詳細</a>"],
    ["商品代金以外の必要料金",
     "消費税、振込手数料、撮影で伺う際の交通費（実費）、"
     "ドメイン更新料およびサーバー費用（運用のご契約がない期間）。"],
    ["お支払い方法", "銀行振込（一括／分割）"],
    ["お支払いの時期",
     f"一括の場合は着手時に50%、納品時に50%。"
     f"分割の場合は着手時に初回分、以降は毎月{P.INSTALLMENT_COUNT}回。"
     "運用費は毎月末日締め、翌月末までのお支払い。"],
    ["役務の提供時期",
     f"ご契約から約{bk['basic']['weeks']}〜{bk['pro']['weeks']}週間"
     "（構成とお客様のご確認の速さによります）。"],
    ["返品・キャンセル",
     "役務の提供のため、返品はお受けできません。"
     "<strong>着手前のキャンセルは無償です。</strong>"
     "着手後の中止は、その時点までの作業分のみ精算します（違約金はありません）。"
     "<a href='terms.html'>詳しい条件</a>"],
    ["解約", f"運用は{e(P.RUN_TERM)}のご契約。次の期間の前にご連絡いただければ違約金はありません。"],
    ["動作環境",
     "各OSの最新版および1つ前のバージョンのブラウザ"
     "（Chrome・Safari・Edge・Firefox）。"],
])}""", h="特定商取引法に基づく表記"))
    return {
        "title": f"特定商取引法に基づく表記｜{BRAND_T}",
        "desc": "販売事業者、所在地、販売価格、お支払いの方法と時期、役務の提供時期、"
                "返品・キャンセルの取り扱いを記載しています。金額はすべて税別です。",
        "body": body,
    }


# ══════════════════════════════════════════════ build
def _plain(m):
    """ul.plain の各項目の先頭にチェックアイコンを入れる"""
    inner = re.sub(r"<li>(?!\s*<svg)", '<li>' + ic("check", "ic-sm") + '<span>', m.group(1))
    return '<ul class="plain">' + inner.replace("</li>", "</span></li>") + "</ul>"


def shell_body_only(fname, page):
    """Artifact 公開用。<!doctype>/<html>/<head>/<body> は公開側が付けるので、
       中身だけを出力する。<title> と <link>/<style> は先頭に置く。"""
    full = shell(fname, page)
    head = full.split("<body>", 1)[0]
    body = full.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    CLOSE = {"<title>": ("</title>", 8),
             '<script type="application/ld+json">': ("</script>", 9)}
    keep = []
    for tag in ("<title>", '<link rel="stylesheet"', '<script type="application/ld+json">'):
        i = 0
        while True:
            i = head.find(tag, i)
            if i < 0:
                break
            if tag in CLOSE:
                cl, n = CLOSE[tag]
                end = head.find(cl, i) + n
            else:
                end = head.find(">", i) + 1
            keep.append(head[i:end])
            i = end
    return "\n".join(keep) + "\n" + body


def build_css():
    """native/ の4ファイルを @layer 順に連結する。
       tokens.css は design.tokens.json からの生成物なので、同期していなければ止める。"""
    import subprocess
    r = subprocess.run(["node", str(NATIVE / "build-tokens.mjs"), "--check"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"tokens.css が design.tokens.json と一致しません。\n{r.stderr.strip()}\n"
                         f"  node native/build-tokens.mjs を実行してください。")
    return CSS_LAYERS + "\n".join((NATIVE / f).read_text(encoding="utf-8") for f in CSS_PARTS)


def main():
    css = build_css()
    PAGES["index.html"] = page_index()
    PAGES["owned.html"] = page_owned()
    PAGES["price.html"] = page_price()
    PAGES["unlimited.html"] = page_unlimited()
    PAGES["source.html"] = page_source()
    PAGES["cost-cut.html"] = page_costcut()
    PAGES["subsidy.html"] = page_subsidy()
    PAGES["spec.html"] = page_spec()
    PAGES["flow.html"] = page_flow()
    PAGES["works.html"] = page_works()
    PAGES["faq.html"] = page_faq()
    PAGES["about.html"] = page_about()
    PAGES["contact.html"] = page_contact()
    PAGES["terms.html"] = page_terms()
    PAGES["privacy.html"] = page_privacy()
    PAGES["legal.html"] = page_legal()
    for f in IND_DATA:
        PAGES[f] = page_industry(f)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / "theme.css").write_text(css, encoding="utf-8")
    shutil.copytree(NATIVE / "fonts", OUT / "fonts")
    if (NATIVE / "og").exists():
        shutil.copytree(NATIVE / "og", OUT / "og")
    else:
        print("！ native/og がありません。python make_og.py を実行してください")

    for fname, page in PAGES.items():
        page["body"] = ensure_h1(page["body"])
        (OUT / fname).write_text(shell(fname, page), encoding="utf-8")

    # 404。行き止まりにせず、電話とトップに戻す
    nf = {"title": f"ページが見つかりません｜{BRAND_T}",
          "desc": "お探しのページは移動したか、なくなっています。"
                  "トップページか、お電話からお探しの内容にお進みください。",
          "body": sec(f"""
<p class="lede">お探しのページは移動したか、なくなっています。<br>
   お急ぎでしたら、お電話が確実です。</p>
{cta("トップに戻る", "index.html")}""", h="ページが見つかりません")}
    nf["body"] = ensure_h1(nf["body"])
    (OUT / "404.html").write_text(shell("404.html", nf), encoding="utf-8")

    # robots.txt / sitemap.xml（llms.txt は作らない：根拠がないため）
    (OUT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: https://{C.DOMAIN}/sitemap.xml\n", encoding="utf-8")
    urls = "".join(f"  <url><loc>https://{C.DOMAIN}/{f}</loc></url>\n" for f in PAGES)
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}</urlset>\n", encoding="utf-8")

    # Artifact 公開用の出力（トップだけ body の中身のみ）
    art = OUT.parent / "dist-artifact"
    if art.exists():
        shutil.rmtree(art)
    art.mkdir(parents=True)
    (art / "theme.css").write_text(css, encoding="utf-8")
    shutil.copytree(NATIVE / "fonts", art / "fonts")
    if (NATIVE / "og").exists():
        shutil.copytree(NATIVE / "og", art / "og")
    for fname, page in PAGES.items():
        if fname == "index.html":
            (art / fname).write_text(shell_body_only(fname, page), encoding="utf-8")
        else:
            (art / fname).write_text(shell(fname, page), encoding="utf-8")
    (art / "404.html").write_text(shell("404.html", nf), encoding="utf-8")

    total = sum((OUT / f).stat().st_size for f in PAGES)
    print(f"built {len(PAGES)} pages -> {OUT}")
    print(f"total html {total/1024:.1f} KB / css {(OUT/'theme.css').stat().st_size/1024:.1f} KB")
    for f in sorted(PAGES):
        print(f"  {f:20s} {(OUT/f).stat().st_size/1024:6.1f} KB")


if __name__ == "__main__":
    main()
