/* 冒烟测试辅助：PNG 像素采样器（零依赖，zlib 内置）。
 * 修改时间：2026-09-06 01:10:00
 * 用法：node tools/png-probe.cjs <png路径> <x> <y> [x2 y2 ...]  → 每点输出 R,G,B,A
 * 用途：浏览器截图的按钮/标记像素实测（A3 冒烟证据用）。 */
const { readFileSync } = require('node:fs');
const { inflateSync } = require('node:zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth + ' not supported');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * channels);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride); pos += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= channels && prev ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, channels, data: out };
}

const [file, ...pts] = process.argv.slice(2);
const img = decodePNG(readFileSync(file));
for (let i = 0; i < pts.length; i += 2) {
  const x = parseInt(pts[i], 10), y = parseInt(pts[i + 1], 10);
  const o = (y * img.w + x) * img.channels;
  console.log(x + ',' + y + ' -> R=' + img.data[o] + ' G=' + img.data[o + 1] + ' B=' + img.data[o + 2]);
}
