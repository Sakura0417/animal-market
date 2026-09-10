/* UI 基建（VIEW）：CSS 式左上锚点布局 + 按钮工厂 + toast。
 * 布局约定：所有坐标基于 375 宽设计单位（对应原型 phone 375×667）。
 * GameView 根节点按 visibleWidth/375 等比缩放，本层不感知屏幕真实尺寸。
 * 容器纪律：容器节点锚点(0,1)=左上；子节点 place(l,t) → position(l,-t)，
 * Graphics 画底板用 roundRect(0,-h,w,h,r)（左上角为局部原点）。 */
import { EventTouch, Graphics, Node, Tween, tween, UITransform, UIOpacity } from 'cc';
import { col, drawBtn, estTextW, makeLabel, newG, RADIUS, wrapTextByWidth } from './Draw2D';

export interface Pt { x: number; y: number; }

/* ============================================================
 * 交互状态 token（2026-09-10）—— 全工程唯一的按下/禁用比例出处
 * 状态模型（Cocos 触屏：无指针，故**不存在 hover 态**）：
 *   default  常态
 *   pressed  TOUCH_START 缩放 PRESS_SCALE、TOUCH_END/CANCEL 回 1
 *   disabled 不挂 TOUCH_END + 整体 UIOpacity = DISABLED_OPACITY（尺寸不变，只降不透明）
 * ⚠️ 任何新增可点元素都必须走这两个常量，否则会出现"有的按 0.94 有的按 0.9"的比例不一致。
 * ============================================================ */
export const PRESS_SCALE = 0.94;
export const DISABLED_OPACITY = 115;   // ≈45%
/* 圆角 token 定义在 Draw2D（更底层，避免 Ui↔Draw2D 循环依赖），本文件转出便于调用点就近取用 */
export { RADIUS } from './Draw2D';

/**
 * 广告角标贴角定位（2026-09-10 修越界）：
 * 角标是**中心锚点圆**，此前各调用点写死 (W-6, -6) / (sw-7, -7)——角标半宽 10.5px，
 * 结果右/上各溢出容器 1.5~2.5px（截图可见红点戳出紫按钮与虚线框外）。
 * 改为按角标自身半径反推：圆心 = (W - rb - INSET, -(rb + INSET))，保证角标完整落在容器内。
 * @param badge      角标节点（中心锚点）
 * @param W          容器宽（本地坐标 0..W）
 * @param badgePx    角标显示尺寸
 * @param inset      角标边缘与容器边的留白
 */
export function placeCornerBadge(badge: Node, W: number, badgePx: number, inset = 2): void {
  const rb = badgePx / 2;
  badge.setPosition(W - rb - inset, -(rb + inset), 0);
}

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
  node.on(Node.EventType.TOUCH_START, () => { node.setScale(PRESS_SCALE, PRESS_SCALE, 1); });
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

/** 底部 toast：深棕圆角条 + 文案，2.2s 自动消退（原型 .toast，不吞触摸）
 *
 * 2026-09-10 重写（用户反馈"碰撞提示只显示了一半"）：
 * ① **x 定位修正（本次主因）**：parent 是**中心锚点**的 `design`（x ∈ [-w/2, +w/2]），
 *    旧代码却用左上容器的坐标 `placeC(node, w/2, …)` ⇒ 提示中心被放到**屏幕右缘**，
 *    实际只露出左半（截图正好切在"被"字）。改为 `x = 0` 才是真居中。
 * ② **自适应宽高 + 手动断行**：旧版背景固定 34 高、宽度 `min(W-30, len*13+36)`，
 *    而 Label 是 Overflow.NONE（**忽略 contentSize 按原文宽度渲染**）⇒ 文案一旦比背景宽
 *    就直接溢出、比一行高就纵向溢出。现改为 `wrapTextByWidth` 先断行，再按实际行数
 *    算背景高、按最长行算背景宽，并关掉引擎折行保证两者一致。
 * ③ **底边锚定**：锚点改 (0.5, 0)，底边固定在屏幕底部上方 BOTTOM 处、只向上生长
 *    ⇒ 多行提示不会向下压到底部道具栏。
 * ④ **屏幕安全边距**：背景宽上限 = W - 2×MARGIN，窄屏也不会贴边/出屏。 */
export class Toast {
  readonly node: Node;
  private W: number;
  private static readonly FS = 13;        // 字号
  private static readonly LH = 18;        // 行高
  private static readonly PADX = 18;      // 左右内边距
  private static readonly PADY = 8;       // 上下内边距
  private static readonly MARGIN = 14;    // 距屏幕左右边缘的安全留白
  private static readonly BOTTOM = 86;    // 底边距屏幕底部（恒高于底部道具栏 66）

  constructor(parent: Node, w: number, screenH: number) {
    this.W = w;
    const { node } = newG('toast', 10, 34);
    this.node = node;
    opacityOf(node).opacity = 0;
    const ut = node.getComponent(UITransform)!;
    ut.setAnchorPoint(0.5, 0);                                 // 底边固定，向上生长
    node.setPosition(0, -screenH / 2 + Toast.BOTTOM, 0);       // x=0：design 空间水平居中
    parent.addChild(node);
  }

  show(msg: string): void {
    wipeChildren(this.node);
    const maxTextW = this.W - Toast.MARGIN * 2 - Toast.PADX * 2;
    const lines = wrapTextByWidth(msg, maxTextW, Toast.FS);
    const textW = lines.reduce((m, l) => Math.max(m, estTextW(l, Toast.FS)), 0);
    const bgW = Math.min(this.W - Toast.MARGIN * 2, textW + Toast.PADX * 2);
    const bgH = lines.length * Toast.LH + Toast.PADY * 2;

    // 背景：以节点原点（底边中点）为基准向上画
    const { g } = newG('toastbg', bgW, bgH);
    g.roundRect(-bgW / 2, 0, bgW, bgH, RADIUS.chip);
    g.fillColor = col('#4a3c2b');
    g.fill();
    this.node.addChild(g.node);

    const t = makeLabel(lines.join('\n'), Toast.FS, '#ffffff', false);
    t.label.lineHeight = Toast.LH;
    t.label.enableWrapText = false;         // 已手动断行 → 禁止引擎再折，行数/背景高必然一致
    placeC(t.node, 0, bgH / 2, bgW, bgH);
    this.node.addChild(t.node);

    this.node.getComponent(UITransform)!.setContentSize(bgW, bgH);

    const op = opacityOf(this.node);
    Tween.stopAllByTarget(op);
    tween(op).set({ opacity: 0 }).to(0.25, { opacity: 255 }).delay(2.2).to(0.25, { opacity: 0 }).start();
  }
}
