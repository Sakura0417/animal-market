/* 动物四向精灵规格化处理管线（源图 → 24 张 144×144 透明 PNG）
 * 修改时间：2026-09-07 00:35
 * 流程：解码源图 → 2×2 象限切割（TL=up TR=down BL=left BR=right）
 *   → 剔除右下角"豆包AI生成"水印 → 自边缘泛洪抠白底（保护白色身体内部）
 *   → 内容包围盒裁剪 → 等比缩放至画布 ~82% 居中 → PNG(RGBA) 编码落盘
 *   → 合成联络表 art-draft/contact-sheet-v2.png
 * 用法：node tools/build-animal-sprites.cjs
 */
const fs = require('fs');
const zlib = require('zlib');
const { inflateSync } = zlib;
const path = require('path');

/* ---------- PNG 解码（8bit / colorType 2|6 / 非隔行） ---------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, colorType = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('bitDepth ' + data[8] + ' unsupported');
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced unsupported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!ch) throw new Error('colorType ' + colorType + ' unsupported');
  const stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4); // 统一展开成 RGBA
  let pos = 0;
  const prevRow = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const row = raw.subarray(pos, pos + stride); pos += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prevRow ? prevRow[x] : 0;
      const c = x >= ch && prevRow ? prevRow[x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ch === 4) { out[o] = cur[x*4]; out[o+1] = cur[x*4+1]; out[o+2] = cur[x*4+2]; out[o+3] = cur[x*4+3]; }
      else if (ch === 3) { out[o] = cur[x*3]; out[o+1] = cur[x*3+1]; out[o+2] = cur[x*3+2]; out[o+3] = 255; }
      else if (ch === 2) { out[o] = out[o+1] = out[o+2] = cur[x*2]; out[o+3] = cur[x*2+1]; }
      else { const v = cur[x]; out[o] = out[o+1] = out[o+2] = v; out[o+3] = 255; }
    }
    prevRow.set(cur);
  }
  return { w, h, data: out };
}

/* ---------- PNG 编码（RGBA → PNG） ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
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

/* ---------- 处理步骤 ---------- */
// 象限切割
function quadrant(img, q) {
  const w = img.w >> 1, h = img.h >> 1;
  const ox = q % 2 === 0 ? 0 : w, oy = q < 2 ? 0 : h;
  const out = { w, h, data: Buffer.alloc(w * h * 4) };
  for (let y = 0; y < h; y++) {
    const src = ((oy + y) * img.w + ox) * 4;
    img.data.copy(out.data, y * w * 4, src, src + w * 4);
  }
  return out;
}

