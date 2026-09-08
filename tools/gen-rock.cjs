/* 程序化生成低模岩石 rock.glb（占位资产，可被用户生成模型替换）。
 * 规格：Y-up / 脚底原点 y=0 / x,z 居中 / 高度≈1.0 / ~320 三角面 / 顶点色灰岩 / 无贴图无骨骼。
 * 用法：node tools/gen-rock.cjs [输出路径]  （默认 assets/animal/rock.glb）
 * 结构：二十面体 → 2 次细分 → 球形 → 椭球压扁 + 确定性噪声扰动 + 底部压平 → 顶点色。 */
const fs = require('fs');

/* 确定性 PRNG（mulberry32），保证重复生成结果一致 */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 二十面体顶点/面 */
const T = (1 + Math.sqrt(5)) / 2;
let verts = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
].map(v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; });
let faces = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/* 细分 n 次（中点细分 + 顶点缓存） */
function subdivide(times) {
  for (let t = 0; t < times; t++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (cache.has(key)) return cache.get(key);
      const m = [(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2];
      verts.push(m); cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nf;
  }
}
subdivide(2);

/* 塑形：椭球 + 噪声 + 底部压平，高度≈1、脚底 y=0、x/z 居中 */
const rng = mulberry32(20260907);
const vnoise = verts.map(() => 1 + (rng() - 0.5) * 0.22);   // 每顶点半径扰动
const shaped = verts.map((v, i) => {
  const n = vnoise[i];
  let x = v[0] * 0.62 * n, y = v[1] * 0.50 * n, z = v[2] * 0.56 * n;
  y = Math.max(y, 0) * 1.9;                                  // 底部截平（y<0 归 0），整体抬高
  if (y < 0.1) y *= 0.4;                                     // 底缘小倒角
  return [x, y, z];
});
const minY = Math.min(...shaped.map(v => v[1]));
const pts = shaped.map(v => [v[0], v[1] - minY, v[2]]);      // 脚底 = y0

/* 顶点法线（面法线累积） */
const normals = pts.map(() => [0, 0, 0]);
for (const [a, b, c] of faces) {
  const ux = pts[b][0] - pts[a][0], uy = pts[b][1] - pts[a][1], uz = pts[b][2] - pts[a][2];
  const vx = pts[c][0] - pts[a][0], vy = pts[c][1] - pts[a][1], vz = pts[c][2] - pts[a][2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const i of [a, b, c]) { normals[i][0] += nx; normals[i][1] += ny; normals[i][2] += nz; }
}
normals.forEach(n => { const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; });

/* 顶点色：灰岩 + 轻微冷暖抖动（底部更深） */
const colors = pts.map((p, i) => {
  const shade = 0.60 + vnoise[i] * 0.10 + (p[1] < 0.15 ? -0.12 : 0);
  return [shade * 0.98, shade * 0.98, shade * 1.02];
});

/* 打包 GLB */
const f32 = Array.prototype.concat.apply([], pts);
const n32 = Array.prototype.concat.apply([], normals);
const c32 = Array.prototype.concat.apply([], colors);
const idx = []; faces.forEach(f => idx.push(f[0], f[1], f[2]));
const pad4 = n => (n + 3) & ~3;
const pBuf = Buffer.from(new Float32Array(f32).buffer);
const nBuf = Buffer.from(new Float32Array(n32).buffer);
const cBuf = Buffer.from(new Float32Array(c32).buffer);
const iBuf = Buffer.from(new Uint16Array(idx).buffer);
const binLen = pBuf.length + nBuf.length + cBuf.length + iBuf.length;
const bin = Buffer.concat([pBuf, nBuf, cBuf, iBuf, Buffer.alloc(pad4(binLen) - binLen)]);
const bv = (b, target) => ({ buffer: 0, byteOffset: b.offset, byteLength: b.length, target: target });
let off = 0; const chunks = [pBuf, nBuf, cBuf, iBuf].map(b => { const o = { offset: off, length: b.length }; off += b.length; return o; });
const gltf = {
  asset: { version: '2.0', generator: 'animal-market gen-rock.cjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'rock' }],
  meshes: [{ name: 'rock', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
  materials: [{
    name: 'rock_mat', doubleSided: false,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.0, roughnessFactor: 0.9 }
  }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [bv(chunks[0], 34962), bv(chunks[1], 34962), bv(chunks[2], 34962), bv(chunks[3], 34963)],
  accessors: [
    { bufferView: 0, componentType: 5126, count: pts.length, type: 'VEC3', min: [-0.8, 0, -0.8], max: [0.8, 1.0, 0.8] },
    { bufferView: 1, componentType: 5126, count: pts.length, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: pts.length, type: 'VEC3' },
    { bufferView: 3, componentType: 5123, count: idx.length, type: 'SCALAR' },
  ],
};
const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPad = Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20);
const binPad = Buffer.alloc(pad4(bin.length) - bin.length, 0);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + jsonPad.length + 8 + bin.length + binPad.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length + jsonPad.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length + binPad.length, 0); bh.writeUInt32LE(0x004E4942, 4);
const out = process.argv[2] || 'assets/animal/rock.glb';
fs.writeFileSync(out, Buffer.concat([header, jh, jsonBuf, jsonPad, bh, bin, binPad]));
console.log('rock.glb 已生成: ' + out + '  ' + (fs.statSync(out).size / 1024).toFixed(0) + 'KB  三角面: ' + faces.length + '  顶点: ' + pts.length);
