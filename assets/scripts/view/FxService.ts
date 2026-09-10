/* FxService（VIEW）：特效层 —— 弧线飞行 / 金币直线 / 碰撞粒子爆开 / 飘字 /
 * 通关彩带雨 / 屏幕震动。挂在 gameRoot 顶层（375×667 设计空间）。
 * 点位参数统一传世界坐标（view 各组件 worldPosition），内部换算为本层局部坐标。
 * 代数纪律：reset() 使代数 +1，旧代动画照常播完视觉，但回调一律作废（原型 fxGen）。
 * 修改时间：2026-09-09 22:30（walkPath 新增 initialDir：绕行出口方向时初始面朝出口）
 * 修改时间：2026-09-09 21:25（移除 walkPath 内朝向排查遗留的 console.log 诊断日志）
 * 修改时间：2026-09-08（单图顶视角改造）：attachCloneSprite 改返回 spNode 引用，
 *   内部按 dir 设 spNode.angle（不再依赖多张四向图），walkPath 段切换同步改 angle。 */
import { Node, Sprite, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { col, drawAnimal, drawCoin, makeLabel, newG } from './Draw2D';
import { ART_MODE, loadAnimalSpriteFrame } from './AnimalArt';
import type { Animal, Dir } from '../core/Types';

const FX_COLORS = ['#ff6f61', '#ff9d2b', '#ffd24d', '#8ad94f', '#5cb2ea', '#ffffff'];
const CSS_DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

export class FxService {
  readonly node: Node;
  private gen = 0;
  private confettiOn = false;

  constructor(parent: Node, w: number, h: number) {
    const { node } = newG('fx', w, h);
    node.name = 'fx';
    this.node = node;
    parent.addChild(node);
  }

  private toLocal(world: Vec3): Vec3 {
    const ut = this.node.getComponent(UITransform)!;
    return ut.convertToNodeSpaceAR(world);
  }

  /** 克隆体素材精灵（2026-09-08 单图顶视角改造）：在克隆节点上叠 Sprite 并异步加载
   *  {species} 单图；素材就绪前由调用方的矢量皮肤占位（回退安全）。
   *  返回 spNode 供行走途中按行进方向同步旋转（不换图）。
   *  初始角度 = -CSS_DEG[dir]（cocos angle 逆时针为正故取负）。
   *  vecSkin（2026-09-08 修复）：素材就绪后同步隐藏调用方矢量皮肤层——
   *  此前未隐藏导致运动动画中矢量与 sprite 叠影（动物底部露出矢量描边）。 */
  private attachCloneSprite(node: Node, species: string, dir: Dir, size: number, vecSkin?: Node): Node | null {
    if (ART_MODE !== 'sprite') return null;
    const spNode = new Node('clone-sp');
    spNode.addComponent(UITransform).setContentSize(size, size);
    const sp = spNode.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    spNode.active = false;
    spNode.angle = -CSS_DEG[dir];                   // 初始朝向同步设（避免加载期首帧错位）
    node.addChild(spNode);
    loadAnimalSpriteFrame(species, dir, (sf) => {
      if (sf) {
        sp.spriteFrame = sf;
        spNode.active = true;
        if (vecSkin && vecSkin.isValid) vecSkin.active = false;   // 隐藏矢量皮肤，消除叠影
      }
    });
    return spNode;
  }

  /** 重开一局：作废旧回调 + 清场 */
  reset(): void {
    this.gen++;
    this.confettiOn = false;
    this.node.children.slice().forEach(c => {
      Tween.stopAllByTarget(c);
      const op = c.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      c.destroy();
    });
  }

  /** 弧线飞行：动物 from → to，中段抬升 + 缩放 1→1.3→0.55（原型 flyAnimal 430ms） */
  flyAnimal(a: Animal, fromW: Vec3, toW: Vec3, size: number, done?: () => void): void {
    const g0 = this.gen;
    const from = this.toLocal(fromW);
    const to = this.toLocal(toW);
    const { node } = newG('fly', size, size);
    const skin = newG('s', 64, 64);
    drawAnimal(skin.g, a.type.id, a.rare);
    skin.node.setScale(size / 64, size / 64, 1);
    node.addChild(skin.node);
    this.attachCloneSprite(node, a.type.id, 'up' as Dir, size, skin.node); // 装车 = 被吊起背对镜头
    node.setPosition(from.x, from.y, 0);
    this.node.addChild(node);
    const mid = new Vec3((from.x + to.x) / 2, (from.y + to.y) / 2 + 42, 0);
    tween(node)
      .to(0.24, { position: mid, scale: new Vec3(1.3, 1.3, 1) }, { easing: 'sineOut' })
      .to(0.19, { position: to, scale: new Vec3(0.55, 0.55, 1) }, { easing: 'sineIn' })
      .call(() => {
        node.destroy();
        if (g0 === this.gen && done) done();
      })
      .start();
  }

  /**
   * 走路版入栏（2026-09-06 10:05 按需求重做）：多段折线路径——先按自身朝向走到土路，
   * 再**沿土路**（逐顶点转向）跑到围栏引道口缩步入栏。
   * 段速：土路段 360（走）、末段 430（跑）；步频弹跳挂 skin，末段起停并缓缩到 0.62；
   * 每个顶点平滑转向（箭头朝行进方向）。wayWs = 世界坐标路径点（不含起点）。
   */
  walkPath(a: Animal, fromW: Vec3, wayWs: Vec3[], size: number, done?: () => void, initialDir?: Dir): void {
    const faceDir = initialDir ?? a.dir;   // 绕行出口（2026-09-09）：出口方向 ≠ 自身朝向时，初始面朝出口方向
    const g0 = this.gen;
    const pts = [this.toLocal(fromW), ...wayWs.map((w) => this.toLocal(w))];
    const { node } = newG('walk', size, size);
    const skin = newG('s', 64, 64);
    drawAnimal(skin.g, a.type.id, a.rare);
    const sk = size / 64;
    skin.node.setScale(sk, sk, 1);
    node.addChild(skin.node);
    // 素材模式：克隆体用顶视角图（矢量皮肤作就绪前占位），按行进方向逐段旋转
    const cloneSp = this.attachCloneSprite(node, a.type.id, faceDir, size, skin.node);
    node.setPosition(pts[0].x, pts[0].y, 0);
    this.node.addChild(node);

    // 步频弹跳（挂 skin；末段开始时停，不影响 node 主位移序列）
    tween(skin.node)
      .repeatForever(tween(skin.node)
        .to(0.1, { scale: new Vec3(sk * 1.06, sk * 0.94, 1) })
        .to(0.1, { scale: new Vec3(sk * 0.96, sk * 1.04, 1) }))
      .start();

    let seq = tween(node);
    for (let i = 1; i < pts.length; i++) {
      const last = i === pts.length - 1;
      const d = Vec3.distance(pts[i - 1], pts[i]);
      const dur = Math.min(1.0, Math.max(0.14, d / (last ? 430 : 360)));
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      // 素材模式：每段按行进方向旋转 spNode.angle（路网段均为轴向，四个朝向全覆盖）
      const legDir: Dir = Math.abs(dx) >= Math.abs(dy)
        ? (dx >= 0 ? 'right' : 'left')
        : (dy >= 0 ? 'up' : 'down');
      seq = seq.to(dur, { position: pts[i] }, {
        easing: 'sineInOut',
        onStart: () => {
          // 朝向切换必须随动画分段播放（2026-09-08 朝向提前 bug 第二次修复）：
          // 上轮用 .call() 包裹但用户反馈仍有问题，根因未完全定位（H1~H3 假设见 DEVLOG）。
          // 现改用 cocos tween 标准 onStart 回调——文档明确「该补间开始时执行」，
          // 语义稳定无歧义，彻底规避 .call() 在不同 cocos 版本/链构造顺序下时序差异。
          // 第 1 段（i=1）不赋值，保持 attachCloneSprite 初始 angle = -CSS_DEG[a.dir]，
          // 与"先沿自身朝向走出农场"的第一段严格一致。
          // （2026-09-09 21:25 移除朝向排查期遗留的 console.log 诊断日志）
          if (cloneSp && i >= 2) cloneSp.angle = -CSS_DEG[legDir];
          if (last) {
            Tween.stopAllByTarget(skin.node);                // 停步频
            skin.node.setScale(sk, sk, 1);
            // 缩步入栏：作用于当前可见层（sprite 模式 = spNode；矢量回退 = skin）
            const vis = (cloneSp && cloneSp.active) ? cloneSp : skin.node;
            const base = vis === cloneSp ? 1 : sk;
            tween(vis).to(dur, { scale: new Vec3(base * 0.62, base * 0.62, 1) }).start();
          }
        }
      });
    }
    seq.call(() => {
      node.destroy();
      if (g0 === this.gen && done) done();
    }).start();
  }

  /** 金币直线飞行 → 到达后才回调入账（制造爽感） */
  flyCoin(fromW: Vec3, toW: Vec3, done?: () => void): void {
    const g0 = this.gen;
    const from = this.toLocal(fromW);
    const to = this.toLocal(toW);
    const { node } = newG('flycoin', 26, 26);
    const skin = newG('s', 64, 64);
    drawCoin(skin.g);
    skin.node.setScale(26 / 64, 26 / 64, 1);
    node.addChild(skin.node);
    node.setPosition(from.x, from.y, 0);
    this.node.addChild(node);
    tween(node)
      .to(0.52, { position: to, scale: new Vec3(0.5, 0.5, 1) }, { easing: 'sineIn' })
      .call(() => {
        node.destroy();
        if (g0 === this.gen && done) done();
      })
      .start();
  }

  /** 碰撞粒子爆开：撞击点向四周飞散的彩色圆点（原型 spawnBurst） */
  burst(ptW: Vec3, n: number): void {
    const pt = this.toLocal(ptW);
    for (let i = 0; i < n; i++) {
      const sz = 5 + Math.random() * 6;
      const { node, g } = newG('b', sz, sz);
      g.circle(0, 0, sz / 2);
      g.fillColor = col(FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)]);
      g.fill();
      node.setPosition(pt.x, pt.y, 0);
      this.node.addChild(node);
      const op = node.addComponent(UIOpacity);
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 38;
      const dur = 0.36 + Math.random() * 0.24;
      tween(node).to(dur, {
        position: new Vec3(pt.x + Math.cos(ang) * dist, pt.y + Math.sin(ang) * dist, 0),
        scale: new Vec3(0.15, 0.15, 1),
      }, { easing: 'quadOut' }).start();
      tween(op).to(dur, { opacity: 0 }).call(() => node.destroy()).start();
    }
  }

  /** 飘字：碰撞 "-1 生命" / 通关 "牧场清空"（世界坐标版本） */
  floatText(ptW: Vec3, txt: string, big: boolean): void {
    const p = this.toLocal(ptW);
    this.floatTextLocal(p.x, p.y, txt, big);
  }

  /** 飘字（本层局部坐标版本，win 大字用） */
  floatTextLocal(x: number, y: number, txt: string, big: boolean): void {
    const t = makeLabel(txt, big ? 30 : 19, big ? '#e07f10' : '#ff6f61');
    t.label.enableOutline = true;
    t.label.outlineColor = col('#ffffff');
    t.label.outlineWidth = big ? 4 : 3;
    t.node.setPosition(x, y, 0);
    t.node.setScale(0.5, 0.5, 1);
    const op = t.node.addComponent(UIOpacity);
    op.opacity = 0;
    this.node.addChild(t.node);
    tween(t.node)
      .to(0.21, { position: new Vec3(x, y + 6, 0), scale: new Vec3(1.15, 1.15, 1) }, { easing: 'quadOut' })
      .to(0.74, { position: new Vec3(x, y + 56, 0), scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .start();
    tween(op)
      .to(0.21, { opacity: 255 })
      .delay(0.05)
      .to(0.69, { opacity: 0 })
      .call(() => t.node.destroy())
      .start();
  }

  /** 屏幕震动：gameRoot 轻晃（原型 screenShake 380ms） */
  shake(target: Node): void {
    Tween.stopAllByTarget(target);
    const b = target.position.clone();
    tween(target)
      .to(0.068, { position: new Vec3(b.x - 5, b.y - 3, 0) })
      .to(0.076, { position: new Vec3(b.x + 4, b.y + 3, 0) })
      .to(0.076, { position: new Vec3(b.x - 3, b.y + 2, 0) })
      .to(0.076, { position: new Vec3(b.x + 2, b.y - 2, 0) })
      .to(0.084, { position: b })
      .start();
  }

  /** 通关彩带雨：70 粒，每 6 粒 1 枚金币（原型 spawnConfetti） */
  confetti(w: number, h: number): void {
    if (this.confettiOn) return;
    this.confettiOn = true;
    for (let i = 0; i < 70; i++) {
      const isCoin = i % 6 === 0;
      const cw = 6 + Math.random() * 6, ch = 8 + Math.random() * 9;
      const { node, g } = isCoin ? newG('cf', 22, 22) : newG('cf', cw, ch);
      if (isCoin) {
        drawCoin(g);
        node.setScale(22 / 64, 22 / 64, 1);
      } else {
        g.rect(-cw / 2, -ch / 2, cw, ch);
        g.fillColor = col(FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)]);
        g.fill();
      }
      const x0 = -w / 2 + Math.random() * w;
      node.setPosition(x0, h / 2 + 26, 0);
      this.node.addChild(node);
      const dur = 1.7 + Math.random() * 1.4;
      const drift = (Math.random() - 0.5) * 180;
      const rot = -(360 + Math.random() * 720); // CSS 顺时针 → cocos 角度取负
      const op = node.addComponent(UIOpacity);
      tween(node)
        .delay(Math.random() * 0.35)
        .to(dur, { position: new Vec3(x0 + drift, -h / 2 - 80, 0), angle: rot })
        .call(() => node.destroy())
        .start();
      tween(op).delay(Math.random() * 0.35).to(dur, { opacity: 217 }).start();
    }
  }
}
