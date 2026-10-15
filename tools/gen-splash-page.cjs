/* gen-splash-page.cjs —— 《动物集市》启动页整页插画生成器（可复跑，修改时间：2026-09-22 17:08）
 *
 * 背景：旧 gen-splash.cjs 产出「横版锁标 + 纯色竖底」被否（版式不像竖屏、风格不合）。
 *     2026-09-22 17:20 更新（v7，用户指令"放弃程序叠字，直接让 AI 把文字生成进图"）：
 *       **整图直出**：标题「动物集市」由 AI 直接生成进 master 整图（已逐字验收：四字准确、
 *       圆润卡通/奶白/深橄榄描边/硬投影/叶片装饰/位置正确），本脚本不再做 clearTitleZone
 *       与逐字渲染，buildPage 仅把 master 等比缩放到 960×2400 输出。
 *     历史版本（v1-v6.3）：程序化烘焙标题（幼圆字形掩码 + 膨胀分层），因多次被反馈
 *       描边断点/遮挡而逐步调参，最终按用户要求整体放弃。
 *
 * first-screen.js 绘制规则（build-templates/wechatgame/first-screen.js，自定义版 v3 未变）：
 *   - API 与引擎一致：start(alpha, antialias, useWebgl2)/setProgress(p)/end()；
 *   - 绘制：整页图 cover → 圆角跑道（stadium 体育场形，半透明白 α0.38）→ 暖黄填充 →
 *     小鸡（静态资源，UV 旋转 90° 头朝右）在跑道内沿道而行 → 终点 GL 矢量小卡车
 *     （最后绘制，加载完成小鸡走到车厢后被盖住＝"进车"）；
 *   - 不依赖编辑器「插屏设置」：本工具产物直接进包，构建即生效。
 *
 * 用法：
 *   node tools/gen-splash-page.cjs                  # 合成整页图(+build-templates 同步) + 小鸡素材 + 预览
 *   node tools/gen-splash-page.cjs --only=animal    # 只重拷小鸡素材
 *   node tools/gen-splash-page.cjs --only=preview   # 只重出机型预览
 *   node tools/gen-splash-page.cjs --check          # 校验构建产物（需已构建）
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const jpeg = loadDeps('jpeg-js');
const PImage = loadDeps('pureimage');
const { encodePNG, resizeBox, makeCanvas } = require('./splash-lib.cjs');

PImage.registerFont('C:/Windows/Fonts/SIMYOU.TTF', 'YouYuan').loadSync();

const ROOT = path.resolve(__dirname, '..', '..');                  // 工作区根
const MASTER = ROOT + '/store-assets/splash-page-master.jpg';
const OUT_ASSETS = ROOT + '/animal-market-cocos/assets/splash/splash-bg.png';
const OUT_BT = ROOT + '/animal-market-cocos/build-templates/wechatgame';   // 自定义 first-screen 素材目录
const PRE = ROOT + '/store-assets/splash-check';

const PAGE_W = 960, PAGE_H = 2400;                                  // 整页（宽高比 2.5 > 任意竖屏）
const NAME = '动物集市';
const TITLE_INK_H = 165;                                            // 标题墨迹高（图内 px）⇒ 屏上约 64pt
const TITLE_TOP = 728;                                              // 标题顶边 y

/* ---------- 依赖自举（装到 %TEMP%，不污染工程） ---------- */
function loadDeps(name) {
  const dir = path.join(os.tmpdir(), 'animal-market-splashgen');
  try { return require(path.join(dir, 'node_modules', name)); } catch (e) { /* 未装 */ }
  try { return require(name); } catch (e) { /* 工程内也没有 */ }
  fs.mkdirSync(dir, { recursive: true });
  const pkg = path.join(dir, 'package.json');
  if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'animal-market-splashgen', private: true, version: '1.0.0' }));
  console.log('首次运行：安装纯 JS 依赖到 ' + dir + ' …');
  require('child_process').execFileSync('npm', ['i', 'jpeg-js', 'pureimage', '--no-audit', '--no-fund'],
    { cwd: dir, encoding: 'utf8', shell: true, timeout: 600000 });
  return require(path.join(dir, 'node_modules', name));
}

