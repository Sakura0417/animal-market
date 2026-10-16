/* gen-splash.cjs —— 《动物集市》启动插屏素材生成器（可复跑）
 * ⚠️ 2026-09-21 23:13 已弃用：本工具产出的「横版锁标 + 纯色竖底」两件套被用户否掉
 *   （版式不像竖屏、风格与游戏首屏不符）。新设计为「整页竖屏插画」，见 gen-splash-page.cjs。
 *   保留本文件仅作历史，勿再运行。
 *
 * 产物（直接写进 Cocos 工程，供「项目设置 → 插屏设置」或「构建发布 → 替换插屏」使用）：
 *   animal-market-cocos/assets/splash/splash-logo.png  1200x510 透明锁标（游戏名 + 卡车）
 *   animal-market-cocos/assets/splash/splash-bg.png    750x2400 竖向底色（cover 版，任意屏不露底）
 * 自检图（store-assets/splash-check/）：silhouette.png / preview-812.png / preview-667.png
 *
 * 用法：
 *   node tools/gen-splash.cjs                  # 生成全部 + 自检图
 *   node tools/gen-splash.cjs --only=bg        # 只重出底色
 *   node tools/gen-splash.cjs --only=logo      # 只重出锁标
 *   node tools/gen-splash.cjs --verify=<截图>   # 实测"插屏底色 vs 游戏首帧底色"的色差
 *
 * 三条硬约束（来自 build/wechatgame/first-screen.js 与其模板 first-screen.ejs，改素材前必读）：
 *   ① logo 槽：绘制高度 = 屏高 x 18.5% x displayRatio，居中，宽高比保持。
 *      ⇒ 图片宽高比必须 ≤ 屏宽/(0.185x屏高) ≈ 2.5，否则左右被裁。故锁标只能做"横版"：
 *        游戏名在上、卡车在下（竖版会把名字压得极小）。
 *   ② bg 槽：fitWidth（按宽铺满、竖向居中）⇒ 图比屏幕"矮"时上下会露纯色边。
 *      故底色做 750x2400（宽高比 0.3125，比任何手机都瘦）⇒ 永远溢出裁切，不露底。
 *   ③ 底色必须与游戏首帧一致（GameView 的四段平带 #97d68d/#8bcf80/#82ca7b/#6cbf6e），
 *      否则插屏切进游戏会"闪一下"。做法：平带为主 + 边界 72px 柔化 ⇒ 95% 区域色差 0，
 *      边界又不会像硬边那样被看成"横向线"。
 *
 * 抠图为什么分三步（① 泛洪 ② 开运算 ③ 连通块）：主视觉 JPG 里纸底与淡黄圆底都要清掉，
 * 但某处存在一条真实存在的"细桥"把卡车与太阳/小花连成一块，不先用形态学切断就会带出飞点。
 */
/* 生成流程
 *   ① splash-logo.png —— 1200x510 透明锁标：卡车（主视觉抠图）+「动物集市」描边字
 *   ② splash-bg.png   —— 750x1624 竖向渐变底（与游戏内 GameView 四段底色同色系）
 *   ③ silhouette.png  —— 品红底剪影自检（看抠图边缘有没有缺角/毛刺）
 * 设计约束（来自 build/wechatgame/first-screen.js）：
 *   - logo 槽：绘制高度 = 屏高 18.5% x displayRatio，居中 ⇒ 图片宽高比必须 ≤ 屏宽/(0.185x屏高)≈2.5，
 *     否则左右会被裁掉；所以锁标走"横版"：名字在上、卡车在下。
 *   - bg 槽：fitWidth ⇒ 竖向可能溢出/留白，所以底色必须"渐变过场安全"（任意裁切都不穿帮）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const DEPS = loadDeps();   // 依赖隔离在系统临时目录，首次运行自动安装（纯 JS，无原生编译）
const jpeg = DEPS.jpeg;
const PImage = DEPS.pureimage;
const { encodePNG, decodePNG, makeCanvas } = require('./splash-lib.cjs');

const ROOT = path.resolve(__dirname, '..');              // 仓库根（= Cocos 工程根）
const MASTER = ROOT + '/store-assets/logo-master.jpg';
const OUTDIR = ROOT + '/assets/splash';
const GEN = ROOT + '/store-assets/splash-check';        // 自检图（剪影/预览）输出目录
fs.mkdirSync(GEN, { recursive: true });
fs.mkdirSync(OUTDIR, { recursive: true });

const BANDS = [['#97d68d', 0, 0.28], ['#8bcf80', 0.28, 0.55], ['#82ca7b', 0.55, 0.78], ['#6cbf6e', 0.78, 1]];
const CW = 1200, CH = 510;          // 锁标画布（宽高比 2.35，安全上限 2.5）
const NAME = '动物集市';
const TARGET_INK_H = 235;           // 名字墨迹高度（画布单位）⇒ 屏上约 69pt
const TRUCK_H = 225;                // 卡车高度（画布单位）⇒ 屏上约 66pt
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* ---------- 1. 主视觉抠图（三步，为的是"边缘干净"） ----------
 * ① 全局泛洪：纸底 + 淡黄圆底 + 草地 → 透明（草地与本项目底色同绿，留着反像脏块）
 * ② 形态学开运算（先腐蚀后膨胀，r=2）：切断连接卡车与太阳/小花的**细桥**——
 *    实测该细桥真实存在（JPEG 噪声让泛洪在中间断了），不切就会出现飞点。
 * ③ 连通块过滤（丢掉面积过小的碎片）+ 取最大块裁剪
 */
