/* Draw2D：矢量美术库 —— 原型 animals.js 的 SVG（viewBox 0 0 64 64）逐形移植为 Cocos Graphics。
 * 风格公式（与原型一致）：胶囊身体 + 物种符号 + 点状眼 + 深棕硬描边 + 粉彩糖果色。
 * 坐标转换：SVG(左上原点 y 向下) → Cocos(中心原点 y 向上)：X = sx-32, Y = 32-sy。
 * 绘制纪律：每个形状建完路径立即 fill()/stroke()，不跨形状累积路径。 */
import { Color, Graphics, Label, Node, UITransform } from 'cc';
import type { Dir } from '../core/Types';

export const OUT = '#5f4a3a';
export const EYE = '#3d2f23';

/**
 * 矩形圆角 token（设计单位，2026-09-10 统一）——全工程唯一的圆角出处。
 * 此前散落 5/10/11/12/14/18 六种裸数字，无从横向比较；按元素体量归四档。
 * 胶囊（关卡木牌 / HUD 币价胶囊 / 按钮 note 行）不在此表：圆角恒为 h/2，写 h/2 即自解释。
 * Ui.ts 转出本表（定义放这里是为了避免 Ui↔Draw2D 循环依赖）。
 */
export const RADIUS = {
  panel: 16,   // 大面板 / 停车带 / 牧场围栏（边长 ≥80）
  card: 12,    // 卡片 / 面板主按钮 / 道具按钮
  chip: 10,    // 停车位槽 / toast / 小徽章
  micro: 6,    // 微型容器（≤20 边长的内嵌小盒）
} as const;

const cache: Record<string, Color> = {};
export function col(hex: string): Color {
  let c = cache[hex];
  if (!c) { c = new Color(); Color.fromHEX(c, hex); cache[hex] = c; }
  return c;
}
export function colA(hex: string, a: number): Color {
  const base = col(hex);
  return new Color(base.r, base.g, base.b, a);
}

const X = (sx: number) => sx - 32;
const Y = (sy: number) => 32 - sy;

/** 建带 UITransform + Graphics 的节点（锚点居中） */
export function newG(name: string, w: number, h = w): { node: Node; g: Graphics } {
  const node = new Node(name);
  node.addComponent(UITransform).setContentSize(w, h);
  const g = node.addComponent(Graphics);
  g.lineJoin = Graphics.LineJoin.ROUND;
  g.lineCap = Graphics.LineCap.ROUND;
  return { node, g };
}

export function makeLabel(text: string, fontSize: number, hex: string, bold = true): { node: Node; label: Label } {
  const node = new Node('label');
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.35);
  label.isBold = bold;
  label.color = col(hex);
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  return { node, label };
}

/** 文案宽度粗估（CJK 按 1em、其余按 0.58em）——与 Toast.show 的估算口径一致。
 *  用途：把多个 Label 居中拼成一行时算整行宽度。
 *  为什么不实测：Label 的 UITransform 要等**渲染帧**才按内容更新，构建期读到的是 0
 *  （Overflow.NONE + enableWrapText=false 亦是如此），所以构建期只能用估算。
 *  口径依据：系统字体下 CJK 字形的 advance 恰为 1em；ASCII 取 0.58em 的常用均值。 */
export function estTextW(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? fontSize : fontSize * 0.58;
  return w;
}

const isCJK = (ch: string): boolean => ch.charCodeAt(0) > 0x2e80;
/** 行首禁则：这些收尾标点不得单独出现在行首（跟随上一行，宁可轻微超宽） */
const NO_LINE_START = '！？。，、；：）】》」』…·%,.;:)]}';

/**
 * 按估算宽度把文案断成多行（2026-09-10）。
 * 为什么需要：Cocos Label 默认 Overflow.NONE 会**忽略 contentSize 按原文宽度渲染**——
 * 既不会帮你换行，也不会裁剪，超宽文案会直接冲出容器（Toast / 面板副文案都踩过）。
 * 取「构建期手动断行 + enableWrapText=false」：行数由我们掌控，背景尺寸与文案必然一致。
 * 断行规则：CJK 逐字断；非 CJK 优先在最近的空格断；行首禁则字符不另起行。
 */
