#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""row-profile.py —— 打印裁剪区逐行/逐列亮度剖面，用数值找出"看不清的淡色线"

用途：截图里疑似有低透明度辅助线时，靠肉眼容易误判。本脚本对指定区域
  ① 求每行/每列的平均亮度；
  ② 与 5 像素滑动中值比较，报告偏差最大的若干位置（尖锐的 1-2px 偏差 = 线；
     平缓的阶跃 = 渐变色带边界）。
用法：python tools/row-profile.py <in.png> <x> <y> <w> <h> [rows|cols|both]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib.machinery import SourceFileLoader
cs = SourceFileLoader('cs', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contact-sheet.py')).load_module()


def profile(vals, label):
    n = len(vals)
    med = sorted(vals)[n // 2]
    print(f'--- {label} 剖面（长度 {n}，中位亮度 {med}）---')
    # 5 像素滑动中值作基线，报告偏差最大的 12 个位置
    devs = []
    for i in range(n):
        lo = max(0, i - 2); hi = min(n, i + 3)
        base = sorted(vals[lo:hi])[(hi - lo) // 2]
        devs.append((abs(vals[i] - base), i, vals[i], base))
    devs.sort(reverse=True)
    seen = []
    for d, i, v, b in devs:
        if any(abs(i - s) <= 3 for s in seen):
            continue
        seen.append(i)
        print(f'    pos {i:5d}  亮度 {v:6.1f}  基线 {b:6.1f}  偏差 {d:5.1f}')
        if len(seen) >= 12:
            break
    # 阶跃检测：相邻行差 >2
    print('    阶跃(|Δ|>2)：', end=' ')
    steps = [(i, vals[i] - vals[i - 1]) for i in range(1, n) if abs(vals[i] - vals[i - 1]) > 2]
    print(len(steps), '处', steps[:12])


def main():
    src = sys.argv[1]
    x0, y0, cw, ch = (int(v) for v in sys.argv[2:6])
    mode = sys.argv[6] if len(sys.argv) > 6 else 'both'
    w, h, px = cs.decode(src)
    cw = min(cw, w - x0); ch = min(ch, h - y0)

    def lum(x, y):
        o = ((y0 + y) * w + (x0 + x)) * 4
        return (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) / 1000.0

    if mode in ('rows', 'both'):
        profile([sum(lum(x, y) for x in range(cw)) / cw for y in range(ch)], '逐行(横向线)')
    if mode in ('cols', 'both'):
        profile([sum(lum(x, y) for y in range(ch)) / ch for x in range(cw)], '逐列(纵向线)')


if __name__ == '__main__':
    main()