function cutTruck() {
  const img = jpeg.decode(fs.readFileSync(MASTER), { useTArray: true });
  const { width: W, height: H } = img;
  const px = Buffer.from(img.data);
  const isPale = (x, y) => { const o = (y * W + x) * 4; return px[o] >= 238 && px[o + 1] >= 230 && px[o + 2] >= 182; };
  const isGrass = (x, y) => { const o = (y * W + x) * 4; const r = px[o], g = px[o + 1], b = px[o + 2]; return g > 140 && g - r > 25 && g - b > 40; };

  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y);
  let cleared = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!isPale(x, y) && !isGrass(x, y)) continue;
    px[i * 4 + 3] = 0; cleared++;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  console.log('① 泛洪清底 ' + cleared + 'px');

  // ② 开运算：切断细桥（读写分离的 2D 方形窗口，避免原地读写导致"零值级联"把整块吃光）
  const R = 2;
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = px[i * 4 + 3] > 128 ? 1 : 0;
  const morph = (src, isMax) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = isMax ? 0 : 1;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) { if (!isMax) { v = 0; break; } continue; }
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            const s = (xx < 0 || xx >= W) ? 0 : src[yy * W + xx];
            if (isMax) { if (s) { v = 1; break; } } else if (!s) { v = 0; break; }
          }
          if (isMax ? v : !v) break;
        }
        out[y * W + x] = v;
      }
    }
    return out;
  };
  const dil = morph(morph(bin, false), true);
  let removed = 0;
  for (let i = 0; i < W * H; i++) if (bin[i] && !dil[i]) { px[i * 4 + 3] = 0; removed++; }
  console.log('② 开运算切断细桥，去掉 ' + removed + 'px（原 ' + bin.reduce((a, b) => a + b, 0) + 'px）');

  // ③ 连通块：丢掉 < 8000px 的碎片，取最大块
  const lab = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let s = 0; s < W * H; s++) {
    if (lab[s] !== -1 || px[s * 4 + 3] === 0) continue;
    const q = [s]; lab[s] = comps.length;
    let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (q.length) {
      const p = q.pop(), x = p % W, y = (p - x) / W; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (lab[np] !== -1 || px[np * 4 + 3] === 0) continue;
        lab[np] = lab[p]; q.push(np);
      }
    }
    comps.push({ n, x0, y0, x1, y1 });
  }
  const big = comps.filter((c) => c.n >= 8000);
  big.sort((a, b) => b.n - a.n);
  console.log('③ 连通块 ' + comps.length + ' 个，其中 ≥8000px 的 ' + big.length + ' 个：' +
    big.slice(0, 4).map((c) => c.n + '(' + (c.x1 - c.x0 + 1) + 'x' + (c.y1 - c.y0 + 1) + ')').join(', '));
  const best = big[0];
  const keepId = comps.indexOf(best);
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] && lab[i] !== keepId) px[i * 4 + 3] = 0;

  const bw = best.x1 - best.x0 + 1, bh = best.y1 - best.y0 + 1;
  const out = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const s = ((best.y0 + y) * W + (best.x0 + x)) * 4, d = (y * bw + x) * 4;
      out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
    }
  }
  console.log('⇒ 卡车 ' + bw + 'x' + bh + ' 宽高比 ' + (bw / bh).toFixed(3));
  return { w: bw, h: bh, data: out };
}

