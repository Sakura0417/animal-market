#!/usr/bin/env python
"""measure-safearea.py —— 从「微信开发者工具模拟器截图」量化安全区是否生效。

【为什么需要它】"顶部被刘海压住/底部被 Home 条压住" 是**主观观感**，
而 topIn/bottomIn 是**数值**。本工具把观感变成数值：先定位模拟器里"手机屏矩形"
（避开工具自身的深灰边框），再量出刘海/Home 条/HUD/道具栏的位置，换算成设计单位，
直接与布局公式对照 —— 一眼判断跑的是旧包还是新包，以及让出的留白够不够。

【判据】（本项目 375 设计宽、列布局常量见 view/GameView.ts）
    HUD 内容上沿 = topIn + HUD_TOP(6)      ← topIn 正确值 = 安全区上边（iPhone X = 44）
    道具栏下沿   = 屏高 − PAD_BOTTOM(12) − bottomIn   ← bottomIn 正确值 = 安全区下边（iPhone X = 34）
    ⇒ 若 HUD 上沿 ≈ 28、道具栏下沿 ≈ 783 = 旧包（只让出一半）；
       若 HUD 上沿 ≈ 50、道具栏下沿 ≈ 766 = 新包（完整让出）。
    另外：iPhone X 刘海**外观**下沿 = 30 设计单位（不是 44）——只躲开刘海≠躲开状态栏，
    安全区要按 44 让，否则 HUD 仍压在状态栏里。

【为什么不用 PIL】纯 stdlib（zlib 手解 PNG），无第三方依赖，换机器就能跑。

用法: python tools/measure-safearea.py <png> [--profile]
     --profile 额外打印顶部/底部逐行特征色计数，用于定位边缘。
"""
import sys
import zlib
import struct
from collections import Counter

