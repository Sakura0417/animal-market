/* 自定义微信小游戏启动页（first-screen.js）——《动物集市》
 * 修改时间：2026-09-22 10:02（v5＝回退 v3 成品态，用户指令"取消渐入 + 切换为 V3 版本"）：
 *   ① 移除 v4 的 u_Alpha 全局渐入（用户反馈"会在半透明状态下直接进入游戏"）；
 *   ② 移除 v4 的跑道橄榄边框/浅绿底/暖黄填充三层 + 流动光效，改回 v3 单层半透明白跑道
 *      （stadium，46% 屏宽、16px 厚、α0.38）；
 *   ③ 移除 v4 的进度文字 progress-text.png 绘制；
 *   ④ 小鸡 48 逻辑px、卡车 60 逻辑px + v3 配色（黄 #f5b800 / 红 #e53a3a）。
 * v4（10:05）：u_Alpha 渐入 + 三层跑道 + 流动光效 + 进度文字（本次已回退）。
 * v3（09:25）：黑底根因（PImage.make 初始 alpha=255）→ 小鸡改静态资源字节拷贝；stadium 圆角跑道。
 * v2（08:59）：修整页倒置（quadTex 顶边 v=0）；图标尺寸量纲重排。
 * v1（00:04）：接管引擎默认启动页，API 同引擎（start/setProgress/end），game.ejs 无需改动。
 * 依赖资源（同目录，随构建复制进包根）：splash-bg.png / progress-animal.png。
 */

/* ---------- 着色器 ---------- */
const VS_TEX = `
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() { gl_Position = a_Position; v_TexCoord = a_TexCoord; }`;

const FS_TEX = `
precision mediump float;
uniform sampler2D u_Sampler;
varying vec2 v_TexCoord;
void main() { gl_FragColor = texture2D(u_Sampler, v_TexCoord); }`;

const VS_SOLID = `
attribute vec4 a_Position;
void main() { gl_Position = a_Position; }`;

const FS_SOLID = `
precision mediump float;
uniform vec4 u_Color;
void main() { gl_FragColor = u_Color; }`;

const options = {
  alpha: false, antialias: true, depth: true, stencil: true,
  premultipliedAlpha: false, preserveDrawingBuffer: false,
  powerPreference: 'default', failIfMajorPerformanceCaveat: false,
};

let gl = null;
let rafHandle = null;
let afterTick = null;
let progress = 0.0;                 // 目标进度（0~1），setProgress 写入
let display = 0.0;                  // 实际显示进度（每帧向目标缓动）

/* 逻辑屏尺寸（图标按逻辑像素定尺寸；取不到时兜底 375x667） */
let SW = 375, SH = 667;
try {
  const si = (typeof wx !== 'undefined') && wx.getSystemInfoSync();
  if (si && si.screenWidth) { SW = si.screenWidth; SH = si.screenHeight; }
} catch (e) { /* 兜底默认值 */ }

/** 逻辑宽 px → NDC 宽（NDC x 全程 2.0 = 逻辑屏宽 SW） */
const pxX = (px) => (px * 2) / SW;
/** 逻辑高 px → NDC 高（NDC y 全程 2.0 = 逻辑屏高 SH） */
const pxY = (px) => (px * 2) / SH;

const BG_NAME = 'splash-bg.png';
const ANIMAL_NAME = 'progress-animal.png';

let bgImg = null, animalImg = null;
let programTex = null, programSolid = null;
let bgTex = null, animalTex = null;
let bgBuf = null, animalBuf = null, solidBuf = null;

/* ---------- GL 基建 ---------- */
function createProgram(vs, fs) {
  const _vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(_vs, vs); gl.compileShader(_vs);
  const _fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(_fs, fs); gl.compileShader(_fs);
  const p = gl.createProgram(); gl.attachShader(p, _vs); gl.attachShader(p, _fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.log('splash link err: ' + gl.getProgramInfoLog(p)); }
  gl.deleteShader(_vs); gl.deleteShader(_fs);
  return p;
}
function makeTex() {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function upload(img, tex) {
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
}
function makeBuf(vertices) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  return b;
}
function updateBuf(b, vertices) {
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
}

/** 纹理四边形（NDC 两条对边 + uv 全图）。
 *  ⚠️ v 坐标按「屏幕上方 = 图片顶部」映射（v2 修倒置）：texImage2D 把图片首行
 *  （顶部）放在 v=0，而 NDC y=+1 是屏幕上方 ⇒ 顶边取 v=0、底边取 v=1。 */
function quadTex(x0, y0, x1, y1) {
  return new Float32Array([
    x1, y1, 1, 0,  x1, y0, 1, 1,  x0, y1, 0, 0,  x0, y0, 0, 1,
  ]);
}

