/* 水印扫描器：检测源图右下角 512×512 区域的暗像素（判定"豆包AI生成"等水印是否存在）
 * 修改时间：2026-09-08（由原 _scan-watermark.cjs 升级：源目录改为命令行参数，适配任意批次）
 * 用法：node tools/scan-watermark.cjs <目录> <文件名.png> [...]
 *   例：node tools/scan-watermark.cjs ../raw-art/animals-2048-src chicken.png cow.png
 * 输出：darkPx@RB512 = 右下角暗像素数；>0 即存在水印（含 bbox），=0 即无水印
 * 说明：零依赖（zlib 内置），复用 tools/png-probe.cjs 的 PNG 解码思路 */
const {readFileSync} = require('node:fs');
const {inflateSync} = require('node:zlib');

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bd = 8, ct = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const t = buf.toString('ascii', off + 4, off + 8);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    off += 12 + len;
  }
  const ch = {0:1,2:3,3:1,4:2,6:4}[ct];
  if (bd !== 8) throw new Error('bitDepth ' + bd);
  const raw = inflateSync(Buffer.concat(idat));
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

const dir = process.argv[2];
const files = process.argv.slice(3);
if (!dir || files.length === 0) {
  console.error('用法: node tools/scan-watermark.cjs <目录> <文件.png> [...]');
  process.exit(1);
}
for (const f of files) {
  const img = decode(readFileSync(dir + '/' + f));
  let n = 0, minX = img.w, maxX = 0, minY = img.h, maxY = 0;
  for (let y = img.h - 512; y < img.h; y++) {
    for (let x = img.w - 512; x < img.w; x++) {
      const o = (y * img.w + x) * img.ch;
      if (img.data[o] < 100 && img.data[o + 1] < 100 && img.data[o + 2] < 100) {
        n++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  console.log(f.padEnd(14), 'darkPx@RB512=', String(n).padStart(6),
    n > 0 ? ('bbox=' + minX + ',' + minY + '~' + maxX + ',' + maxY + '  ⚠ 有水印') : '（无水印）');
}
