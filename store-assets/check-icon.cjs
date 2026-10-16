/*
 * 小游戏图标规格自检 + 真实尺寸可读性检查（零依赖）
 *
 * 用途：提交微信小游戏「基础信息」前，验证头像文件合规，并预览它在
 *       微信各真实展示尺寸（144 / 64 / 48 px、方形 / 圆角方形 / 圆形）下的可读性。
 *
 * 用法：node store-assets/check-icon.cjs
 * 输出：store-assets/_check/icon-size-check.png（自检图，可直接用看图工具打开）
 *
 * 规格依据（微信公众平台 · 设置 · 基本信息）：
 *   格式 png / bmp / jpeg / jpg / gif；不可大于 2M；建议 png（最佳效果）；建议 144px × 144px
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = __dirname;
const SRC = path.join(DIR, 'logo-144.png');
const OUT_DIR = path.join(DIR, '_check');
const OUT = path.join(OUT_DIR, 'icon-size-check.png');

/* ───── PNG 解码（零依赖，取材自 animal-market-cocos/tools/process-animal-art.cjs）───── */
function decodePNG(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not PNG');
    let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const t = buf.toString('ascii', off + 4, off + 8);
        const d = buf.subarray(off + 8, off + 8 + len);
        if (t === 'IHDR') {
            w = d.readUInt32BE(0); h = d.readUInt32BE(4);
            bitDepth = d[8]; colorType = d[9];
            if (d[12] !== 0) throw new Error('interlaced not supported');
        } else if (t === 'IDAT') idat.push(d);
        else if (t === 'IEND') break;
        off += 12 + len;
    }
    if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
    const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (ch !== 4) throw new Error('expect RGBA(6), got colorType ' + colorType);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * ch;
    const out = Buffer.alloc(w * h * ch);
    let p = 0;
    for (let y = 0; y < h; y++) {
        const f = raw[p++];
        const row = raw.subarray(p, p + stride); p += stride;
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= ch ? cur[x - ch] : 0;
            const b = prev ? prev[x] : 0;
            const c = x >= ch && prev ? prev[x - ch] : 0;
            let v = row[x];
            if (f === 1) v += a;
            else if (f === 2) v += b;
            else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) {
                const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            cur[x] = v & 0xff;
        }
    }
    return { w, h, ch, data: out };
}

/* ───── PNG 编码（零依赖）───── */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const td = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
    return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const stride = w * 4;
    const raw = Buffer.alloc((stride + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (stride + 1)] = 0;
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
    ]);
}

/* ───── 面积加权降采样（保留 alpha 权重，避免边缘发白）───── */
function resample(src, sw, sh, dw, dh) {
    const out = Buffer.alloc(dw * dh * 4);
    const sx = sw / dw, sy = sh / dh;
    for (let y = 0; y < dh; y++) {
        const y0 = y * sy, y1 = (y + 1) * sy;
        const iy0 = Math.floor(y0), iy1 = Math.min(sh, Math.ceil(y1));
        for (let x = 0; x < dw; x++) {
            const x0 = x * sx, x1 = (x + 1) * sx;
            const ix0 = Math.floor(x0), ix1 = Math.min(sw, Math.ceil(x1));
            let r = 0, g = 0, b = 0, a = 0, wsum = 0;
            for (let yy = iy0; yy < iy1; yy++) {
                const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
                for (let xx = ix0; xx < ix1; xx++) {
                    const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
                    const w = wx * wy, o = (yy * sw + xx) * 4;
                    const al = src[o + 3] / 255;
                    r += src[o] * al * w; g += src[o + 1] * al * w; b += src[o + 2] * al * w;
                    a += al * w; wsum += w;
                }
            }
            const o = (y * dw + x) * 4;
            if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
            out[o + 3] = Math.round(a / wsum * 255);
        }
    }
    return out;
}

/* ───── 合成画布 ───── */
function makeCanvas(w, h, bg) {
    const c = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        c[i * 4] = bg[0]; c[i * 4 + 1] = bg[1]; c[i * 4 + 2] = bg[2]; c[i * 4 + 3] = 255;
    }
    return c;
}
function paste(dstW, dstH, dst, src, sw, sh, ox, oy, clip) {
    for (let y = 0; y < sh; y++) {
        const dy = oy + y; if (dy < 0 || dy >= dstH) continue;
        for (let x = 0; x < sw; x++) {
            const dx = ox + x; if (dx < 0 || dx >= dstW) continue;
            const so = (y * sw + x) * 4;
            let a = src[so + 3] / 255;
            if (clip) a *= clip(x, y, sw, sh);
            if (a <= 0) continue;
            const dofs = (dy * dstW + dx) * 4;
            dst[dofs] = Math.round(src[so] * a + dst[dofs] * (1 - a));
            dst[dofs + 1] = Math.round(src[so + 1] * a + dst[dofs + 1] * (1 - a));
            dst[dofs + 2] = Math.round(src[so + 2] * a + dst[dofs + 2] * (1 - a));
        }
    }
}
const roundRectClip = (radiusRatio) => (x, y, w, h) => {
    const r = w * radiusRatio, cx = w / 2, cy = h / 2;
    const dx = Math.abs(x + 0.5 - cx) - (cx - r), dy = Math.abs(y + 0.5 - cy) - (cy - r);
    const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
    return Math.max(0, Math.min(1, 0.5 - d));   // 1px 抗锯齿
};
const circleClip = (x, y, w, h) => {
    const d = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) - w / 2;
    return Math.max(0, Math.min(1, 0.5 - d));
};