export function wrapTextByWidth(text: string, maxW: number, fontSize: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (cur !== '' && estTextW(cur + ch, fontSize) > maxW && !NO_LINE_START.includes(ch)) {
        if (!isCJK(ch)) {
          const k = cur.lastIndexOf(' ');
          if (k > 0) { out.push(cur.slice(0, k)); cur = cur.slice(k + 1); }
          else { out.push(cur); cur = ''; }
        } else { out.push(cur); cur = ''; }
      }
      cur += ch;
    }
    out.push(cur);
  }
  return out.length ? out : [''];
}

/* ---------- 基础形状 ---------- */

function fillStroke(g: Graphics, fillHex: string | null, strokeHex: string | null, sw: number) {
  if (fillHex !== null) { g.fillColor = col(fillHex); g.fill(); }
  if (strokeHex !== null && sw > 0) { g.strokeColor = col(strokeHex); g.lineWidth = sw; g.stroke(); }
}

function ellipseAt(g: Graphics, sx: number, sy: number, rx: number, ry: number, fillHex: string | null, strokeHex: string | null = OUT, sw = 0) {
  g.ellipse(X(sx), Y(sy), rx, ry);
  fillStroke(g, fillHex, strokeHex, sw);
}

/** 旋转椭圆（SVG rotate(deg) 顺时针 → cocos 逆时针为正，取 -deg） */
function rotEllipseAt(g: Graphics, sx: number, sy: number, rx: number, ry: number, svgDeg: number, fillHex: string | null, strokeHex: string | null = OUT, sw = 0) {
  const deg = -svgDeg;
  const rad = deg * Math.PI / 180;
  const cx = X(sx), cy = Y(sy);
  const ux = Math.cos(rad) * rx, uy = Math.sin(rad) * rx;
  const vx = -Math.sin(rad) * ry, vy = Math.cos(rad) * ry;
  const K = 0.5522847498307936;
  const x0 = cx + ux, y0 = cy + uy;
  const x1 = cx + vx, y1 = cy + vy;
  const x2 = cx - ux, y2 = cy - uy;
  const x3 = cx - vx, y3 = cy - vy;
  g.moveTo(x0, y0);
  g.bezierCurveTo(x0 + K * vx, y0 + K * vy, x1 + K * ux, y1 + K * uy, x1, y1);
  g.bezierCurveTo(x1 - K * ux, y1 - K * uy, x2 + K * vx, y2 + K * vy, x2, y2);
  g.bezierCurveTo(x2 - K * vx, y2 - K * vy, x3 - K * ux, y3 - K * uy, x3, y3);
  g.bezierCurveTo(x3 + K * ux, y3 + K * uy, x0 - K * vx, y0 - K * vy, x0, y0);
  g.close();
  fillStroke(g, fillHex, strokeHex, sw);
}

function circleAt(g: Graphics, sx: number, sy: number, r: number, fillHex: string | null, strokeHex: string | null = null, sw = 0) {
  g.circle(X(sx), Y(sy), r);
  fillStroke(g, fillHex, strokeHex, sw);
}

/** 圆角矩形（SVG 坐标：左上角 + 宽高） */
function rrAt(g: Graphics, sx: number, sy: number, w: number, h: number, r: number, fillHex: string | null, strokeHex: string | null = null, sw = 0) {
  g.roundRect(X(sx), Y(sy) - h, w, h, r);
  fillStroke(g, fillHex, strokeHex, sw);
}

function line(g: Graphics, x1: number, y1: number, x2: number, y2: number, hex: string, sw: number) {
  g.moveTo(X(x1), Y(y1));
  g.lineTo(X(x2), Y(y2));
  g.strokeColor = col(hex);
  g.lineWidth = sw;
  g.stroke();
}

