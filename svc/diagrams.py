"""
図。どれも本文で説明している「仕組み」を置き換えるためのもので、飾りは入れない。

配色の方針：
- 構造線・文字・囲みは currentColor（不透明度で濃淡をつける）。
  これで明るい節・墨紺の節・ダークテーマのどこに置いても成立する。
- 意味を持つ色は3つだけ。var(--fig-accent)＝こちらが勧める側、var(--fig-ok)＝残るもの、
  var(--fig-bad)＝失われるもの。ブランド色と業務状態の色は分ける（原則E）。
- viewBox でサイズを決め、表示幅は CSS に任せる。
- role="img" と aria-label は必須（verify.py が検査する）。
"""

BOX_F = 'fill="currentColor" fill-opacity=".045"'
BOX_S = 'stroke="currentColor" stroke-width="1.4" stroke-opacity=".55"'
DIM = 'fill="currentColor" opacity=".72"'

DEFS = (
    '<defs>'
    '<marker id="dg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
    'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>'
    '<marker id="dg-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
    'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--fig-accent)"/></marker>'
    "</defs>"
)

_SEQ = [0]


def _fig(svg, caption, label, vb, narrow=None):
    """narrow に (svg, viewBox) を渡すと、狭い画面ではそちらを出す。
       縮小すると12pxの文字が6px相当になって読めないので、縮めずに組み直す。
       渡さない図（時間軸など、横であることに意味がある図）は横スクロールのまま。"""
    _SEQ[0] += 1
    n = _SEQ[0]

    def uniq(x):
        return x.replace("dg-a", f"dg-a{n}").replace("dg-p", f"dg-p{n}")

    wide = (f'<svg class="fw" role="img" aria-label="{label}" viewBox="{vb}">'
            f"{uniq(DEFS + svg)}</svg>")
    if narrow:
        nsvg, nvb = narrow
        _SEQ[0] += 1
        m = _SEQ[0]
        nu = (DEFS + nsvg).replace("dg-a", f"dg-a{m}").replace("dg-p", f"dg-p{m}")
        wide = (f'<svg class="fw" role="img" aria-label="{label}" viewBox="{vb}">'
                f"{uniq(DEFS + svg)}</svg>"
                f'<svg class="fn" role="img" aria-label="{label}" viewBox="{nvb}">{nu}</svg>')
    cls = "fig has-narrow" if narrow else "fig"
    hint = "" if narrow else '<p class="fig-hint" aria-hidden="true">指でヨコに動かせます</p>'
    return (f'<figure class="{cls}">{wide}{hint}'
            f"<figcaption>{caption}</figcaption></figure>")


def _box(x, y, w, h, title, sub="", accent=False):
    if accent:
        t = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="var(--fig-accent)" '
             f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>')
    else:
        t = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" {BOX_F} {BOX_S}/>'
    cx = x + w / 2
    if sub:
        t += (f'<text x="{cx}" y="{y + h / 2 - 3}" text-anchor="middle" font-size="15" '
              f'font-weight="700" fill="currentColor">{title}</text>'
              f'<text x="{cx}" y="{y + h / 2 + 18}" text-anchor="middle" font-size="12" '
              f"{DIM}>{sub}</text>")
    else:
        t += (f'<text x="{cx}" y="{y + h / 2 + 5}" text-anchor="middle" font-size="15" '
              f'font-weight="700" fill="currentColor">{title}</text>')
    return t


def _arrow(x1, y, x2, label, accent=False, dy=11):
    col, mk = ("var(--fig-accent)", "dg-p") if accent else ("currentColor", "dg-a")
    return (f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{col}" stroke-width="1.6" '
            f'marker-end="url(#{mk})"/>'
            f'<text x="{(x1 + x2) / 2}" y="{y - dy}" text-anchor="middle" font-size="12" '
            f"{DIM}>{label}</text>")


def _cap(x, y, t):
    return f'<text x="{x}" y="{y}" font-size="12" font-weight="700" {DIM}>{t}</text>'


# ═════════════════════════════════ 1. 借りている場所 / 自分の場所
def rent_vs_own(portal=27_500, fee=220, run=16_000):
    s = [
        _cap(0, 16, "いま ── 借りている場所を通す"),
        _box(0, 32, 124, 66, "お客様", "検索する人"),
        _arrow(130, 65, 248, f"掲載料 月{portal:,}円"),
        _box(254, 28, 212, 74, "ポータルサイト", "借りている場所"),
        _arrow(472, 65, 590, f"予約1件ごと {fee}円", dy=25),
        _box(596, 32, 124, 66, "お店"),
        # 解約したら切れる場所
        '<line x1="530" y1="48" x2="530" y2="118" stroke="var(--fig-bad)" stroke-width="1.5" '
        'stroke-dasharray="5 5"/>',
        '<path d="M522 56 L538 72 M538 56 L522 72" stroke="var(--fig-bad)" stroke-width="2.4" '
        'stroke-linecap="round"/>',
        '<text x="530" y="134" text-anchor="middle" font-size="12" font-weight="700" '
        'fill="var(--fig-bad)">掲載をやめた日に、ここが切れます</text>',

        _cap(0, 188, "これから ── 自分の場所を通す"),
        _box(0, 204, 124, 66, "お客様", "検索する人"),
        _arrow(130, 237, 248, f"運用費 月{run:,}円", accent=True),
        _box(254, 200, 212, 74, "自分のサイト", "お客様の資産", accent=True),
        _arrow(472, 237, 590, "手数料 0円", accent=True),
        _box(596, 204, 124, 66, "お店"),
        '<text x="361" y="302" text-anchor="middle" font-size="12" font-weight="700" '
        'fill="var(--fig-ok)">やめても残ります。ドメインも中身も、最初からお客様の名義</text>',
    ]
    return _fig(
        "".join(s),
        "ポータル経由は掲載料と1件ごとの手数料がかかり、掲載をやめた日に流入が止まります。"
        "自分のサイトは運用費だけで、やめても残ります。",
        f"上下2段の流れ図。上段はお客様からポータルサイトを経由してお店へ。掲載料が月{portal:,}円、"
        f"予約1件ごとに{fee}円かかり、掲載をやめるとお客様からの経路が切れる。"
        f"下段はお客様から自分のサイトを経由してお店へ。運用費が月{run:,}円だけで手数料はゼロ、"
        "やめてもサイトは残る。",
        "0 0 722 312",
        narrow=rent_vs_own_narrow(portal, fee, run))


