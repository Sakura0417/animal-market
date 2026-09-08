/* AnimalNode（VIEW）：牧场单只动物/岩石节点 —— 双素材模式：
 *   ART_MODE='sprite'（默认）：顶视角 3D 渲染图（assets/resources/animal/{species}.png，
 *     单图+运行时旋转 —— spNode.angle = -CSS_DEG[a.dir]，cocos angle 逆时针为正故取负；
 *     旋转以 spNode 中心为锚点（UITransform 默认锚点 0.5,0.5），保持原始分辨率与缩放；
 *     移动时按 dir 旋转使头部指向前进方向，静止/转向保持上次朝向避免抖动。
 *     素材加载失败自动回退矢量。
 *   ART_MODE='vector'：旧矢量绘制 + 方向箭头（回退方案，代码完整保留——
 *     把 AnimalArt.ts 里 ART_MODE 改成 'vector' 即可整体回退到接入前表现）。
 * 结构：root（位置/缩放动画宿主，contentSize=sz）→ skin（矢量皮肤，64 空间，scale=sz/64）
 *   → spriteNode（sprite 模式）→ flash/ring（交互态，两种模式共用）。
 *   稀有金环视觉已移除（2026-09-08 用户要求；rare 仍影响售价与结算文字标注）。
 * 分层避免绘制缩放与 bonk/bounce 动画互相覆盖。
 * 视觉随机量（rot 倾斜）在本层生成，不污染 core 随机流（种子对拍纪律）。
 * 修改时间：2026-09-08（单图顶视角改造：24 张 {species}_{dir}.png → 6 张 {species}.png +
 *   运行时旋转；AnimalArt.loadAnimalSpriteFrame(species, _dir, cb) dir 作兼容垫片） */