function quad(g: Graphics, pts: number[][], fillHex: string | null, strokeHex: string | null = null, sw = 0) {
  g.moveTo(X(pts[0][0]), Y(pts[0][1]));
  for (let k = 1; k < pts.length; k++) g.lineTo(X(pts[k][0]), Y(pts[k][1]));
  g.close();
  fillStroke(g, fillHex, strokeHex, sw);
}

function qCurve(g: Graphics, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, hex: string, sw: number) {
  g.moveTo(X(x0), Y(y0));
  g.quadraticCurveTo(X(cx), Y(cy), X(x1), Y(y1));
  g.strokeColor = col(hex);
  g.lineWidth = sw;
  g.stroke();
}

/** 四角星（rare 装饰） */
function star4(g: Graphics, sx: number, sy: number, r: number, fillHex: string, strokeHex: string, sw: number) {
  const ir = r * 0.38;
  const pts: number[][] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 2 * (k / 2);
    const rr = k % 2 === 0 ? r : ir;
    pts.push([sx + Math.cos(a) * rr, sy - Math.sin(a) * rr]);
  }
  quad(g, pts, fillHex, strokeHex, sw);
}

/* ---------- 动物（与 animals.js BODIES 逐形对应，绘制顺序 = SVG 层序） ---------- */

