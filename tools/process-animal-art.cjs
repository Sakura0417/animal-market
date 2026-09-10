/* 动物美术处理管线（VIEW 资源预处理）
 * 修改时间：2026-09-10 18:33 —— 源目录迁出 assets/（2026-09-10）：2048 原始大图不再放在
 *   assets/animal（会被编辑器当纹理资产导入、拖慢 library，且一旦被引用就冲进 4MB 主包），
 *   移到工程外 ../raw-art/animals-2048-src/。默认 srcDir 同步更新。
 * 用法：node tools/process-animal-art.cjs [srcDir] [outDir] [size]
 *   默认 srcDir=../raw-art/animals-2048-src（原始大图，2048×2048 白底顶视角）
 *        outDir=assets/resources/animal（降采样产物，运行时 resources.load 目标目录）
 *        size=256
 * 历史：初版源目录 = extensions/cocos-mcp-server/static/2d
 *
 * 输入：{srcDir}/{species}.png（2048×2048 RGBA8 白底顶视角图）
 * 输出：{outDir}/{species}.png（256×256 RGBA8，单图含透明 alpha）
 *
 * 处理流程：
 *   1. 零依赖 PNG 解码（zlib 内置，参考 tools/png-probe.cjs）
 *   2. 右下 512×512 区域填白 255,255,255 —— 去除"豆包AI生成"水印（防御性：
 *      2026-09-08 新一批源图已无水印，此步对无水印图无副作用，背景本来就是白）
 *   3. Flood fill 白→透明（2026-09-08 17:13 改造）：从 4 角 BFS 扩展，仅对与边界连通的
 *      近白像素（max(R,G,B)≥240）做透明化。动物本体内部的白色（被轮廓封闭、不与边界
 *      连通）天然保留为完全不透明 → 修复了「白→透明键控误伤动物白色本体（兔毛/羊
 *      卷毛/白鸭羽毛/牛白腹）→ 视觉残破」的问题。
 *      边缘抗锯齿：交给 step 4 的 8×8 box filter 自然产生（不透明 vs 透明的混合）
 *   4. 8×8 box filter 降采样到 256×256（保留原比例不裁剪，动物居中显示）
 *   5. 零依赖 PNG 编码（手写 IHDR/IDAT/IEND chunks + CRC32）
 *
 * 设计要点：
 *   - 不裁透明边：保留"动物居中、周围留白"的原构图，与游戏格子比例（动物占 cell ~70%）吻合
 *   - 资源命名 {species}.png（单图顶视角，无方向后缀）：
 *     AnimalArt.ts 的 loadAnimalSpriteFrame(species, dir, cb) 中 dir 仅作兼容垫片
 *     实际只加载单图，运行时按 dir 旋转节点 spNode.angle = -CSS_DEG[dir]（cocos angle 逆时针为正）
 *   - 输出目录必须位于 assets/resources/ 下：Cocos resources.load 只能加载该目录，
 *     且未被引用的 assets/ 资源不会打进构建产物。
 */
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

const SRC_DIR = process.argv[2] || '../raw-art/animals-2048-src';
const OUT_DIR = process.argv[3] || 'assets/resources/animal';
const OUT_SIZE = parseInt(process.argv[4], 10) || 256;   // 降采样目标边长
const SRC_SIZE = 2048;           // 源图边长
const WM_BOX = 1536;             // 水印填白区起点（右下 512×512 区域）
const WHITE_R = 255, WHITE_G = 255, WHITE_B = 255;
const KEY_WHITE = 240;           // flood fill 阈值：max(R,G,B) ≥ 此值视为近白像素（背景候选）

// 动物清单（与 AnimalSchema.ANIMAL_SCHEMA 顺序一致；本工具不读取 schema 以避免依赖编译产物）
const SPECIES = ['chicken', 'duck', 'rabbit', 'sheep', 'pig', 'cow'];
// 已知有水印的图（豆包AI生成水印在右下角）：统一处理为填白，对无水印的图也是无副作用（背景本来就是白）
// 之所以不区分清单：填白区域是 (WM_BOX..SRC_SIZE) 的右下矩形，恰好覆盖水印又不影响主体

/* ───── PNG 解码（零依赖）───── */
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
  const ch = {0:1,2:3,3:1,4:2,6:4}[colorType];
  if (!ch) throw new Error('unsupported colorType ' + colorType);
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
  // IHDR: 宽、高、8、6 (RGBA)、0、0、0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // IDAT: filter 0 (None) + RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ───── 单图处理 ───── */