import { Node, Sprite, SpriteFrame, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { colA, dashedRoundRect, drawAnimal, drawArrowIcon, drawRock, newG } from './Draw2D';
import { ART_MODE, loadAnimalSpriteFrame } from './AnimalArt';
import type { Animal, Dir } from '../core/Types';

/** CSS rotate 顺时针为正；cocos angle 逆时针为正 → 箭头角度取负 */
const CSS_DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
const DIR_OFF: Record<Dir, Vec3> = {
  up: new Vec3(0, 1, 0), down: new Vec3(0, -1, 0), left: new Vec3(-1, 0, 0), right: new Vec3(1, 0, 0)
};

export class AnimalNodeC {
  readonly node: Node;
  readonly uid: number;
  readonly obstacle: boolean;
  private arrow: Node | null = null;        // 方向箭头（仅 vector 模式）
  private flash: Node | null = null;
  private ring: Node | null = null;
  private base = new Vec3();
  private sprite: Sprite | null = null;     // 素材精灵（sprite 模式）
  private spriteNode: Node | null = null;
  private vectorSkin: Node | null = null;   // 矢量皮肤（vector 模式 / 回退用）
  private curDir: Dir | null = null;        // 当前素材朝向（防竞态）
  private dead = false;                     // 节点销毁标记（异步回调防御）

  constructor(a: Animal, sz: number) {
    this.uid = a.uid;
    this.obstacle = a.obstacle;
    const { node } = newG('a' + a.uid, sz, sz);
    this.node = node;
    const skin = newG('skin', 64, 64);
    const sk = skin.node;
    sk.setScale(sz / 64, sz / 64, 1);
    node.addChild(sk);
    this.vectorSkin = sk;
    if (a.obstacle) {
      drawRock(skin.g);
    } else {
      // 稀有金环视觉已移除（2026-09-08 用户要求）；rare 仍影响售价 ×3 与结算「闪」文字
      drawAnimal(skin.g, a.type.id, a.rare);
      if (ART_MODE === 'vector') {
        const ar = newG('arrow', 64, 64);
        drawArrowIcon(ar.g);
        ar.node.setScale(0.38, 0.38, 1);
        this.arrow = ar.node;
        sk.addChild(ar.node);
      }
      const fl = newG('flash', 64, 64); // 碰撞红闪（两模式共用，挂 root 不随 skin 隐藏）
      fl.g.circle(0, 0, 30);
      fl.g.fillColor = colA('#ff4b3e', 150);
      fl.g.fill();
      fl.node.addComponent(UIOpacity).opacity = 0;
      fl.node.setScale(sz / 64, sz / 64, 1);
      this.flash = fl.node;
      node.addChild(fl.node);
      const rg = newG('ring', 64, 64); // 吊车目标虚线圈（两模式共用）
      dashedRoundRect(rg.g, -36.5, -36.5, 73, 73, 12, '#ff9d2b', 2, 6, 5);
      rg.node.addComponent(UIOpacity).opacity = 0; // 修复（2026-09-07 00:20:00）：漏挂
      //   UIOpacity 导致 setCrane 取组件为 null，吊车模式首次运行即崩（用户实测）。
      rg.node.active = false;
      rg.node.setScale(sz / 64, sz / 64, 1);
      this.ring = rg.node;
      node.addChild(rg.node);

      if (ART_MODE === 'sprite') {
        // 素材精灵：先显示矢量皮肤占位，素材就绪后隐藏矢量、显示图（加载失败保持矢量）
        const spNode = new Node('sp');
        spNode.addComponent(UITransform).setContentSize(sz, sz);
        const sp = spNode.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.trim = false;
        spNode.active = false;
        node.addChild(spNode);
        this.spriteNode = spNode;
        this.sprite = sp;
        loadAnimalSpriteFrame(a.type.id, a.dir, (sf) => {
          if (this.dead || this.sprite !== sp) return;
          if (sf) {
            sp.spriteFrame = sf;
            this.curDir = a.dir;
            spNode.active = true;
            if (this.vectorSkin) this.vectorSkin.active = false;
          } else if (this.vectorSkin) {
            this.vectorSkin.active = true;   // 回退矢量
          }
        });
        // 初始朝向：dir 同步改 spNode.angle，构造期先于 sync() 设一次避免首帧错位
        spNode.angle = -CSS_DEG[a.dir];
      }
    }
    node.angle = Math.random() * 52 - 26; // 视觉倾斜（view 层随机）
  }

  /** 同步位置与朝向（不动画）。sprite 模式下朝向变化 → 旋转 spNode（不换图，单图顶视角） */
  sync(a: Animal, px: number, py: number): void {
    this.base.set(px, py, 0);
    this.node.setPosition(px, py, 0);
    if (this.arrow) this.arrow.angle = -CSS_DEG[a.dir];
    if (this.sprite && this.spriteNode) {
      // 单图顶视角：dir 变化只旋转 spNode.angle；重复设置同角度无副作用（cocos 内部去重）
      this.spriteNode.angle = -CSS_DEG[a.dir];
    }
  }

  get pos(): Vec3 { return this.base; }

  setCrane(on: boolean): void {
    if (!this.ring) return;
    // 防御（2026-09-07 00:20:00）：组件缺失时补挂，不再依赖非空断言
    const ro = this.ring.getComponent(UIOpacity) ?? this.ring.addComponent(UIOpacity);
    Tween.stopAllByTarget(ro);
    this.ring.active = on;
    if (on) {
      ro.opacity = 255;
      tween(ro).repeatForever(tween(ro).to(0.5, { opacity: 110 }).to(0.5, { opacity: 255 })).start();
    }
  }

  /**
   * 碰撞（2026-09-06 02:15:00 重做）：沿朝向**真实行进** hitDist 像素到接触点，
   * 接触瞬间点亮红闪并回调 onImpact（粒子/飘字/震屏/扣心表现由 GameView 在此挂），
   * 再过冲弹回原位。速度与入栏走路动画一致（≈380px/s），距离越远冲得越久。
   */
  bonk(dir: Dir, hitDist = 26, onImpact?: () => void): void {
    const d = DIR_OFF[dir];
    const b = this.base;
    const contact = new Vec3(b.x + d.x * hitDist, b.y + d.y * hitDist, 0);
    const back = new Vec3(b.x - d.x * 7, b.y - d.y * 7, 0);
    const travel = Math.min(0.6, Math.max(0.14, hitDist / 380));
    Tween.stopAllByTarget(this.node);
    tween(this.node)
      .to(travel, { position: contact }, { easing: 'quad-in' })   // 加速冲向接触点
      .call(() => {
        if (onImpact) onImpact();                                  // 接触瞬间：碰撞流程
        if (this.flash) {
          const fo = this.flash.getComponent(UIOpacity) ?? this.flash.addComponent(UIOpacity); // 防御（2026-09-07 00:20:00）
          Tween.stopAllByTarget(fo);
          fo.opacity = 255;
          tween(fo).to(0.46, { opacity: 0 }).start();
        }
      })
      .to(0.13, { position: back })                                // 弹回（过冲）
      .to(0.2, { position: b })                                    // 回到原位
      .start();
  }

  /** 解锁弹跳（原型 unlockBounce：缩 .85 上浮 → 1.16 上冲 → 回位） */
  bounceUnlock(): void {
    Tween.stopAllByTarget(this.node);
    const b = this.base;
    this.node.setScale(0.85, 0.85, 1);
    this.node.setPosition(b.x, b.y + 5, 0);
    tween(this.node)
      .to(0.18, { position: new Vec3(b.x, b.y + 10, 0), scale: new Vec3(1.16, 1.16, 1) }, { easing: 'quad-out' })
      .to(0.32, { position: new Vec3(b.x, b.y, 0), scale: new Vec3(1, 1, 1) })
      .start();
  }

  /** 节点销毁标记：素材异步回调的防御（2026-09-07 11:30 素材接入新增） */
  markDead(): void {
    this.dead = true;
  }
}