# ═════════════════════════════════ 2. 掲載費の振替
def money_flow(portal=27_500, run=16_000):
    rest = portal - run
    x, w = 78, 602
    w1 = round(w * run / portal)
    s = [
        _cap(0, 58, "いま"),
        f'<rect x="{x}" y="26" width="{w}" height="50" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{x + w / 2}" y="57" text-anchor="middle" font-size="15" font-weight="700" '
        f'fill="currentColor">食べログ ベーシック　月{portal:,}円</text>',

        f'<line x1="{x + w / 2}" y1="84" x2="{x + w / 2}" y2="112" stroke="var(--fig-accent)" '
        f'stroke-width="1.6" marker-end="url(#dg-p)"/>',
        f'<text x="{x + w / 2 + 12}" y="106" font-size="12" {DIM}>'
        "無料プランに戻す（ネット予約はそのまま使えます）</text>",

        _cap(0, 156, "これから"),
        f'<rect x="{x}" y="124" width="{w1 - 5}" height="50" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{x + w1 / 2 - 2}" y="155" text-anchor="middle" font-size="15" '
        f'font-weight="700" fill="currentColor">運用費 {run:,}円</text>',
        f'<rect x="{x + w1}" y="124" width="{w - w1}" height="50" rx="8" fill="var(--fig-ok)" '
        f'fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>',
        f'<text x="{x + w1 + (w - w1) / 2}" y="155" text-anchor="middle" font-size="15" '
        f'font-weight="700" fill="var(--fig-ok)">手残り {rest:,}円</text>',
    ]
    return _fig(
        "".join(s),
        f"掲載料を無料プランに戻すと、運用費{run:,}円をお支払いいただいても"
        f"なお毎月{rest:,}円が残ります（プランと契約更新月によります）。",
        f"帯グラフ。上段は食べログのベーシックプラン月{portal:,}円。"
        f"下段はそれが運用費{run:,}円と手残り{rest:,}円に分かれた状態。",
        "0 0 700 192",
        narrow=money_flow_narrow(portal, run))


# ═════════════════════════════════ 3. 24か月払ったあとに何が残るか
def after_two_years(rival_m, ours_init, ours_m, months=24):
    rival_total = rival_m * months
    ours_total = ours_init + ours_m * months
    x0, x1 = 104, 516
    s = []
    for i, lab in [(0, "ご契約"), (12, "1年"), (months, f"{months // 12}年")]:
        px = x0 + (x1 - x0) * i / months
        s.append(f'<line x1="{px}" y1="24" x2="{px}" y2="246" stroke="currentColor" '
                 f'stroke-width="1" stroke-dasharray="3 5" opacity=".3"/>')
        s.append(f'<text x="{px}" y="266" text-anchor="middle" font-size="12" {DIM}>{lab}</text>')

    s += [
        '<text x="0" y="58" font-size="13" font-weight="700" fill="currentColor">'
        "他社の月額制</text>",
        f'<text x="0" y="76" font-size="11.5" {DIM}>5ページ</text>',
        f'<rect x="{x0}" y="40" width="{x1 - x0}" height="46" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{(x0 + x1) / 2}" y="69" text-anchor="middle" font-size="13.5" '
        f'fill="currentColor">月{rival_m:,}円 × {months}か月 ＝ {rival_total:,}円</text>',
        f'<path d="M{x1 + 14} 54 L{x1 + 31} 71 M{x1 + 31} 54 L{x1 + 14} 71" '
        f'stroke="var(--fig-bad)" stroke-width="2.6" stroke-linecap="round"/>',
        f'<text x="{x1 + 42}" y="59" font-size="12.5" font-weight="700" fill="var(--fig-bad)">'
        "解約するとサイトは</text>",
        f'<text x="{x1 + 42}" y="77" font-size="12.5" font-weight="700" fill="var(--fig-bad)">'
        "消えます</text>",

        '<text x="0" y="170" font-size="13" font-weight="700" fill="currentColor">当方</text>',
        f'<text x="0" y="188" font-size="11.5" {DIM}>9ページ</text>',
        f'<rect x="{x0}" y="152" width="{x1 - x0}" height="46" rx="8" fill="var(--fig-accent)" '
        f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>',
        f'<text x="{(x0 + x1) / 2}" y="181" text-anchor="middle" font-size="13.5" '
        f'fill="currentColor">初回{ours_init:,}円＋月{ours_m:,}円×{months}か月 ＝ '
        f"{ours_total:,}円</text>",
        f'<path d="M{x1 + 15} 172 l7 8 l13 -15" fill="none" stroke="var(--fig-ok)" '
        f'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
        f'<text x="{x1 + 42}" y="171" font-size="12.5" font-weight="700" fill="var(--fig-ok)">'
        "サイトはお客様のもの</text>",
        f'<text x="{x1 + 42}" y="189" font-size="12.5" font-weight="700" fill="var(--fig-ok)">'
        "以降は運用費だけ</text>",
        f'<line x1="{x1}" y1="198" x2="{x1}" y2="226" stroke="var(--fig-ok)" stroke-width="1.4"/>',
        f'<text x="{x1 - 8}" y="222" text-anchor="end" font-size="12" {DIM}>'
        "制作費のお支払いはここで終わり</text>",
    ]
    return _fig(
        "".join(s),
        f"同じ{months}か月を払ったあと、片方はサイトが消え、片方はお客様のものになります。"
        "他社の条件は各社が公開している情報から（2026年9月時点）。",
        f"{months}か月の時間軸に2本の帯。他社の月額制は月{rival_m:,}円かける{months}か月で"
        f"{rival_total:,}円、解約するとサイトが消える。当方は初回{ours_init:,}円と"
        f"月{ours_m:,}円かける{months}か月で{ours_total:,}円、"
        f"{months}か月後にサイトはお客様のものになり、制作費の支払いは終わって運用費だけになる。",
        "0 0 722 282",
        narrow=after_two_years_narrow(rival_m, ours_init, ours_m, months))