export function drawAnimal(g: Graphics, typeId: string, rare: boolean): void {
  switch (typeId) {
    case 'chicken': {
      line(g, 26, 51, 26, 57, '#e8912d', 3.4);
      line(g, 38, 51, 38, 57, '#e8912d', 3.4);
      g.moveTo(X(26.5), Y(22));
      g.quadraticCurveTo(X(32), Y(7), X(37.5), Y(22));
      g.close();
      fillStroke(g, '#ff6157', OUT, 2.6);
      ellipseAt(g, 13.5, 40, 4.6, 7.6, '#f4ead2', OUT, 2.4);
      ellipseAt(g, 50.5, 40, 4.6, 7.6, '#f4ead2', OUT, 2.4);
      ellipseAt(g, 32, 38.5, 19, 16, '#fffdf3', OUT, 2.8);
      circleAt(g, 26, 31.5, 2.8, EYE);
      circleAt(g, 38, 31.5, 2.8, EYE);
      quad(g, [[28, 36.5], [36, 36.5], [32, 41.5]], '#ffb13d', OUT, 2.2);
      qCurve(g, 29.5, 43, 32, 47, 34.5, 43, OUT, 2);
      break;
    }
    case 'duck': {
      line(g, 26, 53, 26, 58, '#e8912d', 3.4);
      line(g, 38, 53, 38, 58, '#e8912d', 3.4);
      g.moveTo(X(47), Y(28));
      g.quadraticCurveTo(X(54), Y(26), X(55), Y(32));
      g.quadraticCurveTo(X(51), Y(36), X(46), Y(33));
      g.close();
      fillStroke(g, '#ffd23e', OUT, 2.6);
      ellipseAt(g, 32, 39, 19, 16, '#ffd23e', OUT, 2.8);
      qCurve(g, 29, 23, 32, 18, 35, 22, OUT, 2.2);
      circleAt(g, 26, 32.5, 2.8, EYE);
      circleAt(g, 38, 32.5, 2.8, EYE);
      g.moveTo(X(25.5), Y(38));
      g.quadraticCurveTo(X(32), Y(34), X(38.5), Y(38));
      g.quadraticCurveTo(X(37), Y(43), X(32), Y(43));
      g.quadraticCurveTo(X(27), Y(43), X(25.5), Y(38));
      g.close();
      fillStroke(g, '#ff9430', OUT, 2.4);
      ellipseAt(g, 19.5, 39.5, 3, 2, '#ffb3a0');
      ellipseAt(g, 44.5, 39.5, 3, 2, '#ffb3a0');
      break;
    }
    case 'rabbit': {
      rotEllipseAt(g, 24, 15, 4.6, 11.5, -14, '#fffdf3', OUT, 2.6);
      rotEllipseAt(g, 24, 16.5, 2, 7, -14, '#ffb3c0');
      rotEllipseAt(g, 40, 15, 4.6, 11.5, 14, '#fffdf3', OUT, 2.6);
      rotEllipseAt(g, 40, 16.5, 2, 7, 14, '#ffb3c0');
      ellipseAt(g, 32, 41, 17.5, 15, '#fffdf3', OUT, 2.8);
      circleAt(g, 26, 38, 2.8, EYE);
      circleAt(g, 38, 38, 2.8, EYE);
      g.moveTo(X(30.3), Y(43.2));
      g.quadraticCurveTo(X(32), Y(41.6), X(33.7), Y(43.2));
      g.quadraticCurveTo(X(32), Y(44.8), X(32), Y(45.2));
      g.close();
      fillStroke(g, '#ff8fa3', OUT, 1.8);
      qCurve(g, 29.5, 46.5, 32, 49, 34.5, 46.5, OUT, 2);
      ellipseAt(g, 20, 44.5, 3, 2, '#ffb3c0');
      ellipseAt(g, 44, 44.5, 3, 2, '#ffb3c0');
      break;
    }
    case 'sheep': {
      rotEllipseAt(g, 12.5, 35, 5.4, 3.4, -16, '#e5cfa5', OUT, 2.4);
      rotEllipseAt(g, 51.5, 35, 5.4, 3.4, 16, '#e5cfa5', OUT, 2.4);
      const WOOL = [[32, 21.5, 9], [17.5, 29, 10], [46.5, 29, 10], [15, 41.5, 9.5], [49, 41.5, 9.5], [32, 45.5, 11]];
      for (const c of WOOL) circleAt(g, c[0], c[1], c[2], '#fffaf0', OUT, 2.8);
      for (const c of WOOL) circleAt(g, c[0], c[1], c[2], '#fffaf0');
      ellipseAt(g, 32, 35, 10.5, 9, '#e5cfa5', OUT, 2.6);
      circleAt(g, 26, 33.5, 2.6, EYE);
      circleAt(g, 38, 33.5, 2.6, EYE);
      qCurve(g, 29.5, 40, 32, 42.5, 34.5, 40, OUT, 2);
      break;
    }
    case 'pig': {
      g.moveTo(X(14.5), Y(29));
      g.quadraticCurveTo(X(12), Y(17.5), X(21.5), Y(19.5));
      g.lineTo(X(26), Y(26));
      g.close();
      fillStroke(g, '#ffb3c8', OUT, 2.4);
      g.moveTo(X(49.5), Y(29));
      g.quadraticCurveTo(X(52), Y(17.5), X(42.5), Y(19.5));
      g.lineTo(X(38), Y(26));
      g.close();
      fillStroke(g, '#ffb3c8', OUT, 2.4);
      ellipseAt(g, 32, 39, 19.5, 16.5, '#ffa8bf', OUT, 2.8);
      circleAt(g, 26, 33, 2.8, EYE);
      circleAt(g, 38, 33, 2.8, EYE);
      ellipseAt(g, 32, 41, 8, 6, '#ff8fae', OUT, 2.4);
      circleAt(g, 29.2, 41, 1.5, '#c25d7e');
      circleAt(g, 34.8, 41, 1.5, '#c25d7e');
      ellipseAt(g, 18.5, 38.5, 2.6, 1.8, '#ff7d9e');
      ellipseAt(g, 45.5, 38.5, 2.6, 1.8, '#ff7d9e');
      break;
    }
    case 'cow': {
      g.moveTo(X(17), Y(22));
      g.quadraticCurveTo(X(11), Y(19.5), X(11.5), Y(13.5));
      g.quadraticCurveTo(X(18), Y(14.5), X(20), Y(20));
      g.close();
      fillStroke(g, '#ffd9a0', OUT, 2.2);
      g.moveTo(X(47), Y(22));
      g.quadraticCurveTo(X(53), Y(19.5), X(52.5), Y(13.5));
      g.quadraticCurveTo(X(46), Y(14.5), X(44), Y(20));
      g.close();
      fillStroke(g, '#ffd9a0', OUT, 2.2);
      rotEllipseAt(g, 12.5, 27.5, 5.5, 3.4, -18, '#f7f1e8', OUT, 2.4);
      rotEllipseAt(g, 51.5, 27.5, 5.5, 3.4, 18, '#f7f1e8', OUT, 2.4);
      ellipseAt(g, 32, 39.5, 19.5, 16.5, '#fdfcf7', OUT, 2.8);
      g.moveTo(X(19.5), Y(31));
      g.quadraticCurveTo(X(26.5), Y(25.5), X(30), Y(32.5));
      g.quadraticCurveTo(X(27.5), Y(38.5), X(21.5), Y(36));
      g.quadraticCurveTo(X(17), Y(34.5), X(19.5), Y(31));
      g.close();
      fillStroke(g, '#5a4a3f', null, 0);
      g.moveTo(X(44.5), Y(44));
      g.quadraticCurveTo(X(51), Y(43), X(50), Y(49));
      g.quadraticCurveTo(X(46.5), Y(52.5), X(42), Y(48.5));
      g.close();
      fillStroke(g, '#5a4a3f', null, 0);
      circleAt(g, 26, 33.5, 2.8, EYE);
      circleAt(g, 38, 33.5, 2.8, EYE);
      ellipseAt(g, 32, 43, 8.8, 6.4, '#ffc9d2', OUT, 2.4);
      circleAt(g, 28.8, 43, 1.6, '#b36e7c');
      circleAt(g, 35.2, 43, 1.6, '#b36e7c');
      break;
    }
    default:
      ellipseAt(g, 32, 38.5, 19, 16, '#fffdf3', OUT, 2.8);
      circleAt(g, 26, 31.5, 2.8, EYE);
      circleAt(g, 38, 31.5, 2.8, EYE);
      break;
  }
  // rare 四角星装饰已移除（2026-09-08 用户要求去掉稀有金环类视觉）；
  // rare 参数保留作签名兼容（售价 ×3 与结算「闪」文字仍由 core 层 rare 数据驱动）
  void rare;
}

