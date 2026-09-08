/* ParkView（VIEW）：停车位公路带 —— 5 车位（3 开 + 2 广告解锁）。
 * 卡车即订单：需求行 have/need + cargo 载货可视化 + 入场/驶离/落货动画。
 * 槽位结构（锚点(0,1)，62.6×68）：
 *   bgG（每次重绘的底板）· decor（锁位文案等重建层，可点解锁）·
 *   truckWrap（持久：truckG + cargo 池 + needs 行）。
 * 修改时间：2026-09-08 —— 需求行/载货动物图标改统一 animalIcon（矢量占位+sprite 切换）；
 *   2026-09-06 00:12:00 修复 SLOT_COLORS 误从 core/Constants 导入（构建期
 * rollup MISSING_EXPORT，SLOT_COLORS 实际定义于 Draw2D.ts；交接文档 R1 预言的 view 层问题之一）。 */
import { Graphics, Node, Tween, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import { SLOT_TOTAL } from '../core/Constants';
import type { Animal, Slot } from '../core/Types';
import { col, colA, dashedRoundRect, drawLock, drawTruck, drawVideoBadge, makeLabel, newG, SLOT_COLORS } from './Draw2D';
import { animalIcon } from './AnimalArt';
import { place, placeC, wipeChildren, icon64 } from './Ui';

export class ParkView {
  readonly node: Node;
  private slots: Node[] = [];
  private bgG: Graphics[] = [];
  private decor: Node[] = [];
  private truckWrap: Node[] = [];
  private cargo: Node[] = [];
  private needsHost: Node[] = [];
  private prevStates: string[] = [];
  private sw = 62.6;
  private sh = 68;
  private baseX: number[] = [];

  constructor(parent: Node, left: number, top: number, w: number, private onUnlock: (i: number) => void) {
    const { node, g } = newG('park', w, 84);
    this.node = node;
    // 公路带底色：上浅下深两段 + 顶部内高光
    g.roundRect(0, -84, w, 84, 14);
    g.fillColor = col('#93a0b0');
    g.fill();
    g.roundRect(0, -84, w, 42, 14);
    g.fillColor = col('#7c8999');
    g.fill();
    g.roundRect(0, -2.5, w, 2.5, 0);
    g.fillColor = colA('#ffffff', 56);
    g.fill();
    const padX = 7, gap = 6;
    const sw = (w - padX * 2 - gap * 4) / 5;
    this.sw = sw;
    this.sh = sw / 0.92;
    for (let i = 0; i < SLOT_TOTAL; i++) {
      const { node: sn, g: sg } = newG('slot' + i, sw, this.sh);
      this.baseX.push(padX + i * (sw + gap));
      place(sn, this.baseX[i], 8, sw, this.sh);
      node.addChild(sn);
      this.slots.push(sn);
      this.bgG.push(sg);
      this.prevStates.push('');
      const dc = new Node('decor');
      place(dc, 0, 0, sw, this.sh);
      sn.addChild(dc);
      this.decor.push(dc);
      const tw = new Node('truckWrap');
      // 修复（2026-09-06 02:10:00）：placeC(tw,0,0) 把中心锚点定位到了槽位左上角
      //   （sn 原点），卡车/载货/需求行整组左上偏移 (sw/2,sh/2)；bump() 的回弹终点
      //   (sw/2,-sh/2) 证明本意是槽位中心。现按中心定位修正。
      placeC(tw, this.sw / 2, -this.sh / 2, sw, this.sh); // 以槽位中心为原点
      sn.addChild(tw);
      this.truckWrap.push(tw);
      const { node: tn, g: tg } = newG('truck', 64, 64);
      drawTruck(tg, SLOT_COLORS[i % SLOT_COLORS.length][0], SLOT_COLORS[i % SLOT_COLORS.length][1]);
      tn.setScale(40 / 64, 40 / 64, 1);
      tn.setPosition(0, 12, 0); // 卡车居上半区
      tw.addChild(tn);
      const cg = new Node('cargo');
      placeC(cg, 0, -12, sw - 10, 30); // 叠在卡车上半部
      tw.addChild(cg);
      this.cargo.push(cg);
      const nd = new Node('needs');
      // 修复（2026-09-06 02:10:00）：随 truckWrap 改为中心原点，需求行定位到槽位底部；
      // 2026-09-06 09:30:00：容器加高到 24 并上移 3px，容纳两行居中的需求组。
      placeC(nd, 0, -(this.sh / 2) + 16, sw - 4, 24); // 卡车下方需求行
      tw.addChild(nd);
      this.needsHost.push(nd);
    }
    place(node, left, top, w, 84);
    parent.addChild(node);
  }

  /** 全量渲染（loading 态 = 装车中绿框；fenceCnt 供 have/need 统计） */
  render(slots: Slot[], fenceCnt: Record<string, number>): void {
    for (let i = 0; i < SLOT_TOTAL; i++) {
      const s = slots[i];
      const sn = this.slots[i];
      const g = this.bgG[i];
      // 修复（2026-09-06 13:32:00 车位/车辆消失 bug）：发车后 0.38s 立即补单时，
      //   状态从 leaving 直接变 truck，旧逻辑 fresh 把 prev==='leaving' 排除在
      //   "新到车"之外——playLeave 的淡出/左移永不被复位，补来的新车整个隐形
      //   （用户截图中的"空车位消失"即此）。现 prev==='leaving' 也按新到车处理。
      const prev = this.prevStates[i];
      const fresh = (s.state === 'truck' || s.state === 'loading') &&
        prev !== 'truck' && prev !== 'loading' && prev !== 'leaving';
      this.prevStates[i] = s.state;
      g.clear();
      wipeChildren(this.decor[i]);
      this.truckWrap[i].active = s.state === 'truck' || s.state === 'loading' || s.state === 'leaving';
      if (s.state === 'locked') {
        this.resetSlot(i);
        g.roundRect(0, -this.sh, this.sw, this.sh, 10);
        g.fillColor = colA('#3a4452', 105);
        g.fill();
        dashedRoundRect(g, 0, -this.sh, this.sw, this.sh, 10, '#ffffff', 2, 6, 5);
        const box = newG('lockbox', 18, 18);
        box.g.roundRect(-9, -9, 18, 18, 5);
        box.g.fillColor = col('#e8eef4');
        box.g.fill();
        box.node.setPosition(this.sw / 2, -20, 0);
        this.decor[i].addChild(box.node);
        const lock = icon64('lock', 12, gg => drawLock(gg, '#5a6a78'), 17, 12, 11.5);
        box.node.addChild(lock);
        const t = makeLabel('看广告\n解锁车位', 9, '#ffffff', false);
        t.lineHeight = 11.5;
        placeC(t.node, this.sw / 2, -this.sh / 2 - 4, this.sw - 4, 24);
        this.decor[i].addChild(t.node);
        const badge = icon64('adbadge', 17, gg => drawVideoBadge(gg), 38, 25, 32);
        badge.setPosition(this.sw - 7, -7, 0);
        this.decor[i].addChild(badge);
        this.decor[i].off(Node.EventType.TOUCH_END);
        this.decor[i].once(Node.EventType.TOUCH_END, () => this.onUnlock(i));
        this.syncCargo(i, []);
        this.syncNeeds(i, null, fenceCnt, false);
        continue;
      }
      if (s.state === 'empty') {
        this.resetSlot(i);
        g.roundRect(0, -this.sh, this.sw, this.sh, 10);
        g.fillColor = colA('#ffffff', 36);
        g.fill();
        dashedRoundRect(g, 0, -this.sh, this.sw, this.sh, 10, '#ffffff', 2, 6, 5);
        const t = makeLabel('空车位', 10, '#dfe6ec', false);
        placeC(t.node, this.sw / 2, -this.sh / 2, this.sw - 4, 14);
        this.decor[i].addChild(t.node);
        this.syncCargo(i, []);
        this.syncNeeds(i, null, fenceCnt, false);
        continue;
      }
      // truck / loading / leaving
      g.roundRect(0, -this.sh, this.sw, this.sh, 10);
      g.fillColor = colA('#ffffff', 240);
      g.fill();
      if (s.state === 'loading') {
        g.roundRect(-1.5, -this.sh - 1.5, this.sw + 3, this.sh + 3, 11);
        g.strokeColor = colA('#58c06c', 120);
        g.lineWidth = 3;
        g.stroke();
      }
      g.roundRect(0, -this.sh, this.sw, this.sh, 10);
      g.strokeColor = col('#ffffff');
      g.lineWidth = 2;
      g.stroke();
      this.syncCargo(i, s.loaded ?? []);
      this.syncNeeds(i, s.order, fenceCnt, s.state === 'loading');
      if (s.state === 'leaving') this.playLeave(i);
      else if (fresh || prev === 'leaving') this.playArrive(i); // 发车补单：复位透明度/位置再入场
    }
  }

  private resetSlot(i: number): void {
    const sn = this.slots[i];
    Tween.stopAllByTarget(sn);
    sn.setPosition(this.baseX[i], -8, 0);
    sn.setScale(1, 1, 1);
    const op = sn.getComponent(UIOpacity) ?? sn.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
  }

  /** 需求行：图标 + have/need（每行最多 2 组，整行按实际组数居中；loading 视为已满足）。
   * 2026-09-06 09:30:00 重排：原实现按固定左起点排布——单组时挤在左侧、列距 30 小于
   * 组宽（图标+文字 ≈33）导致相邻列重叠。现按每行组数水平居中、多行时垂直也居中。
   *
   * 2026-09-08 17:55 防御层：core 层 makeOrder 偶数化已修 items value ≥ 1，
   *   但本函数对 items 仍兜底过滤 need<=0 的项（@image#1 截图曾现 0/0），
   *   避免渲染无意义计数；过滤后若 items 为空则不留占位。 */
  private syncNeeds(i: number, order: Slot['order'], fenceCnt: Record<string, number>, loading: boolean): void {
    const host = this.needsHost[i];
    wipeChildren(host);
    if (!order) return;
    const items: { id: string; have: number; need: number }[] = [];
    for (const id in order.items) {
      const need = order.items[id];
      if (!need || need < 1) continue;
      items.push({ id, have: loading ? need : Math.min(fenceCnt[id] ?? 0, need), need });
    }
    if (items.length === 0) return;
    const perRow = 2, colW = 28, rowH = 11;
    const rows = Math.ceil(items.length / perRow);
    items.forEach((it, k) => {
      const row = Math.floor(k / perRow);
      const inRow = Math.min(perRow, items.length - row * perRow);
      const x = -(inRow * colW) / 2 + (k % perRow) * colW + colW / 2; // 该组中心（整行居中）
      const y = (rows - 1) * rowH / 2 - row * rowH;                   // 多行时垂直居中
      const icon = animalIcon('need', 12, it.id);
      icon.setPosition(x - 7.5, y, 0);
      host.addChild(icon);
      const t = makeLabel(it.have + '/' + it.need, 8.5, it.have >= it.need ? '#2f9e4f' : '#5a6a78');
      t.lineHeight = 9.5;
      placeC(t.node, x + 6.5, y, 22, 10);
      host.addChild(t.node);
    });
  }

  /** cargo 载货池：按 uid diff，新增弹跳（cargoPop） */
  private syncCargo(i: number, loaded: Animal[]): void {
    const host = this.cargo[i];
    const seen = new Set<number>();
    loaded.forEach((a, k) => {
      seen.add(a.uid);
      let child: Node | null = null;
      for (const c of host.children) if (c.name === 'c' + a.uid) { child = c; break; }
      if (!child) {
        child = animalIcon('c' + a.uid, 14, a.type.id, a.rare);
        child.setPosition(-19 + (k % 3) * 15, 6 - Math.floor(k / 3) * 15, 0);
        const final = 14 / 64;
        child.setScale(final * 0.25, final * 0.25, 1);
        tween(child).to(0.3, { scale: new Vec3(final, final, 1) }, { easing: 'back-out' }).start();
        host.addChild(child);
      }
    });
    host.children.slice().forEach(c => {
      const n = parseInt(c.name.slice(1), 10);
      if (isNaN(n) || !seen.has(n)) c.destroy();
    });
  }

  /** 入场：从右侧 +150% 滑入（truckIn 过冲回弹） */
  playArrive(i: number): void {
    const sn = this.slots[i];
    Tween.stopAllByTarget(sn);
    const op = sn.getComponent(UIOpacity) ?? sn.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
    sn.setPosition(this.baseX[i] + this.sw * 1.5, -8, 0);
    tween(sn).to(0.38, { position: new Vec3(this.baseX[i], -8, 0) }, { easing: 'back-out' }).start();
  }

  /** 驶离：向左 -170% 冲出 + 淡出（truckOut） */
  playLeave(i: number): void {
    const sn = this.slots[i];
    Tween.stopAllByTarget(sn);
    const op = sn.getComponent(UIOpacity) ?? sn.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
    tween(sn)
      .to(0.34, { position: new Vec3(this.baseX[i] - this.sw * 1.7, -8, 0) }, { easing: 'quad-in' })
      .start();
    tween(op).to(0.34, { opacity: 0 }).start();
  }

  /** 落货回弹（cargoBump：下沉 → 回弹） */
  bump(i: number): void {
    const tw = this.truckWrap[i];
    Tween.stopAllByTarget(tw);
    const bx = this.sw / 2, by = -this.sh / 2;
    tween(tw)
      .to(0.11, { scale: new Vec3(1, 0.88, 1), position: new Vec3(bx, by - 4, 0) })
      .to(0.1, { scale: new Vec3(1, 1.04, 1), position: new Vec3(bx, by + 1.5, 0) })
      .to(0.11, { scale: new Vec3(1, 1, 1), position: new Vec3(bx, by, 0) })
      .start();
  }

  /** 槽位中心世界坐标（装车落点） */
  slotWorld(i: number): Vec3 {
    const sn = this.slots[i];
    const ut = sn.getComponent(UITransform)!;
    return ut.convertToWorldSpaceAR(new Vec3(this.sw / 2, -this.sh / 2, 0));
  }
}