# ═════════════════════════════════ 4. 補助金の内訳
def subsidy_bar(total, web, pr, grant, net):
    w = 700
    ww = round(w * web / total)
    gw = round(w * grant / total)
    s = [
        _cap(0, 14, f"かかる費用 {total:,}円"),
        f'<rect x="0" y="26" width="{ww - 5}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{ww / 2 - 2}" y="50" text-anchor="middle" font-size="13" font-weight="700" '
        f'fill="currentColor">ホームページ</text>',
        f'<text x="{ww / 2 - 2}" y="68" text-anchor="middle" font-size="12" {DIM}>{web:,}円</text>',
        f'<rect x="{ww}" y="26" width="{w - ww}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{ww + (w - ww) / 2}" y="50" text-anchor="middle" font-size="13" '
        f'font-weight="700" fill="currentColor">チラシ・看板・撮影</text>',
        f'<text x="{ww + (w - ww) / 2}" y="68" text-anchor="middle" font-size="12" {DIM}>'
        f"{pr:,}円</text>",

        f'<line x1="{w / 2}" y1="86" x2="{w / 2}" y2="110" stroke="currentColor" '
        f'stroke-width="1.6" marker-end="url(#dg-a)"/>',

        _cap(0, 136, "採択された場合"),
        f'<rect x="0" y="148" width="{gw - 5}" height="52" rx="7" fill="var(--fig-ok)" '
        f'fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>',
        f'<text x="{gw / 2 - 2}" y="172" text-anchor="middle" font-size="13" font-weight="700" '
        f'fill="var(--fig-ok)">補助金</text>',
        f'<text x="{gw / 2 - 2}" y="190" text-anchor="middle" font-size="12" '
        f'fill="var(--fig-ok)">{grant:,}円</text>',
        f'<rect x="{gw}" y="148" width="{w - gw}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{gw + (w - gw) / 2}" y="172" text-anchor="middle" font-size="13" '
        f'font-weight="700" fill="currentColor">ご負担</text>',
        f'<text x="{gw + (w - gw) / 2}" y="190" text-anchor="middle" font-size="12" '
        f'font-weight="700" fill="currentColor">{net:,}円</text>',
    ]
    return _fig(
        "".join(s),
        f"ホームページ単独では申請できないので、チラシ・看板・撮影とまとめて{total:,}円で組みます。"
        f"採択された場合のご負担は{net:,}円です。",
        f"2段の帯グラフ。上段は費用{total:,}円の内訳で、ホームページ{web:,}円と"
        f"チラシ・看板・撮影{pr:,}円。下段は同じ幅を補助金{grant:,}円とご負担{net:,}円に分けた比率。",
        "0 0 700 208",
        narrow=subsidy_bar_narrow(total, web, pr, grant, net))