/* ---------- 场景物件 ---------- */

export function drawRock(g: Graphics): void {
  g.moveTo(X(13), Y(47));
  g.quadraticCurveTo(X(8), Y(34), X(18), Y(25));
  g.quadraticCurveTo(X(26), Y(18), X(35), Y(22));
  g.quadraticCurveTo(X(47), Y(27), X(47), Y(39));
  g.quadraticCurveTo(X(47), Y(50), X(37), Y(52));
  g.quadraticCurveTo(X(28), Y(54), X(21), Y(52));
  g.quadraticCurveTo(X(12), Y(50), X(13), Y(47));
  g.close();
  fillStroke(g, '#cbc4ba', OUT, 2.8);
  g.moveTo(X(23), Y(25));
  g.lineTo(X(30), Y(33));
  g.lineTo(X(20), Y(39));
  g.strokeColor = col('#a8a094');
  g.lineWidth = 2.2;
  g.stroke();
  g.moveTo(X(39), Y(23));
  g.lineTo(X(30), Y(33));
  g.lineTo(X(43), Y(40));
  g.strokeColor = col('#a8a094');
  g.lineWidth = 2.2;
  g.stroke();
  qCurve(g, 12, 49, 14, 44, 16, 49, '#58c06c', 2.2);
  qCurve(g, 45, 47, 47, 42, 49, 47, '#58c06c', 2.2);
}

