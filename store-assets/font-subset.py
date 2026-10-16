# -*- coding: utf-8 -*-
"""一次性脚本：扫描《动物集市》全部 TS 源码，提取 UI 文案字符，
对 ZCOOL KuaiLe（站酷快乐体，SIL OFL）做子集化，输出微信小游戏主包字体。
用法：python store-assets/font-subset.py（从仓库任意位置运行均可）
产物：assets/resources/fonts/zcool-kuaile-ui.ttf（接入需在 Cocos 编辑器里确认导入）
"""
import os
import sys
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

# 仓库根 = 本脚本上一级（2026-10-16 起 store-assets/ 已并入仓库，不再依赖仓库外路径）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "scripts")
OUT_DIR = os.path.join(ROOT, "assets", "resources", "fonts")
SRC_TTF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ZCOOLKuaiLe-Regular.ttf")
OUT_TTF = os.path.join(OUT_DIR, "zcool-kuaile-ui.ttf")
CHARS_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "subset-chars.txt")

chars = set()

# 1) 遍历全部 TS 源码，收集中/英/标点字符（动态拼串的数字与符号在此覆盖）
for dirpath, _dirs, files in os.walk(SRC_DIR):
    for fn in files:
        if not fn.endswith(".ts"):
            continue
        p = os.path.join(dirpath, fn)
        try:
            with open(p, encoding="utf-8") as f:
                chars.update(f.read())
        except Exception as e:  # noqa: BLE001
            print("skip", p, e)

# 2) 保险补齐：不可变但易漏的常用字符
chars.update(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    " ",  # 空格必须
)
# 3) 排除换行/控制字符/emoji 区段（字体无字形，留给系统回退）
DROP = (lambda s: s is not None and
        (ord(s) < 0x20 or 0x7F <= ord(s) < 0xA0 or
         (0x1F000 <= ord(s) <= 0x1FAFF) or  # 彩色 emoji / pictographs
         (0x2700 <= ord(s) <= 0x27BF)))      # Dingbats（⚠️❤️ 等常驻此区）

keep = sorted(c for c in chars if not DROP(c))
print("chars:", len(keep))

with open(CHARS_TXT, "w", encoding="utf-8") as f:
    f.write("".join(keep))

os.makedirs(OUT_DIR, exist_ok=True)
opts = Options()
opts.flavor = None
opts.hinting = True
opts.layout_features = ["*"]
opts.notdef_outline = True
opts.recommended_glyphs = True
opts.name_IDs = ["*"]          # 保留全部 name 记录（含 OFL 授权信息）
opts.desubroutinize = False

f = TTFont(SRC_TTF)
sub = Subsetter(opts)
sub.populate(text="".join(keep))
sub.subset(f)
f.save(OUT_TTF)
print("out:", OUT_TTF, os.path.getsize(OUT_TTF), "bytes")
print("done")