# ═════════════════════════════════ 5. 補助金の順序（交付決定の前に着手しない）
def subsidy_timeline(form4_deadline, deadline):
    """順序を間違えると全額が対象外になる。そこだけを図にする。
       日付は図では短縮し、正確な表記は figcaption と本文が持つ。"""
    import re as _re

    def short(d):
        m = _re.search(r"(\d+)月(\d+)日", d)
        return f"{m.group(1)}/{m.group(2)}" if m else d

    y, bh = 96, 44
    steps = [
        (0, 150, "商工会へ", f"様式4 {short(form4_deadline)}まで"),
        (164, 140, "申請", f"{short(deadline)}まで"),
        (318, 134, "交付決定", "待つ"),
        (482, 140, "契約・着手", "ここから"),
        (638, 132, "報告・入金", "精算払い"),
    ]
    s = []
    for i, (x, w, t, sub) in enumerate(steps):
        acc = i >= 3
        if acc:
            s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{bh}" rx="8" '
                     f'fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" '
                     f'stroke-width="2"/>')
        else:
            s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{bh}" rx="8" {BOX_F} {BOX_S}/>')
        s.append(f'<text x="{x + w / 2}" y="{y + 20}" text-anchor="middle" font-size="14" '
                 f'font-weight="700" fill="currentColor">{t}</text>')
        s.append(f'<text x="{x + w / 2}" y="{y + 36}" text-anchor="middle" font-size="11.5" '
                 f"{DIM}>{sub}</text>")
        if i < len(steps) - 1:
            nx = steps[i + 1][0]
            s.append(f'<line x1="{x + w + 3}" y1="{y + bh / 2}" x2="{nx - 4}" y2="{y + bh / 2}" '
                     f'stroke="currentColor" stroke-width="1.4" marker-end="url(#dg-a)"/>')

    # 交付決定と着手のあいだが、越えてはいけない線
    gx = 474
    s.append(f'<line x1="{gx}" y1="46" x2="{gx}" y2="196" stroke="var(--fig-bad)" '
             f'stroke-width="2" stroke-dasharray="6 5"/>')
    s.append(f'<text x="{gx - 10}" y="40" text-anchor="end" font-size="12.5" font-weight="700" '
             f'fill="var(--fig-bad)">この線より前に発注・契約・着手すると</text>')
    s.append(f'<text x="{gx - 10}" y="58" text-anchor="end" font-size="12.5" font-weight="700" '
             f'fill="var(--fig-bad)">全額が対象外になります</text>')
    s.append(f'<text x="{gx + 10}" y="186" font-size="12.5" font-weight="700" '
             f'fill="var(--fig-ok)">契約書の日付も、交付決定日より後にします</text>')
    return _fig(
        "".join(s),
        f"様式4は{form4_deadline}まで、申請は{deadline}まで。"
        "順序さえ守れば難しくありませんが、守らないと全額が対象外になります。",
        f"補助金の手順を左から右に並べた図。商工会で様式4を{form4_deadline}までに取り、"
        f"{deadline}までに申請し、交付決定を待つ。交付決定より前に発注・契約・着手すると"
        "全額が対象外になる。決定後に契約・着手し、報告して精算払いで入金される。",
        "0 0 776 206",
        narrow=subsidy_timeline_narrow(form4_deadline, deadline))


# ══════════════════════════════════════════════════════════════════
# スマホ用の組み直し
# 横長の図を縮小すると12pxの文字が6px相当になって読めない。かといって毎回
# 指で引かせるのも負担なので、すべての図にスマホ用の形を用意する。
# 時間軸の図も例外にしない（実測で 8px 相当まで縮んでいた。下のコメントを参照）。
# ══════════════════════════════════════════════════════════════════
NW = 340        # スマホ用の幅


