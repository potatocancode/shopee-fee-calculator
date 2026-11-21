"""自架字型：把 Noto Sans TC／Noto Serif TC／JetBrains Mono（OFL）切成「只含本站用到的字」的 woff2。

為什麼：Google Fonts 的中文字型是上百個 unicode-range 切片，外加 170 KB 會擋住畫面的 CSS，
手機 LCP 因此卡在 4–7 秒（見 .gstack/lighthouse/baseline）。只放用到的字，三個檔案就夠。

用法：python _fonts.py <原始字型資料夾>
  資料夾要有 NotoSansTC[wght].ttf、NotoSerifTC[wght].ttf、JetBrainsMono[wght].ttf（google/fonts 的 ofl/）。
  新文章用到新字時，node _build.mjs 會失敗並列出缺的字，再跑一次這支就好。
需要：pip install fonttools brotli
"""
import json
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).parent
OUT = ROOT / "assets" / "fonts"
# 只保留實際用到的粗細範圍（見 _src/layout/*.css）
FONTS = {
    "sans": ("NotoSansTC[wght].ttf", (400, 700)),
    "serif": ("NotoSerifTC[wght].ttf", (700, 900)),
    "mono": ("JetBrainsMono[wght].ttf", (500, 700)),
}
# 一定要有的字：ASCII、全形標點、計算機會動態產生的符號
ALWAYS = "".join(chr(c) for c in range(0x20, 0x7F)) + "，。、；：？！「」『』（）《》〈〉…－—–×÷−±％‰＋＝→←↑↓▾›‹·・　①②③④⑤⑥⑦⑧⑨⑩✓"


def site_chars() -> str:
    """所有會出現在頁面上的字：輸出的 HTML、原始檔、會產生文字的 JS。"""
    files = [p for p in ROOT.rglob("*") if p.suffix in {".html", ".js", ".mjs"}
             and not any(part.startswith((".", "node_modules")) for part in p.relative_to(ROOT).parts)]
    text = "".join(p.read_text(encoding="utf-8") for p in files)
    return "".join(sorted(set(text + ALWAYS) - set("\n\r\t")))


def main(src: Path) -> None:
    chars = site_chars()
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for name, (file, (lo, hi)) in FONTS.items():
        font = TTFont(src / file)
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga", "calt", "tnum", "zero", "locl", "vert", "vrt2"] if name == "mono" else ["kern", "locl", "vert", "vrt2", "palt"]
        opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]  # 保留版權與授權名稱
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(text=chars)
        sub.subset(font)
        font = instancer.instantiateVariableFont(font, {"wght": (lo, hi)})
        path = OUT / f"{name}.woff2"
        font.flavor = "woff2"
        font.save(path)
        report[name] = {"bytes": path.stat().st_size, "wght": [lo, hi]}
    # 給 _build.mjs 檢查用：哪些字有被切進去
    (OUT / "chars.json").write_text(json.dumps({"chars": chars, "files": report}, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), len(chars), "chars")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
