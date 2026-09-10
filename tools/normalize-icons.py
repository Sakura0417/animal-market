#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""normalize-icons.py —— UI 图标画布归一化（零依赖，无 PIL/sharp）

为什么需要它（2026-09-10）：
  `IconArt.iconArt()` 按固定的 `px` 方框渲染图标，因此「图标的实际光学尺寸 =
  px × 内容占画布比例」。实测用户提供的 8 张图内容占画布比例从 70.3% 到 100% 不等，
  导致同一个 px 下最大差 1.43 倍；且 crane.png 是 128×112 非方形贴图，被塞进方形框
  后纵向拉伸 14.3%。本脚本把画布与内容比例统一，从资产层根治，而不是在每个调用点
  写补偿系数。

统一规则（唯一一条）：
  画布 160×160 全透明；内容等比缩放（contain）到最大边 128（= 画布 80%）后居中。

重采样纪律：
  · 缩放比 ≈ 1（±1.5%）→ 直通不重采样，零损失保住像素锐度（coin/crane/video 走这条）
  · 需要缩放时：先预乘 alpha → 可分离三角滤波（缩小自动退化为面积平均，放大近似
    Catmull-Rom 观感）→ 反预乘。预乘是为了避免透明边缘出现深色描边（黑边）。
  · 像素风图标（--nearest）改用最近邻，保持硬边不糊。

用法：
  python tools/normalize-icons.py <目录> [--canvas 160] [--fill 128] [--nearest coin,...]
  例：python tools/normalize-icons.py assets/resources/icons --nearest coin
