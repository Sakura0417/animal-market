#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""contact-sheet.py —— 零依赖 PNG 拼图预览（无 PIL/sharp）

用途：把一批 PNG 拼成一张网格图，便于一次肉眼核对美术素材（透明区用棋盘格显示）。
约束：仅支持 8bit RGBA（ctype=6）PNG —— 本项目所有美术输出均为此格式。

用法：
  python tools/contact-sheet.py <out.png> <cell> <cols> <in.png>...
例：
  python tools/contact-sheet.py /tmp/sheet.png 96 3 assets/resources/icons/*.png
"""
import struct, zlib, sys, os

def decode(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', path + ' 不是 PNG'
    w, h = struct.unpack('>II', d[16:24])
    bd, ct = d[24], d[25]
    assert bd == 8 and ct == 6, f'{path} 仅支持 8bit RGBA，实为 bitdepth={bd} ctype={ct}'
    idat, i = b'', 8
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ = d[i+4:i+8]
        if typ == b'IDAT':
            idat += d[i+8:i+8+ln]
        i += 12 + ln
    raw = zlib.decompress(idat)
    bpp, stride = 4, w * 4
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x-bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, bytes(out)

def encode(path, w, h, px):
    raw = b''.join(b'\x00' + px[y*w*4:(y+1)*w*4] for y in range(h))
    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    open(path, 'wb').write(png)

def main():
    out, cell, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    srcs = sys.argv[4:]
    rows = (len(srcs) + cols - 1) // cols
    W, H = cols * cell, rows * cell
    canvas = bytearray(W * H * 4)
    # 棋盘格底（16px），用于显示透明区
    for y in range(H):
        for x in range(W):
            v = 70 if ((x // 16) + (y // 16)) % 2 == 0 else 45
            o = (y * W + x) * 4
            canvas[o:o+3] = bytes((v, v, v)); canvas[o+3] = 255
    for idx, s in enumerate(srcs):
        w, h, px = decode(s)
        cx, cy = (idx % cols) * cell, (idx // cols) * cell
        for y in range(cell):
            sy = y * h // cell
            for x in range(cell):
                sx = x * w // cell
                so = (sy * w + sx) * 4
                a = px[so+3]
                if a == 0: continue
                do = ((cy + y) * W + cx + x) * 4
                if a == 255:
                    canvas[do:do+4] = px[so:so+4]
                else:
                    da = canvas[do+3]
                    na = a + da * (255 - a) // 255
                    for k in range(3):
                        canvas[do+k] = (px[so+k] * a + canvas[do+k] * da * (255 - a) // 255) // na if na else 0
                    canvas[do+3] = na
    encode(out, W, H, bytes(canvas))
    print(f'{out}  {W}x{H}  {len(srcs)} 张 -> ' + ', '.join(os.path.basename(s) for s in srcs))

if __name__ == '__main__':
    main()
