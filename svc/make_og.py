#!/usr/bin/env python3
"""
OGP画像を各ページぶん生成する（native/og/*.png）。

    python make_og.py

営業の主経路は「電話 → URLを送る」で、地方ではそれが LINE になる。
リンクを貼ったときにカードが真っ白か、屋号と金額が出るかで開封率が変わるので、
これは装飾ではなく導線の一部として扱う。

build.py はこの生成物をコピーするだけにしてある（ビルドに Chromium を要求しない）。
文面を変えたらこれを実行し、native/og/ の差分をコミットすること。
"""
import http.server
import functools
import socketserver
import shutil
import threading
from pathlib import Path

import config as C
import prices as P

ROOT = Path(__file__).parent
OUT = ROOT / "native" / "og"
W, H = 1200, 630

# ページごとの見出し。build.py の PAGES と同じ並びで持つ
SHEET = {
    "index.html":      ("1ページ39,800円から。", "払った日から、あなたのものです"),
    "owned.html":      ("借地権ではなく、", "所有権のホームページを"),
    "price.html":      ("月額を止めた日に、", "何が残りますか"),
    "unlimited.html":  ("「1文字直すのに5,000円」を、", "やめます"),
    "source.html":     ("ソースコードごと、", "お渡しします"),
    "cost-cut.html":   ("新しい予算をつくる前に、", "いまの掲載費を見直します"),
    "subsidy.html":    ("補助金を使うと、", "ご負担は実質300,000円になります"),
    "spec.html":       ("作るものを、", "先に全部書いています"),
    "flow.html":       ("ご相談から公開まで、", "約6週間でお渡しします"),
    "works.html":      ("事例は、", "これから積みます"),
    "faq.html":        ("お電話の前に、", "確かめたいことへの答え"),
    "restaurant.html": ("飲食店の", "ホームページ"),
    "koumuten.html":   ("工務店・建設業の", "ホームページ"),
    "salon.html":      ("美容室・サロンの", "ホームページ"),
    "shigyo.html":     ("士業・専門事務所の", "ホームページ"),
    "about.html":      ("2人で、", "やっています"),
    "contact.html":    ("ご相談は無料。", "1営業日以内にご返信します"),
    "terms.html":      ("書いたことは、", "契約書にも書きます"),
    "privacy.html":    ("お預かりするのは、", "ご返信に必要なものだけです"),
    "legal.html":      ("特定商取引法に", "基づく表記"),
    "404.html":        ("お探しのページは、", "見つかりませんでした"),
}

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0B0B0D;color:#fff;
  font-family:"Noto Sans CJK JP","Hiragino Sans",sans-serif;
  display:flex;flex-direction:column;justify-content:space-between;
  padding:68px 76px;font-feature-settings:"palt" 1}
.top{display:flex;align-items:baseline;gap:16px}
.mark{font-size:64px;font-weight:700;letter-spacing:.05em;line-height:1}
.rd{font-size:17px;letter-spacing:.22em;color:#A8AEB8}
.bar{width:1px;height:38px;background:rgba(255,255,255,.28);margin-inline:8px}
.trade{font-size:18px;color:#A8AEB8;letter-spacing:.04em}
h1{font-size:%(hs)dpx;font-weight:700;line-height:1.46;letter-spacing:-.01em}
h1 .q{color:#A8AEB8}
.foot{display:flex;align-items:flex-end;justify-content:space-between;gap:40px}
.pts{display:flex;gap:12px;flex-wrap:wrap}
.pt{font-size:17px;font-weight:700;padding:9px 18px;border-radius:999px;
  border:1px solid rgba(255,255,255,.3);color:#fff;white-space:nowrap}
.amt{text-align:right;line-height:1;white-space:nowrap}
.amt .k{font-size:15px;color:#A8AEB8;letter-spacing:.04em}
.amt .v{font-size:58px;font-weight:700;letter-spacing:-.02em;margin-top:8px}
.amt .v i{font-size:22px;font-style:normal;font-weight:600;margin-left:4px}
.amt .v b{color:#42D083}
"""


def page_html(quiet, loud):
    hs = 54 if len(quiet) + len(loud) <= 30 else 46
    # カードに出す金額は「入口の金額」にする。
    # リンクを開くかどうかは、いちばん小さい数字で決まる。
    return f"""<!doctype html><meta charset="utf-8"><style>{CSS % {"hs": hs}}</style>
<body>
  <div class="top">
    <span class="mark">{C.BRAND}</span><span class="rd">{C.BRAND_READING}</span>
    <span class="bar"></span><span class="trade">ホームページ制作と運用｜全国対応</span>
  </div>
  <h1><span class="q">{quiet}</span><br>{loud}</h1>
  <div class="foot">
    <div class="pts">
      <span class="pt">払った日から自分のもの</span>
      <span class="pt">ソースコードごと納品</span>
      <span class="pt">契約期間の縛りなし</span>
    </div>
    <div class="amt"><div class="k">1ページから・買い切り</div>
      <div class="v"><b>{P.SINGLE['price']:,}</b><i>円〜</i></div></div>
  </div>
</body>"""


FAVI = """<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0}
body{width:%(n)dpx;height:%(n)dpx;background:#0B0B0D;color:#fff;display:flex;
  align-items:center;justify-content:center;
  font-family:"Noto Sans CJK JP","Hiragino Sans",sans-serif}
span{font-size:%(f)dpx;font-weight:700;line-height:1}
</style><body><span>%(m)s</span></body>"""

# SVG のファビコン。背景を塗って一文字を置くだけなので、字形はブラウザの書体に任せる
FAVI_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="12" fill="#0B0B0D"/>'
    '<text x="32" y="33" text-anchor="middle" dominant-baseline="central" '
    'font-family="Hiragino Sans, Noto Sans CJK JP, Meiryo, sans-serif" '
    'font-size="44" font-weight="700" fill="#FFFFFF">%s</text></svg>'
)


def main():
    from playwright.sync_api import sync_playwright

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    tmp = ROOT / ".og-tmp"
    tmp.mkdir(exist_ok=True)
    for name, (q, l) in SHEET.items():
        (tmp / name).write_text(page_html(q, l), encoding="utf-8")
    for n, f in ((180, 118), (512, 336)):
        (tmp / f"favi{n}.html").write_text(
            FAVI % {"n": n, "f": f, "m": C.BRAND}, encoding="utf-8")
    (OUT / "favicon.svg").write_text(FAVI_SVG % C.BRAND, encoding="utf-8")

    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(tmp)))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
            pg = b.new_page(viewport={"width": W, "height": H})
            for name in SHEET:
                pg.goto(f"http://127.0.0.1:{port}/{name}", wait_until="load")
                png = OUT / (name.replace(".html", "") + ".png")
                pg.screenshot(path=str(png))
                print(f"  {png.name:22s}{png.stat().st_size / 1024:6.1f} KB")
            for n, out in ((180, "apple-touch-icon.png"), (512, "icon-512.png")):
                pg.set_viewport_size({"width": n, "height": n})
                pg.goto(f"http://127.0.0.1:{port}/favi{n}.html", wait_until="load")
                pg.screenshot(path=str(OUT / out))
                print(f"  {out:22s}{(OUT / out).stat().st_size / 1024:6.1f} KB")
            b.close()
    finally:
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"生成: OGP {len(SHEET)}枚 ＋ ファビコン3種 -> native/og/")


if __name__ == "__main__":
    main()
