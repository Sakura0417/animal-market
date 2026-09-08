// 离线验证 dashedRoundRect（重写版几何断言）
const fs = require('fs');
function makeG() {
  return { segs: [], cur: null,
    moveTo(x, y) { this.cur = [x, y]; },
    lineTo(x, y) { if (this.cur) this.segs.push([this.cur, [x, y]]); this.cur = [x, y]; },
    stroke() { this.cur = null; }, strokeColor: null, lineWidth: null };
}
const src = fs.readFileSync('assets/scripts/view/Draw2D.ts', 'utf8');
const m = src.match(/export function dashedRoundRect[\s\S]*?\n\}/);
let fn = m[0]
  .replace('export function dashedRoundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number, hex: string, sw: number, dash = 6, gap = 5): void',
           'function dashedRoundRect(g, x, y, w, h, r, hex, sw, dash = 6, gap = 5)')
  .replace('const pts: number[][] = [];', 'const pts = [];')
  .replace('const line = (x0: number, y0: number, x1: number, y1: number) =>', 'const line = (x0, y0, x1, y1) =>')
  .replace('const arc = (cx: number, cy: number, a0: number, a1: number) =>', 'const arc = (cx, cy, a0, a1) =>')
  .replace(/col\(hex\)/g, 'hex');
eval(fn);
const g = makeG();
dashedRoundRect(g, 0, -478, 286, 478, 18, '#ffffff', 2.5, 8, 7);
const W = 286, H = 478, r = 18;
const onPerimeter = (x, y) => {
  let dMin = Infinity, where = 'corner?';
  const segDist = (px, py, x0, y0, x1, y1, tag) => {
    const vx = x1 - x0, vy = y1 - y0, wx = px - x0, wy = py - y0;
    const t = Math.max(0, Math.min(1, (vx * wx + vy * wy) / (vx * vx + vy * vy)));
    const d = Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
    if (d < dMin) { dMin = d; where = tag; }
  };
  segDist(x, y, r, 0, W - r, 0, 'top');
  segDist(x, y, W, -(H - r), W, -r, 'right');
  segDist(x, y, W - r, -H, r, -H, 'bottom');
  segDist(x, y, 0, -r, 0, -(H - r), 'left');
  const corners = [
    ['ne', W - r, -r, 0, Math.PI / 2],
    ['se', W - r, -(H - r), -Math.PI / 2, 0],
    ['sw', r, -(H - r), -Math.PI, -Math.PI / 2],
    ['nw', r, -r, Math.PI / 2, Math.PI]];
  for (const [tag, cx, cy, a0, a1] of corners) {
    const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy);
    if (dd < 0.001) continue;
    const a = Math.atan2(dy, dx);
    if (a >= a0 - 1e-9 && a <= a1 + 1e-9) { const d = Math.abs(dd - r); if (d < dMin) { dMin = d; where = tag; } }
  }
  return { dMin, where };
};
let worst = null;
for (const [a, b] of g.segs) for (const p of [a, b]) {
  const r2 = onPerimeter(p[0], p[1]);
  if (!worst || r2.dMin > worst.d) worst = { d: +r2.dMin.toFixed(2), where: r2.where, x: +p[0].toFixed(1), y: +p[1].toFixed(1) };
}
let maxLen = 0, chord = 0;
const q = [0, 0, 0, 0];
for (const [a, b] of g.segs) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  maxLen = Math.max(maxLen, L);
  if (L > 8 + 0.5) chord++;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  q[(mx < W / 2 ? 0 : 1) + (my > -H / 2 ? 0 : 2)]++;
}
console.log('最差偏差点:', worst, '（< 1 即全部落在圆角周长上）');
console.log('最长实线段:', maxLen.toFixed(2), '（dash=8；超长弦线:', chord, '条）');
console.log('四象限线段数 [左上,右上,左下,右下]:', q.join(','));