/* ---------- 标题：掩码膨胀描边（v3 双层：深绿外框 + 浅黄绿内圈 + 奶油白伪粗体 + 投影） ---------- */
function glyphMaskAndFit(text, targetH) {
  const pt0 = 260;
  let g = glyphMask(text, pt0);
  let pt = pt0;
  for (let i = 0; i < 4 && Math.abs(g.inkH - targetH) > 2; i++) {
    pt = Math.max(80, Math.round(pt * targetH / g.inkH));
    g = glyphMask(text, pt);
  }
  // 裁剪到墨迹包围盒
  const full = new Float32Array(g.inkW * g.inkH);
  for (let ly = 0; ly < g.inkH; ly++) for (let lx = 0; lx < g.inkW; lx++) {
    full[ly * g.inkW + lx] = g.m[(g.by0 + ly) * g.w + (g.bx0 + lx)];
  }
  console.log('标题 ' + pt + 'pt ⇒ 墨迹 ' + g.inkW + 'x' + g.inkH + '（目标高 ' + targetH + '）');
  return { full, inkW: g.inkW, inkH: g.inkH };
}
function glyphMask(text, pt) {
  const W = Math.ceil(pt * text.length * 2 + 200), H = Math.ceil(pt * 2.2);
  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  ctx.font = pt + 'pt "YouYuan"';
  ctx.fillText(text, pt * 0.5, pt * 1.5);
  const m = new Float32Array(W * H);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cov = 1 - img.data[(y * W + x) * 4] / 255;
    m[y * W + x] = cov;
    if (cov > 0.35) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { w: W, h: H, m, bx0: x0, by0: y0, inkW: x1 - x0 + 1, inkH: y1 - y0 + 1 };
}
/** 方形膨胀（先横后纵取窗口最大值）：做描边 & 伪粗体 */
function dilate(m, w, h, r) {
  const a = new Float32Array(w * h), b = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let mx = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= w) continue; const v = m[y * w + xx]; if (v > mx) mx = v; }
    a[y * w + x] = mx;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let mx = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= h) continue; const v = a[yy * w + x]; if (v > mx) mx = v; }
    b[y * w + x] = mx;
  }
  return b;
}
/* ---------- 标题调色（v6.3 终版）：奶白填充 / 深橄榄描边 / 柔和翠绿投影 / 橄榄叶点缀 ---------- */
const CREAM_RGB = [255, 253, 245], OLIVE_RGB = [60, 92, 59], SHADOW_RGB = [58, 104, 76], LEAF_RGB = [90, 138, 60];
function blitMask(page, mask, w, h, dx, dy, rgb, alpha, thr = 0.05) {
  for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
    const v = mask[ly * w + lx]; if (v <= thr) continue;
    page.set(dx + lx, dy + ly, rgb[0], rgb[1], rgb[2], Math.round(v * alpha));
  }
}

/** 颜色量化（扁平插画友好：压缩率 ↑，肉眼几乎无差） */
function quantize(rgba, step = 8) {
  const q = (v) => Math.min(255, Math.round(v / step) * step);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = q(rgba[i]); rgba[i + 1] = q(rgba[i + 1]); rgba[i + 2] = q(rgba[i + 2]);
    rgba[i + 3] = rgba[i + 3] < 8 ? 0 : Math.min(255, Math.round(rgba[i + 3] / 8) * 8);
  }
  return rgba;
}

/* ---------- 叶片小贴片（v6 参考图标题装饰：文字角边点缀，很小不抢标题） ----------
 * 参数椭圆逐像素渲染（4x4 超采样抗锯齿），绕开 pureimage 画布不透明问题。 */