"""
import struct, zlib, sys, os, math

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def decode(path):
    d = open(path, 'rb').read()
    assert d[:8] == PNG_SIG, path + ' 不是 PNG'
    w, h = struct.unpack('>II', d[16:24])
    bd, ct = d[24], d[25]
    assert bd == 8 and ct == 6, f'{path} 仅支持 8bit RGBA，实为 bitdepth={bd} ctype={ct}'
    idat, i = b'', 8
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        if d[i + 4:i + 8] == b'IDAT':
            idat += d[i + 8:i + 8 + ln]
        i += 12 + ln
    raw = zlib.decompress(idat)
    bpp, stride = 4, w * 4
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x - bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bytes(out)


def encode(path, w, h, px):
    raw = b''.join(b'\x00' + px[y * w * 4:(y + 1) * w * 4] for y in range(h))

    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)

    open(path, 'wb').write(PNG_SIG
                           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def bbox(w, h, px, thr=8):
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        row = y * w * 4
        for x in range(w):
            if px[row + x * 4 + 3] > thr:
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    if x1 < 0:
        return None
    return x0, y0, x1, y1


def _premul(px, n):
    o = bytearray(n * 4)
    for i in range(n):
        a = px[i * 4 + 3]
        o[i * 4] = px[i * 4] * a // 255
        o[i * 4 + 1] = px[i * 4 + 1] * a // 255
        o[i * 4 + 2] = px[i * 4 + 2] * a // 255
        o[i * 4 + 3] = a
    return o


def _unpremul(px, n):
    o = bytearray(n * 4)
    for i in range(n):
        a = px[i * 4 + 3]
        if a == 0:
            continue
        for k in range(3):
            v = px[i * 4 + k] * 255 // a
            o[i * 4 + k] = 255 if v > 255 else v
        o[i * 4 + 3] = a
    return o


def _axis(src, sw, sh, dw, horiz, nearest):
    """沿一个轴重采样（三角滤波，半径随缩放比自适应；缩小→面积平均，放大→平滑插值）"""
    if dw == sw and horiz:
        return bytearray(src)
    dn = dw
    sn = sw if horiz else sh
    if dn == sn:
        return bytearray(src)
    if nearest:
        out = bytearray(len(src))
        for d in range(dn):
            s = min(sn - 1, int((d + 0.5) * sn / dn))
            for o in range(sh if horiz else sw):
                si = (o * sw + s) * 4 if horiz else (s * sw + o) * 4
                di = (o * dw + d) * 4 if horiz else (d * sw + o) * 4
                out[di:di + 4] = src[si:si + 4]
        return out
    scale = sn / dn
    radius = max(1.0, scale)
    out = bytearray((dw * sh if horiz else sw * dw) * 4)
    K = 4
    for d in range(dn):
        c = (d + 0.5) * scale - 0.5
        lo = max(0, int(math.floor(c - radius)))
        hi = min(sn - 1, int(math.ceil(c + radius)))
        wts = []
        tot = 0.0
        for s in range(lo, hi + 1):
            wgt = 1.0 - abs(s - c) / radius
            if wgt < 0: wgt = 0.0
            wts.append((s, wgt)); tot += wgt
        if tot <= 0:
            wts = [(min(sn - 1, max(0, int(c + 0.5))), 1.0)]; tot = 1.0
        for o in range(sh if horiz else sw):
            acc = [0.0] * K
            for s, wgt in wts:
                if wgt == 0: continue
                si = (o * sw + s) * 4 if horiz else (s * sw + o) * 4
                for k in range(K):
                    acc[k] += src[si + k] * wgt
            di = (o * dw + d) * 4 if horiz else (d * sw + o) * 4
            for k in range(K):
                v = int(acc[k] / tot + 0.5)
                out[di + k] = 255 if v > 255 else v
    return out


def resize(w, h, px, nw, nh, nearest=False):
    if (w, h) == (nw, nh):
        return px
    pre = _premul(px, w * h)
    t = _axis(bytes(pre), w, h, nw, True, nearest)
    t = _axis(t, nw, h, nh, False, nearest)
    return bytes(_unpremul(t, nw * nh))


def normalize(path, canvas, fill, nearest=False):
    w, h, px = decode(path)
    bb = bbox(w, h, px)
    if bb is None:
        raise SystemExit(path + ' 内容全透明，跳过')
    x0, y0, x1, y1 = bb
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    k = fill / max(cw, ch)                    # contain：最大边对齐 fill
    ratio = k
    # 裁剪内容区
    crop = bytearray(cw * ch * 4)
    for y in range(ch):
        s = ((y0 + y) * w + x0) * 4
        crop[y * cw * 4:(y + 1) * cw * 4] = px[s:s + cw * 4]
    if abs(ratio - 1.0) < 0.015:              # 近 1:1 → 直通，零重采样
        ratio = 1.0
        tw, th = cw, ch
        body = bytes(crop)
    else:
        tw, th = max(1, int(round(cw * ratio))), max(1, int(round(ch * ratio)))
        body = resize(cw, ch, bytes(crop), tw, th, nearest)
    out = bytearray(canvas * canvas * 4)
    ox, oy = (canvas - tw) // 2, (canvas - th) // 2
    for y in range(th):
        di = ((oy + y) * canvas + ox) * 4
        si = y * tw * 4
        out[di:di + tw * 4] = body[si:si + tw * 4]
    return canvas, canvas, bytes(out), (cw, ch), (tw, th), ratio


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    folder = args[0]
    canvas = 160
    fill = 128
    nearest = set()
    if '--canvas' in args: canvas = int(args[args.index('--canvas') + 1])
    if '--fill' in args: fill = int(args[args.index('--fill') + 1])
    if '--nearest' in args:
        v = args[args.index('--nearest') + 1]
        nearest = set(x.strip() for x in v.split(',') if x.strip())
    print(f'画布 {canvas}² · 内容最大边 {fill}（占画布 {fill/canvas*100:.1f}%）· 像素风直通: {sorted(nearest) or "无"}')
    print(f'{"asset":10s} {"原内容":>10s} {"归一后":>10s} {"缩放":>7s} {"最大边占比":>10s} {"宽高比":>7s}')
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.png'):
            continue
        name = f[:-4]
        p = os.path.join(folder, f)
        w, h, px, c, t, r = normalize(p, canvas, fill, name in nearest)
        encode(p, w, h, px)
        print(f'{name:10s} {str(c[0])+"x"+str(c[1]):>10s} {str(t[0])+"x"+str(t[1]):>10s} {r:7.3f} '
              f'{max(t)/canvas*100:9.1f}% {t[0]/t[1]:7.2f}')


if __name__ == '__main__':
    main()
