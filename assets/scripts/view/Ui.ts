/* UI 基建（VIEW）：CSS 式左上锚点布局 + 按钮工厂 + toast。
 * 布局约定：所有坐标基于 375 宽设计单位（对应原型 phone 375×667）。
 * GameView 根节点按 visibleWidth/375 等比缩放，本层不感知屏幕真实尺寸。
 * 容器纪律：容器节点锚点(0,1)=左上；子节点 place(l,t) → position(l,-t)，
 * Graphics 画底板用 roundRect(0,-h,w,h,r)（左上角为局部原点）。 */
import { EventTouch, Graphics, Node, Tween, tween, UITransform, UIOpacity } from 'cc';
import { col, drawBtn, makeLabel, newG } from './Draw2D';

export interface Pt { x: number; y: number; }

/** 锚点(0,1)左上布局：left/top 为距父左上的 CSS 像素距离 */
export function place(node: Node, left: number, top: number, w: number, h: number): Node {
  const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  ut.setAnchorPoint(0, 1);
  ut.setContentSize(w, h);
  node.setPosition(left, -top, 0);
  return node;
}

/** 锚点(0.5,0.5)居中布局：cx/cy 为中心点（父坐标系） */
export function placeC(node: Node, cx: number, cy: number, w: number, h: number): Node {
  const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  ut.setAnchorPoint(0.5, 0.5);
  ut.setContentSize(w, h);
  node.setPosition(cx, cy, 0);
  return node;
}

export function opacityOf(node: Node): UIOpacity {
  return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}

/** 64 空间矢量图形节点：Draw2D 按 64×64 viewBox 绘制，这里按显示像素缩放。
 * span = 图形在 64 空间中的跨度；cx/cy = 图形包围盒中心（SVG 坐标），
 * 用于把不居中的小图标（锁/心/爪）对齐到节点原点。 */
export function icon64(name: string, px: number, draw: (g: Graphics) => void, span = 64, cx = 32, cy = 32): Node {
  const root = new Node(name);
  const ut = root.addComponent(UITransform);
  ut.setContentSize(px, px);
  const { node, g } = newG(name + 'g', span, span);
  draw(g);
  const s = px / span;
  node.setScale(s, s, 1);
  node.setPosition((32 - cx) * s, (cy - 32) * s, 0);
  root.addChild(node);
  return root;
}

/** 全屏吞触摸（模态遮罩必须调，否则下层仍会收到事件） */
export function swallow(node: Node): void {
  node.on(Node.EventType.TOUCH_START, (e: EventTouch) => { e.propagationStopped = true; });
}

/** 清屏式重建：停掉节点上的 tween 再销毁全部子节点 */
export function wipeChildren(node: Node): void {
  node.children.slice().forEach(c => {
    Tween.stopAllByTarget(c);
    const op = c.getComponent(UIOpacity);
    if (op) Tween.stopAllByTarget(op);
    c.destroy();
  });
}

export interface BtnOpts {
  w: number;
  h?: number;
  kind: 'primary' | 'blue' | 'green' | 'ghost';
  title: string;
  note?: string;
  titleSize?: number;
  onTap: () => void;
}

/** d-btn 按钮工厂：渐变底板 + 主文案 + 可选广告副文案（sky 色小字）
 * 修复（2026-09-06 01:22:00）：标题/副文案此前 placeC 在 (o.w/2, …)——按钮节点是
 *   中心锚点，(w/2,0) 是右缘，文案整体右偏出按钮；居中应写 (0, …)。 */
export function mkBtn(o: BtnOpts): Node {
  const h = o.h ?? (o.note ? 52 : 44);
  const { node, g } = newG('btn', o.w, h);
  drawBtn(g, o.w, h, o.kind);
  const titleColor = o.kind === 'ghost' ? '#e07f10' : '#ffffff';
  const t = makeLabel(o.title, o.titleSize ?? 15, titleColor);
  placeC(t.node, 0, o.note ? 8 : 0, o.w - 14, 20);
  node.addChild(t.node);
  if (o.note) {
    const n = makeLabel(o.note, 10.5, '#3d9ee0', false);
    placeC(n.node, 0, -13, o.w - 14, 14);
    node.addChild(n.node);
  }
  node.on(Node.EventType.TOUCH_START, () => { node.setScale(0.95, 0.95, 1); });
  node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); o.onTap(); });
  node.on(Node.EventType.TOUCH_CANCEL, () => { node.setScale(1, 1, 1); });
  return node;
}

/** 白色圆角胶囊底（HUD 徽章用） */
export function whitePill(w: number, h: number, r = h / 2): { node: Node; g: Graphics } {
  const { node, g } = newG('pill', w, h);
  g.roundRect(-w / 2, -h / 2, w, h, r);
  g.fillColor = col('#ffffff');
  g.fill();
  return { node, g };
}

/** 底部 toast：深棕圆角条 + 单行文案，2.2s 自动消退（原型 .toast，不吞触摸） */
export class Toast {
  readonly node: Node;
  private W: number;

  constructor(parent: Node, w: number, screenH: number) {
    this.W = w;
    const { node } = newG('toast', 10, 34);
    this.node = node;
    opacityOf(node).opacity = 0;
    placeC(node, w / 2, -screenH / 2 + 86, 10, 34);
    parent.addChild(node);
  }

  show(msg: string): void {
    wipeChildren(this.node);
    const fs = 13;
    const w = Math.min(this.W - 30, msg.length * fs + 36);
    const { g } = newG('toastbg', w, 34);
    g.roundRect(-w / 2, -17, w, 34, 10);
    g.fillColor = col('#4a3c2b');
    g.fill();
    const bg = g.node;
    this.node.addChild(bg);
    const t = makeLabel(msg, fs, '#ffffff', false);
    placeC(t.node, 0, 0, w, 18);
    this.node.addChild(t.node);
    this.node.getComponent(UITransform)!.setContentSize(w, 34);
    const op = opacityOf(this.node);
    Tween.stopAllByTarget(op);
    tween(op).set({ opacity: 0 }).to(0.25, { opacity: 255 }).delay(2.2).to(0.25, { opacity: 0 }).start();
  }
}
