// splash-lib.cjs —— 零依赖 PNG 工具（编码/解码/盒式缩放/离屏画布），供 gen-splash.cjs 使用
// 零依赖 PNG 工具：解码（8bit 非隔行，灰度/RGB/RGBA）、编码（RGBA）、盒式缩放
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA 像素缓冲 → PNG 文件 Buffer */
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG 文件 Buffer → { w, h, data: RGBA Buffer } */
function decodePNG(buf) {
  let pos = 8, idat = [], w = 0, h = 0, ctype = 6, depth = 8, interlace = 0;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error('仅支持 8bit 非隔行 PNG');
  const nch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * nch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= nch ? line[i - nch] : 0, b = prev[i], c = i >= nch ? prev[i - nch] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      const s = x * nch, d = (y * w + x) * 4;
      if (nch === 1) { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = 255; }
      else if (nch === 2) { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = line[s + 1]; }
      else if (nch === 3) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255; }
      else { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]; }
    }
    prev = line;
  }
  return { w, h, data: out };
}

/** 盒式均值缩放（降采样首选：不引入振铃，JPEG 噪声也能被平均掉） */
function resizeBox(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.min(sh, Math.max(y0 + 1, Math.round((y + 1) * sy)));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(sw, Math.max(x0 + 1, Math.round((x + 1) * sx)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * sw + xx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += src[o + 3];
          n++;
        }
      }
      const o = (y * dw + x) * 4;
      const aAvg = a / n;
      if (aAvg > 0) { const wa = aAvg / 255 * n || 1; out[o] = Math.round(r / wa); out[o + 1] = Math.round(g / wa); out[o + 2] = Math.round(b / wa); }
      out[o + 3] = Math.round(aAvg);
    }
  }
  return out;
}

/** 建立坐标/像素工具（半透明叠加时用直式 alpha 合成） */
function makeCanvas(w, h, bg) {
  const data = Buffer.alloc(w * h * 4);
  if (bg) for (let i = 0; i < w * h; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = bg[3] === undefined ? 255 : bg[3]; }
  return {
    w, h, data,
    set(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const o = (y * w + x) * 4;
      const sa = a / 255, da = data[o + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) return;
      data[o] = Math.round((r * sa + data[o] * da * (1 - sa)) / oa);
      data[o + 1] = Math.round((g * sa + data[o + 1] * da * (1 - sa)) / oa);
      data[o + 2] = Math.round((b * sa + data[o + 2] * da * (1 - sa)) / oa);
      data[o + 3] = Math.round(oa * 255);
    },
    get(x, y) { const o = (y * w + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; },
    /** 把一张 RGBA 位图（可整体缩放 + 透明度）叠加进来 */
    draw(src, sw, sh, dx, dy, dw, dh, alpha = 1) {
      const scaled = (sw === dw && sh === dh) ? src : resizeBox(src, sw, sh, dw, dh);
      for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
          const o = (y * dw + x) * 4;
          if (scaled[o + 3] === 0) continue;
          this.set(dx + x, dy + y, scaled[o], scaled[o + 1], scaled[o + 2], Math.round(scaled[o + 3] * alpha));
        }
      }
    },
  };
}

module.exports = { encodePNG, decodePNG, resizeBox, makeCanvas };