def _vbox(y, h, title, sub="", accent=False):
    """幅いっぱいの箱。縦積み用"""
    if accent:
        t = (f'<rect x="0" y="{y}" width="{NW}" height="{h}" rx="8" fill="var(--fig-accent)" '
             f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>')
    else:
        t = f'<rect x="0" y="{y}" width="{NW}" height="{h}" rx="8" {BOX_F} {BOX_S}/>'
    cx = NW / 2
    if sub:
        t += (f'<text x="{cx}" y="{y + h / 2 - 3}" text-anchor="middle" font-size="15" '
              f'font-weight="700" fill="currentColor">{title}</text>'
              f'<text x="{cx}" y="{y + h / 2 + 17}" text-anchor="middle" font-size="12" '
              f"{DIM}>{sub}</text>")
    else:
        t += (f'<text x="{cx}" y="{y + h / 2 + 5}" text-anchor="middle" font-size="15" '
              f'font-weight="700" fill="currentColor">{title}</text>')
    return t


def _vdown(y1, y2, label, accent=False, x=44, ly=None):
    """下向きの矢印＋右に添えるラベル。ly でラベルの高さをずらせる"""
    col, mk = ("var(--fig-accent)", "dg-p") if accent else ("currentColor", "dg-a")
    return (f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="{col}" stroke-width="1.6" '
            f'marker-end="url(#{mk})"/>'
            f'<text x="{x + 14}" y="{ly if ly else (y1 + y2) / 2 + 4}" font-size="12" '
            f"{DIM}>{label}</text>")


def rent_vs_own_narrow(portal=27_500, fee=220, run=16_000):
    s = [
        _cap(0, 12, "いま ── 借りている場所を通す"),
        _vbox(24, 54, "お客様", ""),
        _vdown(86, 122, f"掲載料 月{portal:,}円"),
        _vbox(130, 58, "ポータルサイト", "借りている場所"),
        _vdown(196, 244, f"予約1件ごと {fee}円", ly=208),
        # 掲載をやめると、ここで切れる。ラベルと重ならない高さに引く
        f'<line x1="14" y1="228" x2="{NW - 14}" y2="228" stroke="var(--fig-bad)" '
        f'stroke-width="1.5" stroke-dasharray="5 5"/>',
        '<path d="M36 220 L52 236 M52 220 L36 236" stroke="var(--fig-bad)" stroke-width="2.4" '
        'stroke-linecap="round"/>',
        f'<text x="{NW}" y="264" text-anchor="end" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-bad)">掲載をやめた日に、ここが切れます</text>',
        _vbox(276, 50, "お店"),

        _cap(0, 368, "これから ── 自分の場所を通す"),
        _vbox(380, 54, "お客様", ""),
        _vdown(442, 478, f"運用費 月{run:,}円", accent=True),
        _vbox(486, 58, "自分のサイト", "お客様の資産", accent=True),
        _vdown(552, 588, "手数料 0円", accent=True),
        _vbox(600, 50, "お店"),
        f'<text x="{NW / 2}" y="674" text-anchor="middle" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-ok)">やめても残ります。中身もドメインもお客様の名義</text>',
    ]
    return "".join(s), f"0 0 {NW} 684"


def money_flow_narrow(portal=27_500, run=16_000):
    rest = portal - run
    w1 = round(NW * run / portal)
    s = [
        _cap(0, 12, "いま"),
        f'<rect x="0" y="22" width="{NW}" height="48" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{NW / 2}" y="52" text-anchor="middle" font-size="14" font-weight="700" '
        f'fill="currentColor">食べログ ベーシック 月{portal:,}円</text>',
        f'<line x1="{NW / 2}" y1="78" x2="{NW / 2}" y2="108" stroke="var(--fig-accent)" '
        f'stroke-width="1.6" marker-end="url(#dg-p)"/>',
        f'<text x="{NW / 2}" y="130" text-anchor="middle" font-size="12.5" {DIM}>'
        "無料プランに戻す（ネット予約は使えます）</text>",
        _cap(0, 158, "これから"),
        f'<rect x="0" y="168" width="{w1 - 4}" height="48" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{w1 / 2 - 2}" y="190" text-anchor="middle" font-size="12.5" '
        f'font-weight="700" fill="currentColor">運用費</text>',
        f'<text x="{w1 / 2 - 2}" y="206" text-anchor="middle" font-size="12.5" '
        f'font-weight="700" fill="currentColor">{run:,}円</text>',
        f'<rect x="{w1}" y="168" width="{NW - w1}" height="48" rx="8" fill="var(--fig-ok)" '
        f'fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>',
        f'<text x="{w1 + (NW - w1) / 2}" y="190" text-anchor="middle" font-size="12.5" '
        f'font-weight="700" fill="var(--fig-ok)">手残り</text>',
        f'<text x="{w1 + (NW - w1) / 2}" y="206" text-anchor="middle" font-size="12.5" '
        f'font-weight="700" fill="var(--fig-ok)">{rest:,}円</text>',
    ]
    return "".join(s), f"0 0 {NW} 226"


def subsidy_bar_narrow(total, web, pr, grant, net):
    ww = round(NW * web / total)
    gw = round(NW * grant / total)
    s = [
        _cap(0, 12, f"かかる費用 {total:,}円"),
        f'<rect x="0" y="22" width="{ww - 4}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{ww / 2 - 2}" y="44" text-anchor="middle" font-size="12" font-weight="700" '
        f'fill="currentColor">ホームページ</text>',
        f'<text x="{ww / 2 - 2}" y="62" text-anchor="middle" font-size="12.5" {DIM}>{web:,}円</text>',
        f'<rect x="{ww}" y="22" width="{NW - ww}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{ww + (NW - ww) / 2}" y="44" text-anchor="middle" font-size="12" '
        f'font-weight="700" fill="currentColor">チラシ・看板</text>',
        f'<text x="{ww + (NW - ww) / 2}" y="62" text-anchor="middle" font-size="12.5" {DIM}>'
        f"{pr:,}円</text>",
        f'<line x1="{NW / 2}" y1="82" x2="{NW / 2}" y2="106" stroke="currentColor" '
        f'stroke-width="1.6" marker-end="url(#dg-a)"/>',
        _cap(0, 132, "採択された場合"),
        f'<rect x="0" y="142" width="{gw - 4}" height="52" rx="7" fill="var(--fig-ok)" '
        f'fill-opacity=".11" stroke="var(--fig-ok)" stroke-width="1.6"/>',
        f'<text x="{gw / 2 - 2}" y="164" text-anchor="middle" font-size="12" font-weight="700" '
        f'fill="var(--fig-ok)">補助金</text>',
        f'<text x="{gw / 2 - 2}" y="182" text-anchor="middle" font-size="12.5" '
        f'fill="var(--fig-ok)">{grant:,}円</text>',
        f'<rect x="{gw}" y="142" width="{NW - gw}" height="52" rx="7" {BOX_F} {BOX_S}/>',
        f'<text x="{gw + (NW - gw) / 2}" y="164" text-anchor="middle" font-size="12" '
        f'font-weight="700" fill="currentColor">ご負担</text>',
        f'<text x="{gw + (NW - gw) / 2}" y="182" text-anchor="middle" font-size="12.5" '
        f'font-weight="700" fill="currentColor">{net:,}円</text>',
    ]
    return "".join(s), f"0 0 {NW} 204"


# ══════════════════════════════════════════════════════════════════
# 借地と所有。サイトでいちばん強く言いたいことなので、図も主役に置く。
# 建物（作るもの）は左右で同じにしてある。違うのは土地の名義と、やめたあと。
# ══════════════════════════════════════════════════════════════════
def _land_panel(x0, w, cap, ground_sub, res_title, res_sub, ok,
                y_cap=14, y_bld=28, h_bld=64, y_gnd=100, h_gnd=42,
                y_a1=150, y_a2=186, y_res=196, h_res=68, inset=30):
    col = "var(--fig-ok)" if ok else "var(--fig-bad)"
    cx = x0 + w / 2
    bx, bw = x0 + inset, w - inset * 2
    s = [
        _cap(x0, y_cap, cap),
        # 建物＝作るもの。左右で同じ
        f'<rect x="{bx}" y="{y_bld}" width="{bw}" height="{h_bld}" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{cx}" y="{y_bld + 26}" text-anchor="middle" font-size="14" font-weight="700" '
        f'fill="currentColor">ページ・写真・原稿</text>',
        f'<text x="{cx}" y="{y_bld + 46}" text-anchor="middle" font-size="12.5" {DIM}>'
        "あなたが費用を出したもの</text>",
        # 土地＝ドメインとサーバー
        f'<rect x="{x0}" y="{y_gnd}" width="{w}" height="{h_gnd}" rx="6" {BOX_F} {BOX_S}/>',
        f'<text x="{cx}" y="{y_gnd + 20}" text-anchor="middle" font-size="13" font-weight="700" '
        f'fill="currentColor">土地 ＝ ドメインとサーバー</text>',
        f'<text x="{cx}" y="{y_gnd + 36}" text-anchor="middle" font-size="12.5" {DIM}>'
        f"{ground_sub}</text>",
        # 解約
        f'<line x1="{cx}" y1="{y_a1}" x2="{cx}" y2="{y_a2}" stroke="currentColor" '
        f'stroke-width="1.6" marker-end="url(#dg-a)"/>',
        f'<text x="{cx + 13}" y="{(y_a1 + y_a2) / 2 + 4}" font-size="12" {DIM}>解約した日</text>',
        # 残るもの
        f'<rect x="{x0}" y="{y_res}" width="{w}" height="{h_res}" rx="8" fill="{col}" '
        f'fill-opacity=".10" stroke="{col}" stroke-width="1.8"'
        + ("" if ok else ' stroke-dasharray="6 4"') + "/>",
        f'<text x="{cx}" y="{y_res + 28}" text-anchor="middle" font-size="14.5" '
        f'font-weight="700" fill="{col}">{res_title}</text>',
        f'<text x="{cx}" y="{y_res + 50}" text-anchor="middle" font-size="12.5" '
        f'fill="{col}">{res_sub}</text>',
    ]
    return "".join(s)


def land_vs_own():
    w = 340
    s = (
        _land_panel(
            0, w, "いま ── 借りた土地に建てる",
            "制作会社の名義になっていることがあります",
            "手元に残るもの ── なし", "URLも中身も写真も、使えなくなります", ok=False)
        + _land_panel(
            382, w, "紬 ── 自分の土地に建てる",
            "初日からお客様の名義で取得します",
            "手元に残るもの ── 全部", "ドメイン・ソースコード・写真。他社にも渡せます", ok=True)
    )
    return _fig(
        s,
        "建てるものは同じです。違うのは土地の名義と、やめたあとに何が手元に残るかだけです。",
        "左右2つの比較図。左は借りた土地に建てる場合で、ページ・写真・原稿の下にある土地"
        "（ドメインとサーバー）が制作会社の名義になっており、解約した日に手元に残るものはない。"
        "右は紬の場合で、同じものを建てるが土地は初日からお客様の名義なので、"
        "解約してもドメイン・ソースコード・写真のすべてが手元に残り、他社にも渡せる。",
        "0 0 722 276",
        narrow=land_vs_own_narrow())


def land_vs_own_narrow():
    ys = dict(y_cap=12, y_bld=24, h_bld=60, y_gnd=92, h_gnd=40,
              y_a1=140, y_a2=176, y_res=184, h_res=66, inset=24)
    ys2 = {k: (v + 282 if k.startswith("y_") else v) for k, v in ys.items()}
    s = (
        _land_panel(0, NW, "いま ── 借りた土地に建てる",
                    "制作会社の名義のことがあります",
                    "残るもの ── なし", "URLも中身も写真も使えません", ok=False, **ys)
        + _land_panel(0, NW, "紬 ── 自分の土地に建てる",
                      "初日からお客様の名義で取得",
                      "残るもの ── 全部", "ドメイン・ソース・写真。他社にも渡せます", ok=True, **ys2)
    )
    return s, f"0 0 {NW} 542"


# ══════════════════════════════════════════════════════════════════
# 時間軸の図のスマホ版。
# 「横であることに意味がある」からと横スクロールのままにしていたが、実測すると
# 722〜776 の viewBox が 480px に縮んで、12の文字が 8px 相当になっていた。
# 8px は読めない。読めない軸より、読める並びのほうが情報が伝わるので、
# 時間は上から下へ流す形に組み直す。
# ══════════════════════════════════════════════════════════════════
def after_two_years_narrow(rival_m, ours_init, ours_m, months=24):
    rival_total = rival_m * months
    ours_total = ours_init + ours_m * months
    s = [
        _cap(0, 14, f"{months}か月ぶんを払ったあと"),

        f'<rect x="0" y="26" width="{NW}" height="96" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="16" y="50" font-size="14" font-weight="700" fill="currentColor">'
        "他社の月額制（5ページ）</text>",
        f'<text x="16" y="74" font-size="13.5" fill="currentColor">'
        f"月{rival_m:,}円 × {months}か月 ＝ {rival_total:,}円</text>",
        '<path d="M18 94 L32 108 M32 94 L18 108" stroke="var(--fig-bad)" stroke-width="2.6" '
        'stroke-linecap="round"/>',
        f'<text x="42" y="106" font-size="13" font-weight="700" fill="var(--fig-bad)">'
        "解約するとサイトは消えます</text>",

        f'<rect x="0" y="140" width="{NW}" height="118" rx="8" fill="var(--fig-accent)" '
        f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>',
        f'<text x="16" y="164" font-size="14" font-weight="700" fill="currentColor">'
        "紬（9ページ）</text>",
        f'<text x="16" y="188" font-size="13.5" fill="currentColor">'
        f"初回{ours_init:,}円＋月{ours_m:,}円×{months}か月</text>",
        f'<text x="16" y="208" font-size="13.5" fill="currentColor">＝ {ours_total:,}円</text>',
        '<path d="M18 224 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" stroke-width="2.6" '
        'stroke-linecap="round" stroke-linejoin="round"/>',
        f'<text x="42" y="232" font-size="13" font-weight="700" fill="var(--fig-ok)">'
        "サイトはお客様のもの</text>",
        f'<text x="42" y="250" font-size="13" font-weight="700" fill="var(--fig-ok)">'
        "以降は運用費だけ</text>",
    ]
    return "".join(s), f"0 0 {NW} 268"


def subsidy_timeline_narrow(form4_deadline, deadline):
    import re as _re

    def short(d):
        m = _re.search(r"(\d+)月(\d+)日", d)
        return f"{m.group(1)}/{m.group(2)}" if m else d

    steps = [
        ("商工会へ", f"様式4 {short(form4_deadline)}まで", False),
        ("申請", f"{short(deadline)}まで", False),
        ("交付決定", "待つ", False),
        ("契約・着手", "ここから", True),
        ("報告・入金", "精算払い", True),
    ]
    h, gap = 52, 22
    s = [_cap(0, 14, "上から下へ。順番を入れ替えられません")]
    y = 26
    ys = []
    for t, sub, acc in steps:
        ys.append(y)
        if acc:
            s.append(f'<rect x="0" y="{y}" width="{NW}" height="{h}" rx="8" '
                     f'fill="var(--fig-accent)" fill-opacity=".08" stroke="var(--fig-accent)" '
                     f'stroke-width="2"/>')
        else:
            s.append(f'<rect x="0" y="{y}" width="{NW}" height="{h}" rx="8" {BOX_F} {BOX_S}/>')
        s.append(f'<text x="16" y="{y + 22}" font-size="14" font-weight="700" '
                 f'fill="currentColor">{t}</text>')
        s.append(f'<text x="16" y="{y + 40}" font-size="12.5" {DIM}>{sub}</text>')
        y += h + gap
    # 3つめ（交付決定）と4つめ（契約・着手）のあいだが、越えてはいけない線
    gy = ys[3] - gap / 2
    s.append(f'<line x1="0" y1="{gy}" x2="{NW}" y2="{gy}" stroke="var(--fig-bad)" '
             f'stroke-width="2" stroke-dasharray="6 5"/>')
    s.append(f'<text x="0" y="{gy - 6}" font-size="12.5" font-weight="700" '
             f'fill="var(--fig-bad)">この線より前に契約・着手すると全額が対象外</text>')
    # 矢印は箱のすき間に、線と重ならない側だけ引く
    for i in range(len(steps) - 1):
        if i == 2:
            continue
        y1 = ys[i] + h + 3
        s.append(f'<line x1="20" y1="{y1}" x2="20" y2="{ys[i + 1] - 4}" stroke="currentColor" '
                 f'stroke-width="1.6" marker-end="url(#dg-a)"/>')
    s.append(f'<text x="{NW}" y="{y + 6}" text-anchor="end" font-size="12.5" font-weight="700" '
             f'fill="var(--fig-ok)">契約書の日付も、交付決定日より後に</text>')
    return "".join(s), f"0 0 {NW} {y + 16}"


# ══════════════════════════════════════════════════════════════════
# 同じ「36か月」、意味が正反対。
# 月額制は36か月“払い切って”ようやく譲渡。こちらは0か月目に渡している。
# 数字が同じだからこそ並べる価値がある図。
# ══════════════════════════════════════════════════════════════════
def _flag(x, y, label, ok=True):
    col = "var(--fig-ok)" if ok else "var(--fig-bad)"
    return (f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y - 26}" stroke="{col}" stroke-width="2.4"/>'
            f'<path d="M{x} {y - 26} L{x + 22} {y - 20} L{x} {y - 14} z" fill="{col}"/>'
            f'<circle cx="{x}" cy="{y}" r="4.5" fill="{col}"/>')