export function drawTruck(g: Graphics, bodyHex: string, stripeHex: string): void {
  rrAt(g, 7, 13, 50, 36, 10, bodyHex, OUT, 2.8);
  rrAt(g, 13, 20, 38, 13, 6, '#c3e8f7', OUT, 2.4);
  line(g, 13, 38, 51, 38, stripeHex, 4);
  circleAt(g, 18, 49, 7, '#5a4a3f', OUT, 2.6);
  circleAt(g, 46, 49, 7, '#5a4a3f', OUT, 2.6);
  circleAt(g, 18, 49, 2.6, '#c9c2b8');
  circleAt(g, 46, 49, 2.6, '#c9c2b8');
  circleAt(g, 13, 44, 2.6, '#fff3dd', OUT, 1.8);
  circleAt(g, 51, 44, 2.6, '#fff3dd', OUT, 1.8);
}

export function drawCoin(g: Graphics): void {
  circleAt(g, 32, 32, 26, '#ffc93c', '#d9990a', 3);
  g.circle(X(32), Y(32), 19);
  g.strokeColor = col('#d9990a');
  g.lineWidth = 2.4;
  g.stroke();
  quad(g, [
    [32, 22], [34.5, 28.6], [41.5, 28.9], [36.2, 33.4], [37.8, 40.3],
    [32, 36.9], [26.2, 40.3], [27.8, 33.4], [22.5, 28.9], [29.5, 28.6]
  ], '#ffe9a8', '#d9990a', 1.4);
  qCurve(g, 21, 17, 16, 21, 15.5, 27, '#ffe9a8', 4);
}

export function drawArrowIcon(g: Graphics): void {
  quad(g, [[32, 12], [50, 34], [39, 34], [39, 52], [25, 52], [25, 34], [14, 34]], '#ffffff', OUT, 3);
}

export function drawClaw(g: Graphics): void {
  line(g, 32, 4, 32, 16, '#7d8894', 4.5);
  rrAt(g, 21, 16, 22, 11, 4.5, '#9d7df5', OUT, 2.6);
  g.moveTo(X(25), Y(27));
  g.quadraticCurveTo(X(18), Y(42), X(29), Y(47));
  g.strokeColor = col('#9d7df5');
  g.lineWidth = 5.5;
  g.stroke();
  g.moveTo(X(39), Y(27));
  g.quadraticCurveTo(X(46), Y(42), X(35), Y(47));
  g.strokeColor = col('#9d7df5');
  g.lineWidth = 5.5;
  g.stroke();
}

export function drawLock(g: Graphics, hex = '#ffffff'): void {
  rrAt(g, 5, 10, 14, 10, 2.5, hex);
  g.moveTo(X(8), Y(10));
  g.lineTo(X(8), Y(7));
  g.arc(X(12), Y(7), 4, Math.PI, 0, true);
  g.lineTo(X(16), Y(10));
  g.strokeColor = col(hex);
  g.lineWidth = 3;
  g.stroke();
}

export function drawVideoBadge(g: Graphics): void {
  rrAt(g, 6, 14, 38, 36, 9, '#ff5b5b', OUT, 2.8);
  quad(g, [[26, 24], [40, 32], [26, 40]], '#ffffff', OUT, 2);
}

export function drawHeart(g: Graphics, lost: boolean): void {
  const fillHex = lost ? '#e3e9ef' : '#ff6f61';
  const strokeHex = lost ? '#8b95a3' : '#d64541';
  circleAt(g, 8.9, 11, 4.4, fillHex, strokeHex, 1.4);
  circleAt(g, 15.1, 11, 4.4, fillHex, strokeHex, 1.4);
  quad(g, [[4.5, 12.5], [19.5, 12.5], [12, 21]], fillHex, strokeHex, 1.4);
}

