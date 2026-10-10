#!/usr/bin/env python3
"""Web フォント（Noto Sans JP・Roboto）をサブセット化して assets/fonts/ に書き出す。

使い方:
  pip install fonttools brotli
  python tools/build-fonts.py                 # 生成（原本は tools/.font-cache にダウンロード）
  python tools/build-fonts.py --check-only    # フォントは作らず、文字抽出と欠字の有無だけ確認

文言を追加・変更したら再実行する。生成後は `node tools/check-fonts.mjs` で
実際の表示テキストが全文字サブセットに含まれることを確認する。

- 原本: google/fonts リポジトリの固定コミットから取得し、SHA-256 を検証する（原本はリポジトリに入れない）
- 対象文字: 公開 HTML 全件（index-v2.html・v2/ を含む）・CSS の content:・JS 内の文字列
            ＋基本セット（ASCII・Latin-1・句読点・全角記号・ひらがな・カタカナ）
            ＋（--jouyou を付けたとき）常用漢字 2136 字
- ウェイト: 可変フォント 1 ファイル（太さの軸 400〜900）。style.css の @font-face が font-weight: 400 900 で参照する。
            使うウェイトは 400 / 500 / 700 / 900 だけにする（600・800 は従来 700・900 に寄っていたが、可変フォントでは
            そのまま描画されて見た目が変わる）
- 常用漢字: 既定では入れない（Noto Sans JP が約 264KB → 約 680KB になる）。必要なら --jouyou
"""
import argparse
import hashlib
import html
import io
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DEFAULT = ROOT / "assets" / "fonts"
CACHE_DEFAULT = ROOT / "tools" / ".font-cache"

GF_COMMIT = "bd8f81ddb5c74d5c8897b36ad88b440266245103"
GF_BASE = f"https://raw.githubusercontent.com/google/fonts/{GF_COMMIT}/ofl"
SOURCES = {
    "NotoSansJP": {
        "url": f"{GF_BASE}/notosansjp/" + urllib.parse.quote("NotoSansJP[wght].ttf"),
        "file": "NotoSansJP[wght].ttf",
        "sha256": "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
        "pin": {},
        "features": ["ccmp", "locl", "vert", "vrt2", "kern", "palt", "halt", "vhal", "vpal", "mark", "mkmk"],
        "hinting": False,  # Google Fonts 配信版も Noto Sans JP はヒント無し
    },
    "Roboto": {
        "url": f"{GF_BASE}/roboto/" + urllib.parse.quote("Roboto[wdth,wght].ttf"),
        "file": "Roboto[wdth,wght].ttf",
        "sha256": "d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134",
        "pin": {"wdth": 100},
        "features": ["ccmp", "dnom", "frac", "liga", "lnum", "locl", "numr", "pnum", "tnum", "kern", "mark", "mkmk"],
        "hinting": True,
    },
}
UNIHAN_URL = "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip"
UNIHAN_SHA256 = "f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e"
# 残す OpenType 機能は、Google Fonts 配信版（従来の表示）が持っているものと同じにする。
# halt・vhal は全角約物の連続（「」）など）を詰める組版に使われる。chws は配信版に無いので入れない

# 公開サイトとして読む対象（作業用フォルダは除く）
SCAN_GLOBS = ["*.html", "*.css", "*.js", "v2/*.html", "v2/*.css", "v2/*.js"]


def fetch(url, dest, sha256=None):
    if dest.exists() and (sha256 is None or sha256_of(dest) == sha256):
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"ダウンロード: {url}")
    with urllib.request.urlopen(url, timeout=120) as r:
        data = r.read()
    if sha256 and hashlib.sha256(data).hexdigest() != sha256:
        sys.exit(f"SHA-256 が一致しません: {url}")
    dest.write_bytes(data)


def sha256_of(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def css_unescape(s):
    return re.sub(r"\\([0-9a-fA-F]{1,6})\s?", lambda m: chr(int(m.group(1), 16)), s)


def css_content_strings(css):
    out = []
    for m in re.finditer(r"""content\s*:\s*([^;}]*)""", css):
        for q in re.finditer(r"""(["'])((?:\\.|(?!\1).)*)\1""", m.group(1)):
            out.append(css_unescape(q.group(2)))
    return "".join(out)


def extract_text(path):
    """1ファイルから「画面に出うる文字」を取り出す。コメントとCSS本体は除く。"""
    t = path.read_text(encoding="utf-8")
    suf = path.suffix
    if suf == ".css":
        t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)
        return css_content_strings(t)
    if suf == ".js":
        t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)
        t = re.sub(r"(?m)(^|\s)//[^\n]*", "", t)
        return t
    # html
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    extra = []
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", t, flags=re.S | re.I):
        c = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
        extra.append(css_content_strings(c))
    t = re.sub(r"<style[^>]*>.*?</style>", "", t, flags=re.S | re.I)

    def js(m):
        s = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
        return re.sub(r"(?m)(^|\s)//[^\n]*", "", s)

    t = re.sub(r"(?is)<script[^>]*>(.*?)</script>", lambda m: js(m), t)
    return html.unescape(t) + "".join(extra)