def ownership_clock(sub_monthly, sub_total, our_price, our_run, months=36):
    x0, x1 = 116, 646
    def mx(m):
        return x0 + (x1 - x0) * m / months
    s = []
    # 目盛り
    for m, lab in [(0, "ご契約"), (12, "1年"), (months, f"{months}か月")]:
        s.append(f'<line x1="{mx(m)}" y1="30" x2="{mx(m)}" y2="252" stroke="currentColor" '
                 f'stroke-width="1" stroke-dasharray="3 5" opacity=".28"/>')
        s.append(f'<text x="{mx(m)}" y="272" text-anchor="middle" font-size="12.5" '
                 f"{DIM}>{lab}</text>")

    # ── 月額制
    s += [
        '<text x="0" y="58" font-size="13.5" font-weight="700" fill="currentColor">月額制</text>',
        f'<text x="0" y="77" font-size="12" {DIM}>払い終えるまで</text>',
        f'<rect x="{x0}" y="42" width="{x1 - x0}" height="44" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="{(x0 + x1) / 2}" y="70" text-anchor="middle" font-size="13.5" '
        f'fill="currentColor">月{sub_monthly:,}円 × {months}か月 ＝ {sub_total:,}円</text>',
        _flag(x1, 42, "", ok=True),
        f'<text x="{x1 - 6}" y="24" text-anchor="end" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-ok)">ここで、やっと譲渡</text>',
        # 途中で降りた場合
        f'<path d="M{mx(12) - 8} 98 L{mx(12) + 8} 114 M{mx(12) + 8} 98 L{mx(12) - 8} 114" '
        f'stroke="var(--fig-bad)" stroke-width="2.4" stroke-linecap="round"/>',
        f'<text x="{mx(12) + 18}" y="112" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-bad)">ここで降りると、サイトは非公開</text>',
    ]

    # ── こちら
    s += [
        '<text x="0" y="176" font-size="13.5" font-weight="700" fill="currentColor">紬</text>',
        f'<text x="0" y="195" font-size="12" {DIM}>初日から</text>',
        _flag(x0, 160, "", ok=True),
        f'<text x="{x0 + 28}" y="142" font-size="12.5" font-weight="700" fill="var(--fig-ok)">'
        "ここで、もうお客様のもの</text>",
        f'<rect x="{x0}" y="160" width="{x1 - x0}" height="44" rx="8" fill="var(--fig-accent)" '
        f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>',
        f'<text x="{(x0 + x1) / 2}" y="188" text-anchor="middle" font-size="13.5" '
        f'fill="currentColor">買い切り{our_price:,}円 ＋ 運用 月{our_run:,}円（いつでもやめられます）</text>',
        f'<path d="M{mx(12) - 7} 222 l6 7 l12 -14" fill="none" stroke="var(--fig-ok)" '
        f'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
        f'<text x="{mx(12) + 18}" y="230" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-ok)">ここで降りても、サイトは残る</text>',
    ]
    return _fig(
        "".join(s),
        f"同じ{months}か月でも、所有が移る時点が正反対です。"
        "月額制は払い終えたときに渡り、こちらは最初に渡します。"
        "だから途中でやめたときの結果が変わります。",
        f"2段の時間軸。上段は月額制で、月{sub_monthly:,}円を{months}か月払い終えた時点で"
        "ようやく譲渡され、途中で解約するとサイトは非公開になる。"
        f"下段は紬で、契約初日にサイトがお客様のものになり、運用費は途中でやめてもサイトは残る。",
        "0 0 722 288",
        narrow=ownership_clock_narrow(sub_monthly, sub_total, our_price, our_run, months))