/** 旋转 90° 顺时针的纹理四边形（小鸡精灵基准朝上 ⇒ 显示为头朝右）。
 *  映射：图顶行（v=0）沿屏幕右缘、图左列（u=0）沿屏幕顶缘。 */
function quadTexRotCW(x0, y0, x1, y1) {
  return new Float32Array([
    x1, y1, 0, 0,  x1, y0, 1, 0,  x0, y1, 0, 1,  x0, y0, 1, 1,
  ]);
}

/** 实心矩形（TRIANGLE_STRIP 4 顶点） */
function quadSolid(x0, y0, x1, y1) {
  return new Float32Array([x1, y1, x1, y0, x0, y1, x0, y0]);
}

/** 体育场形（圆角长条）三角形列表：左半圆 + 中段矩形 + 右半圆。
 *  x0/x1 为两端半圆圆心的 NDC x；rpx 为圆角半径（逻辑 px，横竖分别换算保持正圆）。
 *  两心重合（x0==x1）时退化为正圆 —— 车轮复用此函数。 */
function stadium(x0, x1, yc, rpx, segs) {
  const n = segs || 14;
  const rx = pxX(rpx), ry = pxY(rpx);
  const v = [];
  const cap = (cx, a0, a1) => {
    for (let i = 0; i < n; i++) {
      const b0 = a0 + (a1 - a0) * (i / n);
      const b1 = a0 + (a1 - a0) * ((i + 1) / n);
      v.push(cx, yc, cx + Math.cos(b0) * rx, yc + Math.sin(b0) * ry, cx + Math.cos(b1) * rx, yc + Math.sin(b1) * ry);
    }
  };
  cap(x0, Math.PI / 2, Math.PI * 1.5);     // 左帽（上→左→下）
  cap(x1, -Math.PI / 2, Math.PI / 2);      // 右帽（下→右→上）
  v.push(x0, yc - ry, x1, yc - ry, x1, yc + ry,   x0, yc - ry, x1, yc + ry, x0, yc + ry);  // 中段两三角形
  return new Float32Array(v);
}

function loadImg(name) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.premultiplyAlpha = false;
    im.onload = () => resolve(im);
    im.onerror = (e) => reject(e);
    im.src = name;
  });
}