export function drawShuffleIcon(g: Graphics): void {
  const S = 64 / 24;
  const px = (v: number) => X(v * S);
  const py = (v: number) => Y(v * S);
  const seg = (pts: number[][]) => {
    g.moveTo(px(pts[0][0]), py(pts[0][1]));
    for (let k = 1; k < pts.length; k++) g.lineTo(px(pts[k][0]), py(pts[k][1]));
  };
  const head = (hx: number, hy: number) => {
    g.moveTo(px(hx), py(hy));
    g.lineTo(px(hx + 4), py(hy + 4));
    g.lineTo(px(hx), py(hy + 8));
    g.close();
    g.fillColor = col('#ffffff');
    g.fill();
  };
  g.strokeColor = col('#ffffff');
  g.lineWidth = 2.4;
  seg([[2, 18], [3.4, 18], [4.7, 18], [5.9, 17.4], [6.7, 16.3], [13.3, 7.7], [14.1, 6.6], [15.3, 6], [16.6, 6], [22, 6]]);
  g.stroke();
  seg([[2, 6], [3.9, 6], [5.4, 6], [6.8, 6.9], [7.5, 8.2]]);
  g.stroke();
  seg([[22, 18], [16.1, 18], [14.8, 18], [13.5, 17.3], [12.8, 16.2], [12.3, 15.4]]);
  g.stroke();
  head(18, 2);
  head(18, 14);
}

export function drawRestartIcon(g: Graphics): void {
  const S = 64 / 24;
  const r = 9 * S;
  g.strokeColor = col('#5a6a78');
  g.lineWidth = 2.4;
  g.arc(0, 0, r, Math.PI * 0.6, Math.PI * 1.95, false);
  g.stroke();
  const a = Math.PI * 0.6;
  const ax = Math.cos(a) * r, ay = Math.sin(a) * r;
  g.moveTo(ax - 5, ay - 2);
  g.lineTo(ax + 6, ay + 2);
  g.lineTo(ax - 1, ay + 8);
  g.close();
  g.fillColor = col('#5a6a78');
  g.fill();
}

/* ---------- 通用 UI 元素 ---------- */

/** 虚线圆角矩形描边（棋盘视觉语言核心）
 * 2026-09-06 10:55 重写：旧实现只走四条直边（圆角弧缺失 → 四角无虚线），且把各边
 * 首尾点当连续折线画虚线（角部出现弦线斜线），dash/gap 参数也被忽略。
 * 现按周长整环采样（四条直边 + 四段 90° 圆角弧，闭环），再按弧长以 dash/gap
 * 交替落笔/抬笔，四角虚线与直边样式一致。坐标：调用方传矩形底边 y（y 向上）。 */
export function dashedRoundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number, hex: string, sw: number, dash = 6, gap = 5): void {
  const r2 = Math.min(r, w / 2, h / 2);
  const pts: number[][] = [];
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
    for (let k = 1; k <= n; k++) pts.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  };
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) * r2 / 3));
    for (let k = 1; k <= n; k++) {
      const a = a0 + (a1 - a0) * k / n;
      pts.push([cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]);
    }
  };
  const D = Math.PI / 180;
  pts.push([x + r2, y + h]);                                   // 顶边左端
  line(x + r2, y + h, x + w - r2, y + h);                      // 顶边 →
  arc(x + w - r2, y + h - r2, 90 * D, 0);                      // 右上角弧
  line(x + w, y + h - r2, x + w, y + r2);                      // 右边 ↓
  arc(x + w - r2, y + r2, 0, -90 * D);                         // 右下角弧
  line(x + w - r2, y, x + r2, y);                              // 底边 ←（2026-09-06 10:55 修正：原误写成右下角的弦）
  arc(x + r2, y + r2, -90 * D, -180 * D);                      // 左下角弧
  line(x, y + r2, x, y + h - r2);                              // 左边 ↑（贴 x，起点=左下弧终点）
  arc(x + r2, y + h - r2, -180 * D, -270 * D);                 // 左上角弧（闭环）
  // 按弧长交替落笔/抬笔
  g.strokeColor = col(hex);
  g.lineWidth = sw;
  let d = true;        // true = 落笔画线
  let run = 0;         // 当前状态已走长度
  for (let k = 1; k < pts.length; k++) {
    const ax = pts[k - 1][0], ay = pts[k - 1][1];
    const dx = pts[k][0] - ax, dy = pts[k][1] - ay;
    const len = Math.hypot(dx, dy);
    let consumed = 0;
    while (consumed < len - 1e-6) {
      const remain = (d ? dash : gap) - run;
      const step = Math.min(remain, len - consumed);
      if (d) {
        g.moveTo(ax + dx * (consumed / len), ay + dy * (consumed / len));
        g.lineTo(ax + dx * ((consumed + step) / len), ay + dy * ((consumed + step) / len));
        g.stroke();
      }
      consumed += step;
      run += step;
      if (run >= (d ? dash : gap) - 1e-6) { d = !d; run = 0; }
    }
  }
}