def ownership_clock_narrow(sub_monthly, sub_total, our_price, our_run, months=36):
    def track(y, at_end):
        """細い帯と、所有が移る位置に立てる旗。旗の先は y-22 まで伸びる。"""
        col = "var(--fig-ok)"
        fx = NW - 6 if at_end else 6
        d = -20 if at_end else 20
        return (f'<rect x="0" y="{y}" width="{NW}" height="10" rx="5" {BOX_F} {BOX_S}/>'
                f'<circle cx="{fx}" cy="{y + 5}" r="5.5" fill="{col}"/>'
                f'<line x1="{fx}" y1="{y + 5}" x2="{fx}" y2="{y - 22}" stroke="{col}" '
                f'stroke-width="2.2"/>'
                f'<path d="M{fx} {y - 22} L{fx + d} {y - 17} L{fx} {y - 12} z" fill="{col}"/>')

    s = [
        _cap(0, 14, "月額制"),
        f'<rect x="0" y="24" width="{NW}" height="48" rx="8" {BOX_F} {BOX_S}/>',
        f'<text x="16" y="45" font-size="13.5" font-weight="700" fill="currentColor">'
        f"月{sub_monthly:,}円 × {months}か月</text>",
        f'<text x="16" y="63" font-size="12.5" {DIM}>＝ {sub_total:,}円</text>',
        # 旗の先（y-22 ＝ 90）より上にラベルを置く
        f'<text x="{NW}" y="84" text-anchor="end" font-size="12.5" font-weight="700" '
        f'fill="var(--fig-ok)">ここで、やっと譲渡</text>',
        track(112, True),
        f'<text x="0" y="148" font-size="12.5" font-weight="700" fill="var(--fig-bad)">'
        "途中で降りると、サイトは非公開</text>",

        _cap(0, 196, "紬"),
        f'<rect x="0" y="206" width="{NW}" height="48" rx="8" fill="var(--fig-accent)" '
        f'fill-opacity=".08" stroke="var(--fig-accent)" stroke-width="2"/>',
        f'<text x="16" y="227" font-size="13.5" font-weight="700" fill="currentColor">'
        f"買い切り {our_price:,}円</text>",
        f'<text x="16" y="245" font-size="12.5" {DIM}>＋ 運用 月{our_run:,}円（任意）</text>',
        f'<text x="0" y="266" font-size="12.5" font-weight="700" fill="var(--fig-ok)">'
        "ここで、もうお客様のもの</text>",
        track(294, False),
        f'<text x="0" y="330" font-size="12.5" font-weight="700" fill="var(--fig-ok)">'
        "途中で降りても、サイトは残る</text>",
    ]
    return "".join(s), f"0 0 {NW} 342"
