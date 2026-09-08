/* GLB 模型验收检查器（Node 无依赖）：面数 / 贴图 / 材质 / 尺寸概览。
 * 用法：node tools/inspect-glb.cjs <model1.glb> [model2.glb ...]
 * 输出：体积、三角面数、网格/图元/材质/贴图数、贴图字节数与分辨率(mimeType)、
 *       Draco/meshopt 压缩标志、Y-up 包含场景根变换提示（translation/scale 非零）。 */
const fs = require('fs');

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('不是 GLB（magic 不符）');
  let off = 12, json = null, binLen = 0;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4E4F534A) json = JSON.parse(buf.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004E4942) binLen = len;
    off += 8 + len;
  }
  return { json: json, binLen: binLen };
}

function inspect(path) {
  const buf = fs.readFileSync(path);
  const { json, binLen } = parseGlb(buf);
  const g = json;
  let tris = 0, verts = 0;
  const meshTris = [];
  (g.meshes || []).forEach(m => {
    let mt = 0;
    (m.primitives || []).forEach(p => {
      if (p.mode !== undefined && p.mode !== 4) return;
      if (p.indices !== undefined) mt += g.accessors[p.indices].count / 3;
      else if (p.attributes.POSITION !== undefined) mt += g.accessors[p.attributes.POSITION].count / 3;
      if (p.attributes.POSITION !== undefined) verts += g.accessors[p.attributes.POSITION].count;
    });
    meshTris.push(Math.round(mt));
    tris += mt;
  });
  const imgs = (g.images || []).map(im => {
    const bv = im.bufferView !== undefined ? g.bufferViews[im.bufferView] : null;
    return { mime: im.mimeType || '?', bytes: bv ? bv.byteLength : 0 };
  });
  const exts = Object.keys((g.extensionsUsed || [])).length ? g.extensionsUsed : [];
  // 材质贴图引用：哪些贴图槽位被用到
  const texSlots = new Set();
  (g.materials || []).forEach(m => {
    const p = m.pbrMetallicRoughness || {};
    if (p.baseColorTexture) texSlots.add('baseColor');
    if (p.metallicRoughnessTexture) texSlots.add('metalRough');
    if (m.normalTexture) texSlots.add('normal');
    if (m.occlusionTexture) texSlots.add('occlusion');
    if (m.emissiveTexture) texSlots.add('emissive');
  });
  // 场景根节点变换（规格要求归零）
  const scene = g.scenes && g.scenes[g.scene || 0];
  const rootIssues = [];
  ((scene && scene.nodes) || []).forEach(ni => {
    const n = g.nodes[ni];
    if (n.translation && (n.translation[0] || n.translation[1] || n.translation[2])) rootIssues.push('translation=' + JSON.stringify(n.translation));
    if (n.scale && (n.scale[0] !== 1 || n.scale[1] !== 1 || n.scale[2] !== 1)) rootIssues.push('scale=' + JSON.stringify(n.scale));
    if (n.rotation) rootIssues.push('rotation=' + JSON.stringify(n.rotation));
  });
  const kb = (buf.length / 1024).toFixed(0);
  console.log('== ' + path.split(/[\\/]/).pop() + ' == ' + kb + 'KB');
  console.log('  三角面: ' + Math.round(tris) + '（mesh 拆分: ' + meshTris.join('+') + '）  顶点: ' + verts);
  console.log('  材质: ' + ((g.materials || []).length) + '  贴图槽: [' + [...texSlots].join(',') + ']  图片: ' + (imgs.length ? imgs.map(i => i.mime.split('/')[1] + ':' + (i.bytes / 1024).toFixed(0) + 'KB').join(', ') : '无（顶点色/纯色材质）'));
  console.log('  压缩扩展: ' + (exts.length ? exts.join(',') : '无') + (binLen ? '  BIN: ' + (binLen / 1024).toFixed(0) + 'KB' : ''));
  console.log('  根节点变换: ' + (rootIssues.length ? rootIssues.join(' ') : '无 ✓'));
  const fail = [];
  if (Math.round(tris) > 3000) fail.push('面数超线(≤3000)');
  if (binLen / 1024 > 400) fail.push('BIN 超 400KB');
  if (exts.some(e => /Draco|meshopt|KTX/i.test(e))) fail.push('含微信端风险压缩扩展');
  if (imgs.some(i => i.mime === 'image/ktx2')) fail.push('含 KTX2 贴图');
  console.log(fail.length ? '  ⚠ 超线: ' + fail.join(' / ') : '  ✓ 全部过线（≤3000 面 / ≤150KB 目标按 BIN 宽限 400KB 初检）');
  console.log('');
}

process.argv.slice(2).forEach(p => { try { inspect(p); } catch (e) { console.log('== ' + p + ' == 解析失败: ' + e.message + '\n'); } });
