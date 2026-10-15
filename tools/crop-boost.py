#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""crop-boost.py —— 裁剪 PNG 并做对比度拉伸，用于肉眼排查"看不清的淡色元素"

用法：python tools/crop-boost.py <in.png> <out.png> <x> <y> <w> <h> [gain]
  gain 默认 3.0：把局部色差放大 gain 倍（以裁剪区中位色为基准），
  用于暴露低透明度的辅助线 / 色带边界。
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib.machinery import SourceFileLoader
cs = SourceFileLoader('cs', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contact-sheet.py')).load_module()


def main():
    src, out = sys.argv[1], sys.argv[2]
    x0, y0, cw, ch = (int(v) for v in sys.argv[3:7])
    gain = float(sys.argv[7]) if len(sys.argv) > 7 else 3.0
    w, h, px = cs.decode(src)
    cw = min(cw, w - x0); ch = min(ch, h - y0)
    buf = bytearray(cw * ch * 4)
    vals = []
    for y in range(ch):
        for x in range(cw):
            so = ((y0 + y) * w + (x0 + x)) * 4
            v = (px[so] * 299 + px[so + 1] * 587 + px[so + 2] * 114) // 1000
            vals.append(v)
            do = (y * cw + x) * 4
            buf[do:do + 4] = px[so:so + 4]
    vals.sort()
    med = vals[len(vals) // 2]
    for i in range(cw * ch):
        for k in range(3):
            v = med + (buf[i * 4 + k] - med) * gain
            buf[i * 4 + k] = 0 if v < 0 else (255 if v > 255 else int(v))
    cs.encode(out, cw, ch, bytes(buf))
    print(f'{out}  crop({x0},{y0},{cw}x{ch})  gain={gain}  median={med}')


if __name__ == '__main__':
    main()