/* ---------- 2. 中文字形（pureimage 黑字白底 → 覆盖率 = 1 - 亮度） ---------- */
PImage.registerFont('C:/Windows/Fonts/SIMYOU.TTF', 'YouYuan').loadSync();
function glyphMask(pt) {
  const W = Math.ceil(pt * NAME.length * 2 + 200), H = Math.ceil(pt * 2.2);
  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  ctx.font = pt + 'pt "YouYuan"';
  ctx.fillText(NAME, pt * 0.5, pt * 1.5);
  const m = new Float32Array(W * H);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cov = 1 - img.data[(y * W + x) * 4] / 255;
      m[y * W + x] = cov;
      if (cov > 0.35) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return { w: W, h: H, m, bx0: x0, by0: y0, bx1: x1, by1: y1, inkW: x1 - x0 + 1, inkH: y1 - y0 + 1 };
}
/** 迭代逼近目标墨迹高度，避免缩放导致笔画毛边 */
function fitGlyph(targetH) {
  let pt = 260, g = glyphMask(pt);
  for (let i = 0; i < 3 && Math.abs(g.inkH - targetH) > 2; i++) {
    pt = Math.max(80, Math.round(pt * targetH / g.inkH));
    g = glyphMask(pt);
  }
  console.log('字体：' + pt + 'pt ⇒ 墨迹 ' + g.inkW + 'x' + g.inkH + '（目标高 ' + targetH + '）');
  return g;
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

/* ---------- 3. 颜色量化（扁平插画友好：大幅提升 PNG 压缩率，肉眼几乎无差） ---------- */
function quantize(rgba, step = 8) {
  const q = (v) => Math.min(255, Math.round(v / step) * step);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = q(rgba[i]); rgba[i + 1] = q(rgba[i + 1]); rgba[i + 2] = q(rgba[i + 2]);
    rgba[i + 3] = rgba[i + 3] < 8 ? 0 : Math.min(255, Math.round(rgba[i + 3] / 8) * 8);
  }
  return rgba;
}

/* ---------- 4. 锁标合成 ---------- */
function buildLogo() {
  const truck = cutTruck();
  const truckH = TRUCK_H, truckW = Math.round(truckH * truck.w / truck.h);
  const g = fitGlyph(TARGET_INK_H);
  const textLeft = Math.round((CW - g.inkW) / 2);
  const textTop = 24;
  const truckTop = textTop + g.inkH + 14;
  const truckLeft = Math.round((CW - truckW) / 2);
  console.log('排版：字 ' + textLeft + ',' + textTop + '  ' + g.inkW + 'x' + g.inkH +
    '；卡车 ' + truckLeft + ',' + truckTop + '  ' + truckW + 'x' + truckH + '（底边 ' + (truckTop + truckH) + '/' + CH + '）');

  const full = new Float32Array(g.inkW * g.inkH);
  for (let ly = 0; ly < g.inkH; ly++)
    for (let lx = 0; lx < g.inkW; lx++) full[ly * g.inkW + lx] = g.m[(g.by0 + ly) * g.w + (g.bx0 + lx)];
  const bold = dilate(full, g.inkW, g.inkH, 2);      // 伪粗体：笔画加粗 4px
  const edge = dilate(full, g.inkW, g.inkH, 11);     // 描边
  const shad = dilate(full, g.inkW, g.inkH, 14);     // 投影

  const c = makeCanvas(CW, CH, null);
  const INK = [43, 74, 32], CREAM = [255, 253, 240], DARK = [22, 44, 18];
  // 接地阴影：草地被抠掉了，用一层柔和投影把卡车"压"在地上，避免悬空感
  const scx = truckLeft + truckW / 2, scy = truckTop + truckH - 2;
  const srx = truckW * 0.45, sry = 17;
  for (let y = Math.floor(scy - sry); y <= Math.ceil(scy + sry); y++) {
    for (let x = Math.floor(scx - srx); x <= Math.ceil(scx + srx); x++) {
      const dx = (x - scx) / srx, dy = (y - scy) / sry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      c.set(x, y, DARK[0], DARK[1], DARK[2], Math.round(62 * Math.pow(1 - d, 1.6)));
    }
  }
  const blit = (mask, dx, dy, rgb, alpha) => {
    for (let ly = 0; ly < g.inkH; ly++) for (let lx = 0; lx < g.inkW; lx++) {
      const v = mask[ly * g.inkW + lx]; if (v <= 0.02) continue;
      c.set(textLeft + lx + dx, textTop + ly + dy, rgb[0], rgb[1], rgb[2], Math.round(v * alpha));
    }
  };
  blit(shad, 7, 11, DARK, 95);
  blit(edge, 0, 0, INK, 255);
  blit(bold, 0, 0, CREAM, 255);
  c.draw(truck.data, truck.w, truck.h, truckLeft, truckTop, truckW, truckH, 1);

  const file = OUTDIR + '/splash-logo.png';
  fs.writeFileSync(file, encodePNG(CW, CH, quantize(c.data)));
  console.log('写出 ' + file + '  ' + fs.statSync(file).size + 'B  (' + CW + 'x' + CH + ' 宽高比 ' + (CW / CH).toFixed(2) + ')');

  // 剪影自检：品红底看抠图边缘有没有缺角/毛刺
  const sd = Buffer.alloc(CW * CH * 4);
  for (let i = 0; i < CW * CH; i++) {
    const o = i * 4, a = c.data[o + 3] / 255;
    sd[o] = Math.round(c.data[o] * a + 255 * (1 - a));
    sd[o + 1] = Math.round(c.data[o + 1] * a + 0 * (1 - a));
    sd[o + 2] = Math.round(c.data[o + 2] * a + 255 * (1 - a));
    sd[o + 3] = 255;
  }
  fs.writeFileSync(GEN + '/silhouette.png', encodePNG(CW, CH, sd));
  return true;
}