function processOne(species) {
  const inPath = path.join(SRC_DIR, species + '.png');
  const outPath = path.join(OUT_DIR, species + '.png');
  if (!fs.existsSync(inPath)) throw new Error('missing: ' + inPath);

  const src = decodePNG(fs.readFileSync(inPath));
  if (src.w !== SRC_SIZE || src.h !== SRC_SIZE) {
    throw new Error(`${species}: expected ${SRC_SIZE}×${SRC_SIZE}, got ${src.w}×${src.h}`);
  }
  const px = src.data, ch = src.ch;

  // 2. 去水印：右下 512×512 区域填白（覆盖"豆包AI生成"水印+白底）
  for (let y = WM_BOX; y < SRC_SIZE; y++) {
    for (let x = WM_BOX; x < SRC_SIZE; x++) {
      const o = (y * SRC_SIZE + x) * ch;
      px[o] = WHITE_R; px[o + 1] = WHITE_G; px[o + 2] = WHITE_B;
      if (ch === 4) px[o + 3] = 255;
    }
  }

  // 3. Flood fill 白→透明：仅对与边界连通的近白像素做透明化
  //    关键：动物本体内部白色（兔毛/羊卷毛/白鸭羽毛/牛白腹）被轮廓封闭、不与边界连通，
  //    不会被命中 → 保留为完全不透明，避免全局白→透明键控「误伤动物本体」导致的残破。
  //    边界连通性靠 BFS 4 邻域扩展保证；4 角作为种子保证无论动物主体在图内位置如何都能
  //    正确分离背景。
  const visited = new Uint8Array(SRC_SIZE * SRC_SIZE);
  const isNearWhite = (r, g, b) => Math.max(r, g, b) >= KEY_WHITE;
  const idx = (x, y) => y * SRC_SIZE + x;
  // 4 角种子入栈
  const stack = [[0, 0], [SRC_SIZE - 1, 0], [0, SRC_SIZE - 1], [SRC_SIZE - 1, SRC_SIZE - 1]];
  while (stack.length) {
    const x = stack[stack.length - 1][0], y = stack[stack.length - 1][1];
    stack.pop();
    if (x < 0 || x >= SRC_SIZE || y < 0 || y >= SRC_SIZE) continue;
    const i = idx(x, y);
    if (visited[i]) continue;
    const o = i * ch;
    if (!isNearWhite(px[o], px[o + 1], px[o + 2])) { visited[i] = 1; continue; }
    visited[i] = 1;
    if (ch === 4) px[o + 3] = 0;                  // 背景白：透明
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  // 未访问像素：动物本体 → 完全不透明（边缘抗锯齿交给 box filter 自然混合）
  for (let i = 0; i < SRC_SIZE * SRC_SIZE; i++) {
    if (ch === 4 && !visited[i]) px[i * ch + 3] = 255;
  }

  // 4. 8×8 box filter 降采样到 256×256（RGBA 独立平均，简单且足够）
  const ratio = SRC_SIZE / OUT_SIZE; // 8
  const out = Buffer.alloc(OUT_SIZE * OUT_SIZE * 4);
  for (let oy = 0; oy < OUT_SIZE; oy++) {
    for (let ox = 0; ox < OUT_SIZE; ox++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = ox * ratio, y0 = oy * ratio;
      for (let yy = 0; yy < ratio; yy++) {
        for (let xx = 0; xx < ratio; xx++) {
          const o = ((y0 + yy) * SRC_SIZE + (x0 + xx)) * ch;
          r += px[o]; g += px[o + 1]; b += px[o + 2];
          if (ch === 4) a += px[o + 3];
          n++;
        }
      }
      const oo = (oy * OUT_SIZE + ox) * 4;
      out[oo]     = Math.round(r / n);
      out[oo + 1] = Math.round(g / n);
      out[oo + 2] = Math.round(b / n);
      out[oo + 3] = Math.round(a / n);
    }
  }

  const png = encodePNG(OUT_SIZE, OUT_SIZE, out);
  fs.writeFileSync(outPath, png);
  return png.length;
}

/* ───── 主流程 ───── */
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
let totalIn = 0, totalOut = 0;
for (const sp of SPECIES) {
  const inSize = fs.statSync(path.join(SRC_DIR, sp + '.png')).size;
  const outSize = processOne(sp);
  totalIn += inSize; totalOut += outSize;
  const r = (outSize / inSize * 100).toFixed(1);
  console.log(`  ${sp.padEnd(8)} ${(inSize/1048576).toFixed(2)}MB → ${(outSize/1024).toFixed(1)}KB (${r}%)`);
}
console.log(`TOTAL: ${(totalIn/1048576).toFixed(2)}MB → ${(totalOut/1024).toFixed(1)}KB`);
console.log('输出目录:', OUT_DIR);