def base_charset():
    s = set()
    for lo, hi in [
        (0x20, 0x7E), (0xA0, 0xFF),
        (0x2010, 0x2027), (0x2030, 0x2033), (0x2039, 0x203B), (0x2190, 0x2193),
        (0x2212, 0x2212), (0x3000, 0x303F),          # 全角記号・句読点・括弧
        (0x3041, 0x3096), (0x3099, 0x309F),           # ひらがな
        (0x30A0, 0x30FF),                             # カタカナ
        (0xFF01, 0xFF5E),                             # 全角英数記号
    ]:
        s.update(chr(c) for c in range(lo, hi + 1))
    return s


def jouyou_set(cache):
    z = cache / "Unihan.zip"
    fetch(UNIHAN_URL, z, UNIHAN_SHA256)
    with zipfile.ZipFile(z) as zf:
        txt = zf.read("Unihan_OtherMappings.txt").decode("utf-8")
    out = set()
    for line in txt.splitlines():
        if "\tkJoyoKanji\t" in line:
            out.add(chr(int(line.split("\t")[0][2:], 16)))
    return out


def collect_site_chars(root):
    chars = set()
    files = []
    for g in SCAN_GLOBS:
        files += sorted(root.glob(g))
    for f in files:
        chars.update(extract_text(f))
    return {c for c in chars if not c.isspace() and ord(c) >= 0x20 and not (0x7F <= ord(c) < 0xA0)}, files


def build(args):
    sys.stdout.reconfigure(encoding="utf-8")
    from fontTools.ttLib import TTFont
    from fontTools import subset
    from fontTools.varLib import instancer

    root = Path(args.root)
    out = Path(args.out)
    cache = Path(args.cache)
    site, files = collect_site_chars(root)
    base = base_charset()
    joyo = jouyou_set(cache) if args.jouyou else set()
    want = site | base | joyo
    kanji = lambda cs: sum(1 for c in cs if 0x4E00 <= ord(c) <= 0x9FFF or 0x3400 <= ord(c) <= 0x4DBF)
    print(f"走査 {len(files)} ファイル / サイト使用 {len(site)} 字（漢字 {kanji(site)}）/ 基本 {len(base)} 字"
          + (f" / 常用漢字 {len(joyo)} 字を追加 → 合計 {len(want)} 字（漢字 {kanji(want)}）" if joyo else f" → 合計 {len(want)} 字"))
    if args.check_only:
        return

    out.mkdir(parents=True, exist_ok=True)
    report = {}
    for name, src in SOURCES.items():
        path = cache / src["file"]
        fetch(src["url"], path, src["sha256"])
        if sha256_of(path) != src["sha256"]:
            sys.exit(f"原本の SHA-256 が一致しません: {path}")
        orig = TTFont(path, lazy=True)
        cmap = orig.getBestCmap()
        use = sorted(c for c in want if ord(c) in cmap)
        report[name] = {"chars": use}
        uni = [ord(c) for c in use]
        font = TTFont(path, recalcTimestamp=False)  # 日時を固定し、同じ入力から同じファイルができるようにする
        opts = subset.Options()
        opts.flavor = None
        opts.layout_features = src["features"]
        opts.hinting = src["hinting"]
        opts.notdef_outline = True
        opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        opts.drop_tables += ["DSIG"]
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=uni)
        sub.subset(font)
        # 太さの軸は 400〜900 だけ残す（100〜300 は使わない）
        inst = instancer.instantiateVariableFont(font, {"wght": (400, 900), **src["pin"]}, inplace=False)
        inst.flavor = "woff2"
        dest = out / f"{name}-VF.woff2"
        inst.save(dest)
        print(f"  {dest.name}: {dest.stat().st_size / 1024:.1f} KB ({len(use)} 字)")

    # どのフォントにも無い文字は、ブラウザが端末の代替フォントで表示する（ここでは報告のみ）
    covered = {c for r in report.values() for c in r["chars"]}
    lost = sorted(c for c in site if c not in covered)
    if lost:
        print("注意: 原本のどちらにも無い文字（端末の代替フォントで表示される）: " + "".join(lost))

    # 文字一覧（欠字チェックが読む）
    lines = ["# tools/build-fonts.py が生成。手で編集しない。フォントごとに収録した文字を並べる。"]
    for name, r in report.items():
        lines.append(f"[{name}]")
        s = "".join(r["chars"])
        lines += [s[i:i + 80] for i in range(0, len(s), 80)]
    if lost:
        lines += ["[NoFont]", "".join(lost)]
    (out / "charset.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"書き出し: {out / 'charset.txt'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(ROOT), help="サイトのルート")
    ap.add_argument("--out", default=str(OUT_DEFAULT), help="出力先")
    ap.add_argument("--cache", default=str(CACHE_DEFAULT), help="原本フォントのダウンロード先")
    ap.add_argument("--jouyou", action="store_true", help="常用漢字 2136 字を追加で収録する")
    ap.add_argument("--check-only", action="store_true")
    build(ap.parse_args())