function leafPatch(deg, w = 52, h = 52) {
  const c = makeCanvas(w, h, null);
  const cx = w / 2, cy = h / 2;
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const LW = 21, SW = 9;                        // 叶长半轴 / 宽半轴
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    // 局部（未旋转）坐标：旋转矩阵逆变换
    const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
    const r2 = (u * u) / (LW * LW) + (v * v) / (SW * SW);
    if (r2 <= 1) {
      // 覆盖率：4 子采样近似（中心点落在椭圆内即覆盖，边界软度由量化承担）
      const t = 1 - r2;
      const al = Math.min(255, Math.round(120 + t * 135));   // 叶脉感：中心实、边缘透
      c.set(x, y, LEAF_RGB[0], LEAF_RGB[1], LEAF_RGB[2], al);
    }
  }
  // 叶柄：从叶根伸出的一小段短线（相对椭圆长轴方向）
  const px0 = cx - cos * LW, py0 = cy - sin * LW;
  const px1 = cx - cos * (LW + 12), py1 = cy - sin * (LW + 12);
  for (let t = 0; t <= 1; t += 0.02) {
    c.set(Math.round(px0 + (px1 - px0) * t), Math.round(py0 + (py1 - py0) * t),
      LEAF_RGB[0], LEAF_RGB[1], LEAF_RGB[2], 230);
  }
  return c;
}
function drawLeaf(page, x, y, deg) {
  const p = leafPatch(deg);
  page.draw(p.data, p.w, p.h, x, y, p.w, p.h, 1);
}

/* ---------- 标题区净空（v6.2）：把标题带及上方缓冲带重铺为纯天空渐变 ----------
 * 为什么需要：AI 底图的云羽化尾缘会贴近标题顶（v6.1 净空带从 y=690 起、标题顶 728，
 * 仅 38px 缓冲，云底仍视觉贴字）；且右上叶片贴片曾压进「市」右上角（红框复测确认）。
 * 做法：y[600..950] 整带逐行取左右**外缘采样带中值色**横向线性插值重铺 ⇒ 标题上方
 * 128px 纯渐变净空（云全部推离），下方留至标题底 894 以下 56px，绝不切卡车（顶 1052）。 */
function clearTitleZone(page) {
  const Y0 = 600, Y1 = 950;
  const FILL0 = 36, FILL1 = 924;
  const med = (samples) => { samples.sort((a, b) => a - b); return samples[Math.floor(samples.length / 2)]; };
  for (let y = Y0; y < Y1; y++) {
    const pick = (x0, x1) => {
      const rs = [], gs = [], bs = [];
      for (let x = x0; x < x1; x++) { const p = page.get(x, y); rs.push(p[0]); gs.push(p[1]); bs.push(p[2]); }
      return [med(rs), med(gs), med(bs)];
    };
    const L = pick(2, 30), R = pick(930, 958);
    for (let x = FILL0; x <= FILL1; x++) {
      const k = (x - FILL0) / (FILL1 - FILL0);
      page.set(x, y, Math.round(L[0] + (R[0] - L[0]) * k),
        Math.round(L[1] + (R[1] - L[1]) * k), Math.round(L[2] + (R[2] - L[2]) * k), 255);
    }
  }
}

/* ---------- 整页合成（v7 整图直出：标题已由 AI 生成进 master，仅等比缩放） ---------- */
function buildPage() {
  const img = jpeg.decode(fs.readFileSync(MASTER), { useTArray: true });
  const art = Buffer.from(img.data);                       // RGBA（alpha=255）
  const page = makeCanvas(PAGE_W, PAGE_H, null);
  page.draw(art, img.width, img.height, 0, 0, PAGE_W, PAGE_H, 1);
  console.log('整图直出：master ' + img.width + 'x' + img.height + ' → ' + PAGE_W + 'x' + PAGE_H +
    '（标题已烘焙在图中，无程序叠字）');

  fs.mkdirSync(path.dirname(OUT_ASSETS), { recursive: true });
  const png = encodePNG(PAGE_W, PAGE_H, quantize(page.data));
  fs.writeFileSync(OUT_ASSETS, png);
  fs.mkdirSync(OUT_BT, { recursive: true });
  fs.writeFileSync(OUT_BT + '/splash-bg.png', png);        // 同步进自定义 first-screen 素材
  console.log('写出 ' + OUT_ASSETS.replace(ROOT, '…') + '  ' + fs.statSync(OUT_ASSETS).size + 'B');
  console.log('写出 ' + OUT_BT.replace(ROOT, '…') + '/splash-bg.png（自定义 first-screen 用）');
}

/* ---------- 进度条小鸡素材：原字节拷贝游戏内已验证精灵 ----------
 * 为什么拷贝而不是手绘：pureimage 的 PImage.make 画布初始 alpha=255（不透明），
 * 手绘 PNG 落盘即全不透明（透明区呈黑色 RGB）——v2 黑底方块根因，实测
 * progress-animal.png 全图 alpha255。chicken.png 为 2048 调色板 PNG（tRNS 透明），
 * 游戏内 sprite 模式长期渲染正常 ⇒ 字节级可靠。 */