# ---------- 极简 PNG 解码（8bit，灰度/RGB/RGBA，非隔行）----------
def load_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', '不是 PNG'
    pos, idat, ihdr = 8, b'', None
    while pos < len(d):
        ln, typ = struct.unpack('>I4s', d[pos:pos + 8])
        data = d[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', data)
        elif typ == b'IDAT':
            idat += data
        pos += 12 + ln
    w, h, depth, ctype, _, _, interlace = ihdr
    assert depth == 8 and interlace == 0, '仅支持 8bit 非隔行 PNG'
    nch = {0: 1, 2: 3, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = w * nch
    out = bytearray(w * h * nch)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for i in range(nch, stride):
                line[i] = (line[i] + line[i - nch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                b = prev[i]
                c = prev[i - nch] if i >= nch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, nch, bytes(out)


def main(path, profile=False):
    w, h, nch, px = load_png(path)

    def get(x, y):
        o = (y * w + x) * nch
        return px[o], px[o + 1], px[o + 2]

    lum = lambda c: (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000
    is_game = lambda c: c[1] > c[0] and c[1] > c[2] and c[1] > 100          # 游戏底色（绿系）
    is_purple = lambda c: c[2] > 170 and c[0] < 180 and c[2] - c[1] > 60    # 道具栏按钮
    is_black = lambda c: lum(c) < 30                                        # 刘海 / Home 条

    # 1) 手机屏外接框 = 游戏底色像素的外接框（剔除工具自身深灰边框）
    xs, ys = [], []
    for y in range(h):
        hit = False
        for x in range(w):
            if is_game(get(x, y)):
                xs.append(x); hit = True; break
        if hit:
            ys.append(y)
            for x in range(w - 1, -1, -1):
                if is_game(get(x, y)):
                    xs.append(x); break
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    SW, SH = x1 - x0 + 1, y1 - y0 + 1
    S = SW / 375.0
    print('手机屏外接框 x[%d..%d] y[%d..%d]  %dx%d' % (x0, x1, y0, y1, SW, SH))
    print('横向 s=%.4f  竖向 s=%.4f（两者接近 ⇒ 设备确实是 375 设计宽）' % (S, SH / 812.0))
    D = lambda v: v / S      # 像素 → 设计单位

    def black_components(top, bottom):
        """黑色像素的 4 连通域外接框列表。
        为什么要连通域：HUD 里的深色图标/文字也是"黑色"，
        直接取外接框会把它们和刘海并成一个大框（实测把刘海下沿从 30 虚报成 43.9）。"""
        mask = set()
        for y in range(top, bottom + 1):
            for x in range(x0, x1 + 1):
                if is_black(get(x, y)):
                    mask.add((x, y))
        seen, boxes = set(), []
        for p in mask:
            if p in seen:
                continue
            stack, xs, ys = [p], [], []
            seen.add(p)
            while stack:
                x, y = stack.pop()
                xs.append(x); ys.append(y)
                for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if q in mask and q not in seen:
                        seen.add(q); stack.append(q)
            boxes.append((min(xs), max(xs), min(ys), max(ys)))
        return boxes

    # 2) 刘海 = 贴在屏幕顶的那块黑色（min_y 最小）
    cand = black_components(y0, y0 + SH // 4)
    notch = min(cand, key=lambda b: b[2]) if cand else None
    # 3) Home 指示条 = 贴屏幕底、且最宽的那块黑色
    cand2 = black_components(y0 + 3 * SH // 4, y1)
    home = max(cand2, key=lambda b: b[1] - b[0]) if cand2 else None

    # 4) 道具栏（紫色占比 > 1/3 的行）
    prows = [y for y in range(y0 + int(SH * 0.7), y1 + 1)
             if sum(1 for x in range(x0, x1 + 1) if is_purple(get(x, y))) > SW // 3]

    # 5) HUD 行：以"道具栏/刘海"以外的亮色块定位最容易失手，这里只给区间提示，
    #    真正判据用「道具栏下沿」+「刘海下沿」（两者都稳）。
    print('\n---- 关键边缘（设计单位，原点=手机屏左上角）----')
    if notch:
        bx0, bx1, by0, by1 = notch
        print('刘海下沿      : %6.1f   （iPhone X 刘海外观 = 30；状态栏安全区上边 = 44）' % D(by1 + 1 - y0))
        print('刘海横向      : %6.1f .. %6.1f  宽 %6.1f'
              % (D(bx0 - x0), D(bx1 + 1 - x0), D(bx1 - bx0 + 1)))
        print('  ↑ 自检：iPhone X 刘海应为 209 宽 x 30 高。量出来吻合 ⇒ 屏矩形与缩放标定正确，'
              '后面的设计单位换算才可信。')
    if home:
        hy0, hy1 = home[2], home[3]
        print('Home 条上沿   : %6.1f' % D(hy0 - y0))
    if prows:
        print('道具栏上沿    : %6.1f' % D(prows[0] - y0))
        print('道具栏下沿    : %6.1f   ← 判据：屏高−12−bottomIn' % D(prows[-1] + 1 - y0))
    print('屏幕高        : %6.1f   （375x812 机型应为 812）' % D(SH))

    print('\n---- 判据对照 ----')
    print('  旧包（topIn/bottomIn 被 /2 缩小）: 道具栏下沿 ≈ 783')
    print('  新包（完整安全区 44/34）        : 道具栏下沿 ≈ 766')
    print('  若道具栏下沿 ≥ 780 且刘海压住 HUD ⇒ 跑的是旧构建产物，需重新构建')

    if profile:
        print('\n---- 逐行特征色计数 ----')
        def cnt(y):
            c = Counter()
            for x in range(x0, x1 + 1):
                p = get(x, y)
                if is_purple(p): c['purple'] += 1
                elif is_black(p): c['dark'] += 1
                elif p[0] > 230 and p[1] > 230 and p[2] > 230: c['white'] += 1
                elif is_game(p): c['green'] += 1
            return c
        for y in list(range(y0, y0 + 120, 4)) + list(range(y1 - 120, y1 + 1, 4)):
            c = cnt(y)
            print('  y=%4d (设计 %6.1f)  purple=%3d white=%3d dark=%3d green=%3d'
                  % (y, D(y - y0), c['purple'], c['white'], c['dark'], c['green']))


if __name__ == '__main__':
    main(sys.argv[1], '--profile' in sys.argv)