/** 方向箭头朝向表：CSS rotate 顺时针为正；cocos node.angle 逆时针为正 → 使用时取 -DEG */
export const DIR_DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

export const SLOT_COLORS: [string, string][] = [
  ['#ffcf3e', '#ff9d2b'], ['#8ad94f', '#58b52e'], ['#5cb2ea', '#2c7fb8'],
  ['#ff9ec7', '#e06a9d'], ['#b9a0fb', '#7c5cc4']
];

/** 按钮底板（d-btn：渐变近似为双色上浅下深两段） */
export function drawBtn(g: Graphics, w: number, h: number, kind: 'primary' | 'blue' | 'green' | 'ghost'): void {
  const rr = RADIUS.card;
  if (kind === 'ghost') {
    g.roundRect(-w / 2, -h / 2, w, h, rr);
    g.fillColor = colA('#ffffff', 235);
    g.fill();
    g.strokeColor = colA('#ff9d2b', 140);
    g.lineWidth = 3;
    g.stroke();
    return;
  }
  const top = kind === 'blue' ? '#5cb2ea' : kind === 'green' ? '#6fd07f' : '#ffb14e';
  const bottom = kind === 'blue' ? '#3d9ee0' : kind === 'green' ? '#58c06c' : '#ff9d2b';
  const edge = kind === 'blue' ? '#2c7fb8' : kind === 'green' ? '#3ea552' : '#e07f10';
  g.roundRect(-w / 2, -h / 2, w, h - 3, rr);
  g.fillColor = col(bottom);
  g.fill();
  g.roundRect(-w / 2, -h / 2 + 2.5, w, h - 3, rr);
  g.fillColor = col(top);
  g.fill();
  g.roundRect(-w / 2, -h / 2, w, h - 3, rr);
  g.strokeColor = col(edge);
  g.lineWidth = 2;
  g.stroke();
}

/** 紫色道具按钮底板（d-tool） */
export function drawToolBtn(g: Graphics, w: number, h: number): void {
  g.roundRect(-w / 2, -h / 2, w, h - 3, RADIUS.card);
  g.fillColor = col('#9d7df5');
  g.fill();
  g.roundRect(-w / 2, -h / 2 + 2.5, w, h - 3, RADIUS.card);
  g.fillColor = col('#b9a0fb');
  g.fill();
  g.roundRect(-w / 2, -h / 2, w, h - 3, RADIUS.card);
  g.strokeColor = col('#7c5cc4');
  g.lineWidth = 2;
  g.stroke();
}

/** HUD 木质关卡牌（d-lv） */
export function drawLevelPill(g: Graphics, w: number, h: number): void {
  g.roundRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillColor = col('#c2823f');
  g.fill();
  g.roundRect(-w / 2, -h / 2 + 2.5, w, h - 3, (h - 3) / 2);
  g.fillColor = col('#cf9250');
  g.fill();
  g.roundRect(-w / 2, -h / 2, w, h, h / 2);
  g.strokeColor = col('#8f5a2b');
  g.lineWidth = 2;
  g.stroke();
}