function buildAnimal() {
  fs.mkdirSync(OUT_BT, { recursive: true });
  const src = ROOT + '/animal-market-cocos/assets/resources/animal/chicken.png';
  const dst = OUT_BT + '/progress-animal.png';
  fs.copyFileSync(src, dst);
  // v3 起卡车由 first-screen.js GL 矢量绘制，清理 v2 遗留卡车贴图（含构建产物里的）
  for (const stale of [OUT_BT + '/progress-truck.png', ROOT + '/animal-market-cocos/build/wechatgame/progress-truck.png']) {
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }
  const same = fs.readFileSync(src).equals(fs.readFileSync(dst));
  console.log('拷贝小鸡精灵 → ' + dst.replace(ROOT, '…') + '  ' + fs.statSync(dst).size + 'B  字节一致=' + same);
  if (!same) throw new Error('小鸡素材拷贝校验失败');
}

/* ---------- 机型预览（375 宽 × 667/812/900 高可见窗口，居中裁切） ---------- */
function previews() {
  fs.mkdirSync(PRE, { recursive: true });
  const page = require('./splash-lib.cjs').decodePNG(fs.readFileSync(OUT_ASSETS));
  for (const H2 of [667, 812, 900]) {
    const winH = Math.round(PAGE_W / (375 / H2));
    const y0 = Math.round((PAGE_H - winH) / 2);
    const crop = Buffer.alloc(PAGE_W * winH * 4);
    page.data.copy(crop, 0, y0 * PAGE_W * 4, (y0 + winH) * PAGE_W * 4);
    const th = Math.round(winH / (PAGE_W / 480));
    const small = resizeBox(crop, PAGE_W, winH, 480, th);
    const f = PRE + '/page-' + H2 + '.png';
    fs.writeFileSync(f, encodePNG(480, th, small));
    console.log('预览 ' + f.replace(ROOT, '…') + '（375x' + H2 + ' 可见窗 y[' + y0 + '..' + (y0 + winH) + ']）');
  }
}

/* ---------- 构建产物校验（需已重新构建；自定义 first-screen 由 build-templates 注入） ---------- */
function checkBuild() {
  const f = ROOT + '/animal-market-cocos/build/wechatgame/first-screen.js';
  if (!fs.existsSync(f)) { console.log('✗ 找不到 ' + f + ' —— 请先在 Cocos 编辑器执行构建'); return; }
  const src = fs.readFileSync(f, 'utf8');
  const has = (re, label) => { const ok = re.test(src); console.log((ok ? '✓' : '✗') + ' ' + label); return ok; };
  const okV3 = has(/stadium/, 'first-screen.js 为自定义版（圆角跑道 stadium）');
  const okAnimal = has(/progress-animal\.png/, 'first-screen.js 含小鸡静态资源（progress-animal.png）');
  const noFade = !/texture2D\(u_Sampler, v_TexCoord\) \* u_Alpha/.test(src);   // 只匹配实际渐入乘法，注释提及不算
  console.log((noFade ? '✓' : '✗') + ' 已移除渐入（u_Alpha）');
  const noTruck = !/progress-truck\.png/.test(src);
  console.log((noTruck ? '✓' : '✗') + ' 已移除卡车贴图引用（卡车改 GL 矢量）');
  const files = ['first-screen.js', 'splash-bg.png', 'progress-animal.png'];
  const missing = files.filter((n) => !fs.existsSync(path.join(ROOT, 'animal-market-cocos/build/wechatgame', n)));
  if (okV3 && okAnimal && noFade && noTruck && missing.length === 0) {
    console.log('\n全部通过：自定义启动页 v3（圆角跑道 + 小鸡 + GL 卡车，无渐入）已在构建产物中。');
  } else {
    console.log('\n未完全生效：请先在 Cocos 编辑器【重新构建】；缺失文件：' + (missing.join('、') || '无') + '。');
  }
}

/* ---------- 入口 ---------- */
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
if (process.argv.includes('--check')) { checkBuild(); }
else if (only === 'animal') { buildAnimal(); }
else if (only === 'preview') { previews(); }
else { buildPage(); buildAnimal(); previews(); }