function drawTex(program, tex, buf) {
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(program, 'u_Sampler'), 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const aPos = gl.getAttribLocation(program, 'a_Position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  const aTc = gl.getAttribLocation(program, 'a_TexCoord');
  gl.enableVertexAttribArray(aTc);
  gl.vertexAttribPointer(aTc, 2, gl.FLOAT, false, 16, 8);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function drawSolid(buf, color, mode, count) {
  gl.useProgram(programSolid);
  gl.uniform4fv(gl.getUniformLocation(programSolid, 'u_Color'), color);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const aPos = gl.getAttribLocation(programSolid, 'a_Position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(mode, 0, count);
}
/** 实心矩形（中心 + 宽高，宽高为 NDC 尺寸） */
function drawRect(cx, cy, w, h, color) {
  updateBuf(solidBuf, quadSolid(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2));
  drawSolid(solidBuf, color, gl.TRIANGLE_STRIP, 4);
}
/** 实心三角列表（stadium / 圆） */
function drawShape(verts, color) {
  updateBuf(solidBuf, verts);
  drawSolid(solidBuf, color, gl.TRIANGLES, verts.length / 2);
}

/* ---------- 终点小卡车（GL 矢量拼装，v3 配色；无贴图 ⇒ 无透明问题） ---------- */
function drawTruck(cx, cy) {
  const X = (dx) => cx + pxX(dx);           // 卡车局部逻辑 px → NDC（相对车体中心）
  const Y = (dy) => cy + pxY(dy);
  // 遮阳棚：白底 + 3 道红条纹（盖车箱顶，车头朝右 ⇒ 车箱在左、装货口朝左迎向小鸡）
  drawRect(X(-4), Y(13), pxX(50), pxY(9), [1, 1, 1, 1]);
  for (const sx of [-24, -11, 2]) drawRect(X(-4 + sx + 3.5), Y(13), pxX(7), pxY(9), [0.90, 0.28, 0.30, 1]);
  // 车箱（黄）
  drawRect(X(-10), Y(-1), pxX(40), pxY(26), [0.96, 0.72, 0, 1]);
  // 车头（黄）+ 车窗（浅蓝）
  drawRect(X(22), Y(-4), pxX(16), pxY(20), [0.96, 0.72, 0, 1]);
  drawRect(X(23), Y(1), pxX(9), pxY(8), [0.75, 0.91, 0.96, 1]);
  // 车轮（深色 + 浅色轮毂；两心重合的 stadium = 正圆）
  for (const wx of [-20, 20]) {
    drawShape(stadium(X(wx), X(wx), Y(-15), 6, 12), [0.15, 0.20, 0.16, 1]);
    drawShape(stadium(X(wx), X(wx), Y(-15), 2.5, 10), [0.91, 0.94, 0.91, 1]);
  }
}

/* ---------- 绘制 ---------- */
function draw() {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.59, 0.79, 0.53, 1);                     // 兜底绿（bg 缺失时也不黑屏）
  gl.clear(gl.COLOR_BUFFER_BIT);

  // 1) 整页图（cover：fitWidth 竖向居中裁切；图 960x2400 比任何屏瘦长 ⇒ 永不露边）
  if (bgImg) {
    const bgNdcH = ((canvas.width / bgImg.width) * bgImg.height) / canvas.height * 2;
    updateBuf(bgBuf, quadTex(-1, -bgNdcH / 2, 1, bgNdcH / 2));
    drawTex(programTex, bgTex, bgBuf);
  }

  // 2) 圆角跑道几何（v3：46% 屏宽、16px 厚、半透明白）
  const capL = -0.46, capR = 0.46;                        // 两端半圆圆心（NDC x）
  const laneYC = -0.78;                                   // 跑道中心（约屏底 11% 上方，落在草地）
  const laneR = 8;                                        // 圆角半径/半厚（逻辑 px ⇒ 全厚 16px）
  const e = Math.max(0, Math.min(1, display));

  // 3) 小鸡几何：48 逻辑px，沿跑道中心线而行（头朝右）
  const aniPx = 48;
  const aniW = pxX(aniPx), aniH = pxY(aniPx);
  const trkW = pxX(60);                                   // 卡车总宽（逻辑 60px）
  const trkCx = capR - trkW * 0.28;                       // 卡车压跑道右端
  const aniStart = capL + aniW * 0.55;
  const aniEnd = trkCx - trkW * 0.18;                     // 终点＝车厢内（卡车后画盖住）
  const aniCx = aniStart + (aniEnd - aniStart) * e;
  const bob = Math.sin(Date.now() / 150) * pxY(1.2);      // 走路轻微起伏

  // 4) 跑道底 + 黄色填充（填充长到小鸡脚下，随进度生长；e=0 时退化为起点圆点）
  drawShape(stadium(capL, capR, laneYC, laneR), [1, 1, 1, 0.38]);
  drawShape(stadium(capL, aniCx - aniW * 0.12, laneYC, laneR), [0.96, 0.72, 0, 0.95]);

  // 5) 小鸡（素材缺失时跳过；e≥0.985 隐藏＝已"进车"）
  if (animalImg && e < 0.985) {
    updateBuf(animalBuf, quadTexRotCW(aniCx - aniW / 2, laneYC + bob - aniH / 2, aniCx + aniW / 2, laneYC + bob + aniH / 2));
    drawTex(programTex, animalTex, animalBuf);
  }

  // 6) 终点小卡车（最后画 ⇒ 小鸡走到车身后被盖住）
  drawTruck(trkCx, laneYC);
}

function tick() {
  rafHandle = requestAnimationFrame(() => {
    display += (progress - display) * 0.25;                 // 向目标缓动（跳变平滑化）
    if (Math.abs(progress - display) < 0.004) display = progress;
    draw();
    tick();
    if (afterTick) { afterTick(); afterTick = null; }
  });
}

function start(alpha, antialias, useWebgl2) {
  options.alpha = alpha === 'true' ? true : false;
  options.antialias = antialias === 'false' ? false : true;
  gl = window.canvas.getContext(useWebgl2 === 'true' ? 'webgl2' : 'webgl', options) ||
       window.canvas.getContext('webgl', options);

  programTex = createProgram(VS_TEX, FS_TEX);
  programSolid = createProgram(VS_SOLID, FS_SOLID);
  bgTex = makeTex(); animalTex = makeTex();
  bgBuf = makeBuf(quadTex(-1, -1, 1, 1));
  animalBuf = makeBuf(quadTex(0, 0, 0, 0));
  solidBuf = makeBuf(quadSolid(0, 0, 0, 0));
  tick();

  // 资源容错：bg/小鸡任一失败降级续跑，不 reject ⇒ 不阻断 game.ejs 启动链
  return Promise.all([
    loadImg(BG_NAME).catch(() => null),
    loadImg(ANIMAL_NAME).catch(() => null),
  ]).then(([b, a]) => {
    bgImg = b; animalImg = a;
    if (b) upload(b, bgTex);
    if (a) upload(a, animalTex);
    return setProgress(0);
  });
}

function setProgress(val) {
  progress = val;
  return new Promise((resolve) => { afterTick = () => resolve(); });
}

function end() {
  return setProgress(1).then(() => {
    cancelAnimationFrame(rafHandle);
    gl.useProgram(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  });
}

module.exports = { start, end, setProgress };