// 剔除水印：在右下区域找灰色文字像素（低饱和、中亮度）的包围盒并填白
function removeWatermark(q) {
  const { w, h, data } = q;
  const x0 = Math.floor(w * 0.55), y0 = Math.floor(h * 0.9);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = y0; y < h; y++) {
    for (let x = x0; x < w; x++) {
      const o = (y * w + x) * 4, r = data[o], g = data[o + 1], b = data[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 18 && mn > 150 && mx < 242) { // 灰字（背景为 >245 的白）
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return false;
  for (let y = Math.max(0, minY - 3); y <= Math.min(h - 1, maxY + 3); y++) {
    for (let x = Math.max(0, minX - 3); x <= Math.min(w - 1, maxX + 3); x++) {
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255; data[o + 3] = 255;
    }
  }
  return true;
}

// 抠白底（2026-09-07 00:50 重写，适配软 3D 渲染无描边素材）：
// 1) 只移除"与画面四边连通"的近白区域（含封闭近白口袋，如耳间隙）；
// 2) 柔和阴影/渐变边因不满足近白判定而完整保留（43px 下自然是接地感）。
// 近白判定：mn>=246 且 mx-mn<=6（纯白/中性白）；粉色/黄色等彩色身体永不满足。
/* 抠底（2026-09-07 01:25 形态学方案，适配软边 3D 渲染）：
 * 1) 泛洪：从四边移除"近白冷调"像素（背景），宽松阈值允许底色噪声一并去除；
 * 2) 多源 BFS：从所有不透明像素向外扩散，得到每个像素的最近不透明颜色与距离；
 * 3) 封缝：距离 ≤4 的透明像素用最近色回填（密封泛洪沿软边留下的细缝）；
 * 4) 补洞：不接触边界的封闭透明区域（≤60000px）用最近色回填（牛背高光洞、耳间隙）；
 * 5) 清岛：不接触边界的小型不透明岛（≤20000px，背景残渣）清除。 */
function removeWhiteBg(q, sp) {
  const { w, h, data } = q;
  const rules = {
    // 2026-09-07 01:20 收紧：宽松阈值会顺着绒毛/高光啃进身体（实测）
    default: (r, g, b, mx, mn) => mx - mn <= 4 && mn >= 249 && b - r >= -2,
    rabbit: (r, g, b, mx, mn) => mx - mn <= 2 && mn >= 252 && b - r >= 0,
  };
  const isBg = sp === 'rabbit' ? rules.rabbit : rules.default;
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const o = stack.pop();
    if (visited[o]) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (!isBg(r, g, b, mx, mn)) continue;
    visited[o] = 1;
    const x = o % w, y = (o / w) | 0;
    if (x > 0) stack.push(o - 1);
    if (x < w - 1) stack.push(o + 1);
    if (y > 0) stack.push(o - w);
    if (y < h - 1) stack.push(o + w);
  }
  for (let o = 0; o < w * h; o++) if (visited[o]) data[o * 4 + 3] = 0;

  // 多源 BFS：最近不透明颜色扩散
  const dist = new Uint32Array(w * h).fill(0xffffffff);
  const colorFrom = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  for (let o = 0; o < w * h; o++) {
    if (data[o * 4 + 3] >= 128) { dist[o] = 0; colorFrom[o] = o; queue[qt++] = o; }
  }
  while (qh < qt) {
    const o = queue[qh++];
    const x = o % w, y = (o / w) | 0, d = dist[o];
    if (x > 0 && dist[o - 1] > d + 1) { dist[o - 1] = d + 1; colorFrom[o - 1] = colorFrom[o]; queue[qt++] = o - 1; }
    if (x < w - 1 && dist[o + 1] > d + 1) { dist[o + 1] = d + 1; colorFrom[o + 1] = colorFrom[o]; queue[qt++] = o + 1; }
    if (y > 0 && dist[o - w] > d + 1) { dist[o - w] = d + 1; colorFrom[o - w] = colorFrom[o]; queue[qt++] = o - w; }
    if (y < h - 1 && dist[o + w] > d + 1) { dist[o + w] = d + 1; colorFrom[o + w] = colorFrom[o]; queue[qt++] = o + w; }
  }
  // 3) 封缝（半径 8：密封软边渗漏通道，色彩取最近不透明像素）
  for (let o = 0; o < w * h; o++) {
    if (dist[o] > 0 && dist[o] <= 8) {
      const src = colorFrom[o] * 4;
      data[o * 4] = data[src]; data[o * 4 + 1] = data[src + 1];
      data[o * 4 + 2] = data[src + 2]; data[o * 4 + 3] = 255;
    }
  }
  // 4) 回填所有"不接触边界"的封闭透明区（无面积上限）：被渗漏吃掉的
  //    高光/白身区域此时已封闭，用最近体色回填；腿间等真背景与边界连通，不受影响
  const comp = new Int32Array(w * h).fill(-1);
  let compId = 0;
  for (let o = 0; o < w * h; o++) {
    if (comp[o] !== -1 || data[o * 4 + 3] >= 128) continue;
    const members = [];
    const cs = [o]; comp[o] = compId;
    while (cs.length) {
      const c = cs.pop();
      members.push(c);
      const x = c % w, y = (c / w) | 0;
      if (x > 0 && comp[c - 1] === -1 && data[(c-1)*4+3] < 128) { comp[c - 1] = compId; cs.push(c - 1); }
      if (x < w - 1 && comp[c + 1] === -1 && data[(c+1)*4+3] < 128) { comp[c + 1] = compId; cs.push(c + 1); }
      if (y > 0 && comp[c - w] === -1 && data[(c-w)*4+3] < 128) { comp[c - w] = compId; cs.push(c - w); }
      if (y < h - 1 && comp[c + w] === -1 && data[(c+w)*4+3] < 128) { comp[c + w] = compId; cs.push(c + w); }
    }
    let touchesBorder = false;
    for (const c of members) {
      const x = c % w, y = (c / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { touchesBorder = true; break; }
    }
    if (!touchesBorder) {
      for (const c of members) {
        const src2 = colorFrom[c] * 4;
        data[c * 4] = data[src2]; data[c * 4 + 1] = data[src2 + 1];
        data[c * 4 + 2] = data[src2 + 2]; data[c * 4 + 3] = 255;
      }
    }
    compId++;
  }
  // 5) 清除不接触边界的小型不透明岛（背景残渣，≤20000px）
  for (let o = 0; o < w * h; o++) {
    if (comp[o] !== -1 || data[o * 4 + 3] < 128) continue;
    const members = [];
    const cs = [o]; comp[o] = compId;
    while (cs.length) {
      const c = cs.pop();
      members.push(c);
      const x = c % w, y = (c / w) | 0;
      if (x > 0 && comp[c - 1] === -1 && data[(c-1)*4+3] >= 128) { comp[c - 1] = compId; cs.push(c - 1); }
      if (x < w - 1 && comp[c + 1] === -1 && data[(c+1)*4+3] >= 128) { comp[c + 1] = compId; cs.push(c + 1); }
      if (y > 0 && comp[c - w] === -1 && data[(c-w)*4+3] >= 128) { comp[c - w] = compId; cs.push(c - w); }
      if (y < h - 1 && comp[c + w] === -1 && data[(c+w)*4+3] >= 128) { comp[c + w] = compId; cs.push(c + w); }
    }
    let touchesBorder = false;
    for (const c of members) {
      const x = c % w, y = (c / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { touchesBorder = true; break; }
    }
    if (!touchesBorder && members.length <= 20000) {
      for (const c of members) data[c * 4 + 3] = 0;
    }
    compId++;
  }
}

// 内容包围盒（按 alpha + 排除中性亮色的软阴影/残留晕边）
function bbox(q) {
  const { w, h, data } = q;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 40) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('empty quadrant');
  return { minX, minY, maxX, maxY };
}

// 双线性缩放（RGBA）
function resize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, (y + 0.5) * sh / dh - 0.5);
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, (x + 0.5) * sw / dw - 0.5);
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const v00 = src[(y0 * sw + x0) * 4 + c], v10 = src[(y0 * sw + x1) * 4 + c];
        const v01 = src[(y1 * sw + x0) * 4 + c], v11 = src[(y1 * sw + x1) * 4 + c];
        out[(y * dw + x) * 4 + c] = Math.round(
          v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty);
      }
    }
  }
  return out;
}

