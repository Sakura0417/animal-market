/* FenceView（VIEW）：围栏 7 格条 —— 存货渲染 / 订单匹配高亮 / 稀有金框 /
 * 挤爆红色警示脉冲 / 落格弹跳（popIn）。
 * 修改时间：2026-10-08 11:45 —— UI 审查 **H2（实为运行时 BUG）**：`'back-out'` → `'backOut'`（落格 popIn）。
 *   引擎只在首字符大写时归一化短横线名，小写写法查表落空 ⇒ 缓动静默退化为线性。详见 Panels.ts 头部条目。
 * 修改时间：2026-10-08 11:45 —— UI 审查 M2：`sz` 去掉死初值 `= 40`（2026-09-26 放大前的旧值，
 *   构造期必被覆盖，但会被误读为真实值）。改为仅声明 + 构造期赋值，并注明实际取值 ≈44。
 *   纯可读性修正，渲染结果零变化。
 * 修改时间：2026-09-26 23:01 —— **去掉「围栏 0/7」标签 + 7 格放大**（用户："围栏描述是否可以去掉"）：
 *   标签的两项职能均冗余（① 区域命名：格子位置固定、有动物即见图标，开局须知也写明"围栏只有
 *   7 格"；② 存货计数：格子空满一眼可见，满栏另有整排红色警示脉冲，精确数字反不如视觉直观），
 *   故整条移除 —— label 字段、render 赋值、whitePill/makeLabel/placeC/LABEL_HIRES 的 import
 *   一并清退。腾出的横向空间全给格子：sz 39.86 → **44**（+10.4%，格内动物 32.7 → 36.1），
 *   条高同步 40 → 46（GameView.FENCE_H），多出的 6px 由牧场弹性高度吸收（−1%）。
 *   2026-09-26 22:41 —— 「围栏 0/7」标签徽章化（方案 D，该标签已于 23:01 整条移除）：
 *   深绿裸文字 → 白底圆角胶囊（34×26，RADIUS.chip），与 HUD 胶囊语言统一；顺带修
 *   `lb.lineHeight` 挂包装对象不生效的存量写法（改 .label.lineHeight×LABEL_HIRES）。
 *   2026-09-08 —— 槽位动物改统一 animalIcon（矢量占位+sprite 切换）；
 *   2026-09-06 01:50:00 修复格子左偏 sz/2：place 锚点 (0,1) 与居中
 *   绘制混用；改为 host 容器 + 居中 slot 子节点，slotWorld 改由 host 换算。 */
import { Graphics, Node, Tween, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import { FENCE_MAX } from '../core/Constants';
import type { Animal } from '../core/Types';
import { col, colA, newG } from './Draw2D';
import { animalIcon } from './AnimalArt';
import { place } from './Ui';

export class FenceView {
  readonly node: Node;
  private w: number;
  private h: number;
  /** 格边长（设计单位）。构造期算出，无初值 —— 见下方公式。取值约 44（条高 46 时的满格）。
   *  不写死初值（原为 `= 40`，是 2026-09-26 格子放大前的旧值、且构造期必被覆盖）：
   *  死初值会被后续读者当成真实值去推字号/间距，本项目已有同类事故。 */
  private sz: number;
  private slotNodes: Node[] = [];
  private slotHosts: Node[] = [];
  private slotG: Graphics[] = [];
  private warn: Node[] = [];
  private curUid: number[] = [];

  constructor(parent: Node, left: number, top: number, w: number, h: number) {
    this.w = w;
    this.h = h;
    const { node } = newG('fencebar', w, h);
    this.node = node;
    /* 去掉「围栏 0/7」标签 + 格子放大（2026-09-26 23:01，用户："围栏描述是否可以去掉"）：
       判断依据（第一性原理 —— 这个标签的两项职能是否真的需要它）：
       ① 「区域命名」冗余：7 个格子就在固定位置、装有动物时可见图标，开局须知里也已写明
          "围栏只有 7 格"；
       ② 「存货计数」冗余：格子空/满一眼可见，满栏时还有整排红色警示脉冲 —— 精确数字
          （5/7）反而不如视觉占用直观。
       故标签整体移除（连带 whitePill/makeLabel/placeC/LABEL_HIRES 的 import 与 label 字段、
       render 赋值一并清退）。腾出的 42px 横向空间**全部给格子**：sz 由 39.86 → 44（+10.4%），
       格内动物图标 px = sz×0.82 同步 32.7 → 36.1。代价是条高 40 → 46（+6，见 GameView.FENCE_H），
       由牧场弹性高度吸收（牧场约 571 → 565，−1%，格位排布不受影响）。 */
    const SZ_GAP = 5;                                          // 格间距（沿用原值）
    const sz = Math.min((w - 13 - (FENCE_MAX - 1) * SZ_GAP) / FENCE_MAX, h - 2);
    this.sz = sz;
    const left0 = (w - (sz * FENCE_MAX + SZ_GAP * (FENCE_MAX - 1))) / 2;   // 整排居中
    for (let i = 0; i < FENCE_MAX; i++) {
      // 修复（2026-09-06 01:50:00）：place 会重置锚点为 (0,1)，而 slot 底板按中心绘制，
      //   直接 place 导致每格视觉左上偏移 sz/2（首格侵入文字区）。改为 (0,1) 容器
      //   host + 居中底板子节点 sn 定位到 (sz/2,-sz/2)；渲染/动画仍操作 sn 不变。
      const host = new Node('fsHost' + i);
      place(host, left0 + i * (sz + SZ_GAP), (h - sz) / 2, sz, sz);
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
          tween(sn).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
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