/* ---------- 5. 背景：竖向连续渐变（cover 版，任意屏都不露底） ----------
 * 为什么不用 750x1624：first-screen.js 的 bg 是 fitWidth（按宽铺满、竖向居中）。
 * 屏比 375x812 更"高"时（如 375x900），1624 高的图不够铺满 ⇒ 上下露 22pt 的纯色边（穿帮）。
 * 改成 750x2400（宽高比 0.3125 < 任何手机屏）⇒ 任何比例都是"溢出裁切"，永不露底；
 * 再把四个色档按参考机型 375x812 的可见窗口对齐，过渡与游戏内一致。
 */
function buildBg() {
  const W = 750, H = 2400;
  const REF_ASPECT = 375 / 812;              // 参考机型：可见窗口在图中居中
  const winH = Math.round(W / REF_ASPECT);   // 1624
  const winY0 = Math.round((H - winH) / 2);  // 388
  const edges = BANDS.map(([, t0]) => t0).concat([1]);      // [0, .28, .55, .78, 1]
  const cols = BANDS.map(([h]) => hex2rgb(h));             // 4 段颜色
  const EDGE = 72;                     // 边界柔化带宽(px)：36px 各一侧
  const half = EDGE / 2;
  const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
  const colorAt = (y) => {
    const raw = (y - winY0) / (winH - 1);
    if (raw <= 0) return cols[0];
    if (raw >= 1) return cols[cols.length - 1];
    const t = raw;
    let bi = 0; while (bi < cols.length - 1 && t >= edges[bi + 1]) bi++;
    const base = cols[bi];
    const yUp = edges[bi] * (winH - 1) + winY0, yDn = edges[bi + 1] * (winH - 1) + winY0;
    if (bi > 0 && y - yUp < half) return mix(cols[bi - 1], base, (half - (y - yUp)) / EDGE);
    if (bi < cols.length - 1 && yDn - y < half) return mix(base, cols[bi + 1], (half - (yDn - y)) / EDGE);
    return base;
  };
  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const c = colorAt(y);
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; }
  }
  const file = OUTDIR + '/splash-bg.png';
  fs.writeFileSync(file, encodePNG(W, H, data));
  console.log('写出 ' + file + '  ' + fs.statSync(file).size + 'B  (' + W + 'x' + H +
    '，可见窗口 y[' + winY0 + '..' + (winY0 + winH - 1) + '] 对齐 375x812)');
}

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
if (only !== 'bg') buildLogo();
if (only !== 'logo') buildBg();

/* ---------- 6. 预览：按插屏真实规则叠图（bg 取可见窗口，锁标高 18.5% 屏高居中） ---------- */
if (only !== 'bg') {
  const bg = decodePNG(fs.readFileSync(OUTDIR + '/splash-bg.png'));
  const lg = decodePNG(fs.readFileSync(OUTDIR + '/splash-logo.png'));
  const winH = 1624, winY0 = Math.round((bg.h - winH) / 2);
  for (const [tag, H2] of [['812', winH], ['667', Math.round(750 / (375 / 667))]]) {
    const y0 = Math.round((bg.h - H2) / 2);
    const pc = makeCanvas(750, H2, null);
    for (let y = 0; y < H2; y++) bg.data.copy(pc.data, y * 750 * 4, (y0 + y) * 750 * 4, (y0 + y + 1) * 750 * 4);
    const drawH = Math.round(H2 * 0.185), drawW = Math.round(drawH * lg.w / lg.h);
    pc.draw(lg.data, lg.w, lg.h, Math.round((750 - drawW) / 2), Math.round((H2 - drawH) / 2), drawW, drawH, 1);
    const f = GEN + '/preview-' + tag + '.png';
    fs.writeFileSync(f, encodePNG(750, H2, pc.data));
    console.log('预览 ' + f + '：锁标 ' + (drawH / 2) + 'pt 高 x ' + (drawW / 2) + 'pt 宽（屏宽 375pt）');
  }
}