const TARGET = 144, COVER = 0.82;
function normalize(q) {
  const box = bbox(q);
  const bw = box.maxX - box.minX + 1, bh = box.maxY - box.minY + 1;
  const scale = Math.min(TARGET * COVER / bw, TARGET * COVER / bh);
  const dw = Math.max(1, Math.round(bw * scale)), dh = Math.max(1, Math.round(bh * scale));
  const cropped = { w: bw, h: bh, data: Buffer.alloc(bw * bh * 4) };
  for (let y = 0; y < bh; y++) {
    const src = ((box.minY + y) * q.w + box.minX) * 4;
    q.data.copy(cropped.data, y * bw * 4, src, src + bw * 4);
  }
  const scaled = resize(cropped.data, bw, bh, dw, dh);
  const out = Buffer.alloc(TARGET * TARGET * 4);
  const ox = (TARGET - dw) >> 1, oy = (TARGET - dh) >> 1;
  for (let y = 0; y < dh; y++) scaled.copy(out, ((oy + y) * TARGET + ox) * 4, y * dw * 4, (y + 1) * dw * 4);
  return { w: TARGET, h: TARGET, data: out };
}

/* ---------- 主流程（仅直接运行时执行；函数供测试 require） ---------- */
function main() {
const SRC = path.join('art-draft', 'src');
const OUTDIR = path.join('assets','resources','art','animals');
fs.mkdirSync(OUTDIR, { recursive: true });
const DIRS = ['up', 'down', 'left', 'right']; // TL TR BL BR（与生成 Prompt 约定一致）
let done = 0;
for (const sp of ['chicken', 'duck', 'rabbit', 'sheep', 'pig', 'cow']) {
  const img = decodePNG(fs.readFileSync(path.join(SRC, sp + '.png')));
  for (let q = 0; q < 4; q++) {
    let quad = quadrant(img, q);
    if (q === 3) removeWatermark(quad); // 水印只在整图右下角
    removeWhiteBg(quad, sp);
    const out = normalize(quad);
    const file = path.join(OUTDIR, sp + '_' + DIRS[q] + '.png');
    fs.writeFileSync(file, encodePNG(out.w, out.h, out.data));
    done++;
  }
  console.log(sp + ': 4 张完成');
}
console.log('合计 ' + done + ' 张 → ' + OUTDIR);

/* ---------- 联络表 ---------- */
const cell = 144, pad = 18, label = 16, cols = 4;
const files = [];
for (const sp of ['chicken', 'duck', 'rabbit', 'sheep', 'pig', 'cow'])
  for (const d of DIRS) files.push(sp + '_' + d);
const rows = Math.ceil(files.length / cols);
const sheet = { w: cols * (cell + pad) + pad, h: rows * (cell + pad + label) + pad };
sheet.data = Buffer.alloc(sheet.w * sheet.h * 4);
for (let i = 0; i < sheet.w * sheet.h; i++) { sheet.data[i*4] = 0xe9; sheet.data[i*4+1] = 0xf1; sheet.data[i*4+2] = 0xf8; sheet.data[i*4+3] = 255; }
files.forEach((name, k) => {
  const img = decodePNG(fs.readFileSync(path.join(OUTDIR, name + '.png')));
  const cx = pad + (k % cols) * (cell + pad), cy = pad + Math.floor(k / cols) * (cell + pad + label);
  for (let y = 0; y < img.h; y++) img.data.copy(sheet.data, ((cy + y) * sheet.w + cx) * 4, y * img.w * 4, (y + 1) * img.w * 4);
  // 简易字标注：跳过（无字体渲染），以行列顺序对应名称
});
fs.writeFileSync(path.join('art-draft', 'contact-sheet-v2.png'), encodePNG(sheet.w, sheet.h, sheet.data));
console.log('联络表 → art-draft/contact-sheet-v2.png（行序：chicken/duck/rabbit/sheep/pig/cow × [up,down,left,right]）');
}
module.exports = { decodePNG, encodePNG };
if (require.main === module) main();
