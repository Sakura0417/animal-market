/* FenceView（VIEW）：围栏 7 格条 —— 存货渲染 / 订单匹配高亮 / 稀有金框 /
 * 挤爆红色警示脉冲 / 落格弹跳（popIn）。
 * 修改时间：2026-09-08 —— 槽位动物改统一 animalIcon（矢量占位+sprite 切换）；
 *   2026-09-06 01:50:00 修复格子左偏 sz/2：place 锚点 (0,1) 与居中
 *   绘制混用；改为 host 容器 + 居中 slot 子节点，slotWorld 改由 host 换算。 */
import { Graphics, Node, Tween, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import { FENCE_MAX } from '../core/Constants';
import type { Animal } from '../core/Types';
import { col, colA, makeLabel, newG } from './Draw2D';
import { animalIcon } from './AnimalArt';
import { place, placeC } from './Ui';

export class FenceView {
  readonly node: Node;
  private w: number;
  private h: number;
  private sz = 40;
  private slotNodes: Node[] = [];
  private slotHosts: Node[] = [];
  private slotG: Graphics[] = [];
  private warn: Node[] = [];
  private curUid: number[] = [];
  private label: ReturnType<typeof makeLabel>;

  constructor(parent: Node, left: number, top: number, w: number, h: number) {
    this.w = w;
    this.h = h;
    const { node } = newG('fencebar', w, h);
    this.node = node;
    const lb = makeLabel('围栏\n0/' + FENCE_MAX, 10, '#44613c', false);
    lb.lineHeight = 13;
    placeC(lb.node, 17, -h / 2, 34, h);
    node.addChild(lb.node);
    this.label = lb;
    const sz = (w - 34 - 8 - 6 * 5) / 7;
    this.sz = sz;
    for (let i = 0; i < FENCE_MAX; i++) {
      // 修复（2026-09-06 01:50:00）：place 会重置锚点为 (0,1)，而 slot 底板按中心绘制，
      //   直接 place 导致每格视觉左上偏移 sz/2（首格侵入文字区）。改为 (0,1) 容器
      //   host + 居中底板子节点 sn 定位到 (sz/2,-sz/2)；渲染/动画仍操作 sn 不变。
      const host = new Node('fsHost' + i);
      place(host, 34 + 8 + i * (sz + 5), (h - sz) / 2, sz, sz);
      node.addChild(host);
      const { node: sn, g } = newG('fs' + i, sz, sz);
      sn.setPosition(sz / 2, -sz / 2, 0);
      host.addChild(sn);
      this.slotHosts.push(host);
      this.slotNodes.push(sn);
      this.slotG.push(g);
      this.curUid.push(-1);
      // 挤爆红色警示层（持久节点，仅满栏时脉冲）
      const wn = newG('warn' + i, sz, sz);
      wn.g.roundRect(-sz / 2 + 1, -sz / 2 + 1, sz - 2, sz - 2, 9);
      wn.g.strokeColor = colA('#ff6f61', 220);
      wn.g.lineWidth = 2;
      wn.g.stroke();
      wn.node.addComponent(UIOpacity).opacity = 0;
      wn.node.active = false;
      sn.addChild(wn.node);
      this.warn.push(wn.node);
    }
    place(node, left, top, w, h);
    parent.addChild(node);
  }

  /** 全量渲染：hideUids = 在途动物 uid 集合（在栏但暂不可见，2026-09-06 14:05 并发点击改造） */
  render(fence: Animal[], needs: Set<string>, hideUids: Set<number> = new Set()): void {
    const full = fence.length >= FENCE_MAX;
    for (let i = 0; i < FENCE_MAX; i++) {
      const sn = this.slotNodes[i];
      const g = this.slotG[i];
      const a = fence[i];
      g.clear();
      if (a) {
        const match = needs.has(a.type.id);
        // 稀有金光外框已移除（2026-09-08 用户要求去掉稀有金环类视觉）
        g.roundRect(-this.sz / 2, -this.sz / 2, this.sz, this.sz, 9);
        g.fillColor = match ? col('#fff3dd') : col('#f0fbf2');
        g.fill();
        g.strokeColor = match ? col('#ff9d2b') : colA('#58c06c', 200);
        g.lineWidth = match ? 1.6 : 1.2;
        g.stroke();
        const hidden = hideUids.has(a.uid);
        if (this.curUid[i] !== a.uid) { // 落格：重建 + popIn
          Tween.stopAllByTarget(sn);
          sn.children.slice().forEach(c => { if (c.name !== 'warn' + i) c.destroy(); });
          sn.setScale(0.3, 0.3, 1);
          if (!hidden) this.drawSlotAnimal(sn, a);
          tween(sn).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'back-out' }).start();
          this.curUid[i] = a.uid;
        } else if (hidden) {
          sn.children.slice().forEach(c => { if (c.name !== 'warn' + i) c.destroy(); });
        } else if (sn.children.length <= 1) { // 飞行结束后补画
          this.drawSlotAnimal(sn, a);
        }
        this.warn[i].active = full;
        const wo = this.warn[i].getComponent(UIOpacity)!;
        Tween.stopAllByTarget(wo);
        if (full) {
          wo.opacity = 255;
          tween(wo).repeatForever(tween(wo).to(0.5, { opacity: 110 }).to(0.5, { opacity: 255 })).start();
        }
      } else {
        g.roundRect(-this.sz / 2, -this.sz / 2, this.sz, this.sz, 9);
        g.fillColor = colA('#ffffff', 217);
        g.fill();
        this.warn[i].active = false;
        if (this.curUid[i] !== -1) {
          sn.children.slice().forEach(c => { if (c.name !== 'warn' + i) c.destroy(); });
          this.curUid[i] = -1;
        }
      }
    }
    // 修复（2026-09-06 01:20:00）：makeLabel 包装对象需写 .label.string
    this.label.label.string = '围栏\n' + fence.length + '/' + FENCE_MAX;
  }

  private drawSlotAnimal(sn: Node, a: Animal): void {
    const px = this.sz * 0.82;
    // 2026-09-08 全场景统一动物图：双层图标（矢量占位 + sprite 异步切换，失败回退矢量）
    const icon = animalIcon('fa', px, a.type.id, a.rare);
    icon.setPosition(0, 0, 0);
    sn.addChild(icon);
  }

  /** 槽位中心世界坐标（装车链起飞点；host 锚点(0,1)，原点=左上，(sz/2,-sz/2) 即中心） */
  slotWorld(i: number): Vec3 {
    const host = this.slotHosts[Math.min(Math.max(0, i), FENCE_MAX - 1)];
    const ut = host.getComponent(UITransform)!;
    return ut.convertToWorldSpaceAR(new Vec3(this.sz / 2, -this.sz / 2, 0));
  }

  /** 围栏条中心（兜底起飞点） */
  centerWorld(): Vec3 {
    const ut = this.node.getComponent(UITransform)!;
    return ut.convertToWorldSpaceAR(new Vec3(this.w / 2, -this.h / 2, 0));
  }
}