/* ───── 主流程 ───── */
function main() {
    const buf = fs.readFileSync(SRC);
    const img = decodePNG(buf);

    /* 1) 规格自检 */
    const sizeMB = buf.length / 1024 / 1024;
    const checks = [
        ['格式 png/bmp/jpeg/jpg/gif', 'logo-144.png（PNG）', true],
        ['文件大小 ≤ 2M', `${(buf.length / 1024).toFixed(1)} KB`, sizeMB <= 2],
        ['建议尺寸 144×144', `${img.w} × ${img.h}`, img.w === 144 && img.h === 144],
        ['正方形', img.w === img.h ? '是' : '否', img.w === img.h],
        ['含 Alpha 通道', img.ch === 4 ? '是（RGBA）' : '否', img.ch === 4],
        ['百度/微信禁项：二维码·分享引导·他方水印', '无（人工确认）', true],
    ];
    console.log('── 图标规格自检 ──');
    for (const [k, v, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${k}：${v}`);

    /* 1.5) 主体占幅测量：小尺寸下能否认得出来，取决于主体占画面比例 */
    let minX = img.w, minY = img.h, maxX = -1, maxY = -1;
    for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
            const o = (y * img.w + x) * 4;
            const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
            const sat = Math.max(r, g, b) - Math.min(r, g, b);   // 彩色度
            const dark = Math.max(r, g, b) < 200;                 // 深色描边
            if (sat > 40 || dark) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    console.log('\n── 主体占幅 ──');
    console.log(`主体包围盒：${bw}×${bh} px（左上 ${minX},${minY}）`);
    console.log(`横向占幅：${(bw / img.w * 100).toFixed(0)}%   纵向占幅：${(bh / img.h * 100).toFixed(0)}%`);
    console.log(`四周留白：左 ${minX} / 右 ${img.w - 1 - maxX} / 上 ${minY} / 下 ${img.h - 1 - maxY} px`);
    console.log(`提示：占幅 < 70% 时，48px 列表位会明显偏小；70-85% 为理想区间。`);

    /* 2) 真实尺寸预览图 */
    const s144 = img.data;
    const s64 = resample(s144, 144, 144, 64, 64);
    const s48 = resample(s144, 144, 144, 48, 48);

    const PAD = 28, GAP = 26, ROW_H = 200;
    const items = [144, 144, 144, 64, 48];
    let W = PAD * 2;
    for (const s of items) W += s + GAP;
    W -= GAP;
    const H = ROW_H * 2 + 8;

    const dst = makeCanvas(W, H, [255, 255, 255]);
    // 第二行：深色底（部分展示位为深色）
    for (let y = ROW_H + 8; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            dst[o] = 0x19; dst[o + 1] = 0x19; dst[o + 2] = 0x19;
        }
    }

    // 第一行：白底 · 144 原图 / 144 圆角方形 / 144 圆形 / 64 / 48
    let x = PAD;
    const put = (src, s, y, clip) => { paste(W, H, dst, src, s, s, x, y, clip); x += s + GAP; };
    put(s144, 144, (ROW_H - 144) >> 1, null);
    put(s144, 144, (ROW_H - 144) >> 1, roundRectClip(0.2225));   // 小游戏图标实际展示形态
    put(s144, 144, (ROW_H - 144) >> 1, circleClip);              // 任务栏 / 圆形展示位
    put(s64, 64, (ROW_H - 64) >> 1, null);
    put(s48, 48, (ROW_H - 48) >> 1, null);

    // 第二行：深色底 · 144 原图 / 64 / 48
    x = PAD;
    const y0 = ROW_H + 8;
    put(s144, 144, y0 + ((ROW_H - 144) >> 1), null);
    put(s64, 64, y0 + ((ROW_H - 64) >> 1), null);
    put(s48, 48, y0 + ((ROW_H - 48) >> 1), null);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT, encodePNG(W, H, dst));
    console.log(`\n预览图：${path.relative(process.cwd(), OUT)}  (${W}×${H})`);
    console.log('第一行 白底：144 方形 / 144 圆角方形(实际展示) / 144 圆形 / 64 / 48');
    console.log('第二行 深色底：144 / 64 / 48');
}

main();