/* ---------- 7. --verify=<截图>：实测"插屏底色 vs 游戏首帧底色"的色差 ----------
 * 沿屏幕左缘取色（该处必为 GameView 的 bg），按截图实测缩放到设计单位后逐点比对。
 * 注意排除被系统 UI 压住的顶部/底部（刘海、状态栏、Home 条），否则会读出"假差异"。 */
const verifyArg = (process.argv.find((a) => a.startsWith('--verify=')) || '').split('=')[1];
if (verifyArg) {
  const shot = decodePNG(fs.readFileSync(verifyArg));
  const bg = decodePNG(fs.readFileSync(OUTDIR + '/splash-bg.png'));
  const at = (img, x, y) => { const o = (y * img.w + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
  const isGame = (c) => c[1] > c[0] && c[1] > c[2] && c[1] > 100;
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < shot.h; y++) for (let x = 0; x < shot.w; x++) {
    if (isGame(at(shot, x, y))) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const SW = x1 - x0 + 1, SH = y1 - y0 + 1, sc = SW / 375;
  const winH = Math.round(bg.w / (375 / 812)), winY0 = Math.round((bg.h - winH) / 2);
  const myColor = (t) => at(bg, 5, Math.round(winY0 + t * (winH - 1)));
  const edges = BANDS.map(([, t0]) => t0).concat([1]), cols = BANDS.map(([h]) => hex2rgb(h));
  const bandColor = (t) => { let i = 0; while (i < cols.length - 1 && t >= edges[i + 1]) i++; return cols[i]; };
  console.log('\n--verify：截图屏幕框 ' + SW + 'x' + SH + '  s=' + sc.toFixed(4) + '（设计高 ' + (SH / sc).toFixed(1) + '）');
  console.log('  设计t   截图实测       插屏底色       差      游戏平带色     差');
  let maxD = 0;
  for (const t of [0.08, 0.15, 0.22, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]) {
    const s = at(shot, x0 + 3, Math.round(y0 + t * SH));
    const m = myColor(t), b = bandColor(t);
    const d = Math.max(...[0, 1, 2].map((i) => Math.abs(s[i] - m[i])));
    const db = Math.max(...[0, 1, 2].map((i) => Math.abs(s[i] - b[i])));
    if (d > maxD) maxD = d;
    console.log('  ' + t.toFixed(2) + '   ' + s.map((v) => String(v).padStart(3)).join(',') +
      '   ' + m.map((v) => String(v).padStart(3)).join(',') + '   ' + String(d).padStart(3) +
      '   ' + b.map((v) => String(v).padStart(3)).join(',') + '   ' + String(db).padStart(3));
  }
  console.log('⇒ 与截图实测的最大通道差 = ' + maxD + ' 级（±36px 边界柔化带内的差值属设计预期；同屏相邻色差 >3 级才可辨）');
}

/* ---------- 依赖自举：装到系统临时目录，不污染工程、无需原生编译 ---------- */
function loadDeps() {
  const dir = path.join(os.tmpdir(), 'animal-market-splashgen');
  const need = (name) => {
    try { return require(path.join(dir, 'node_modules', name)); } catch (e) { /* 未装 */ }
    try { return require(name); } catch (e) { /* 工程内也没有 */ }
    fs.mkdirSync(dir, { recursive: true });
    const pkg = path.join(dir, 'package.json');
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'animal-market-splashgen', private: true, version: '1.0.0' }));
    console.log('首次运行：安装纯 JS 依赖到 ' + dir + ' …');
    require('child_process').execFileSync('npm', ['i', 'jpeg-js', 'pureimage', '--no-audit', '--no-fund'],
      { cwd: dir, encoding: 'utf8', shell: true, timeout: 600000 });
    return require(path.join(dir, 'node_modules', name));
  };
  return { jpeg: need('jpeg-js'), pureimage: need('pureimage') };
}
