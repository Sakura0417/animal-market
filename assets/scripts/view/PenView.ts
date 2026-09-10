/* PenView（VIEW）：牧场网格区 —— 草地底板 + 格线 + 动物节点池 + 点格命中。
 * core 坐标 (x:0-100, yu:0-100*ASPECT) 拉伸映射到实际矩形，任意屏比完整可见。
 * 节点池按 uid 复用，避免整场重建导致的动画断裂与 GC 压力。
 * 修改时间：2026-09-09 23:35 —— P1.5 网格语义收尾（docs/grid-scheme-review-20260909.md 阶段 C）：
 *   ① onTap 由「最近圆匹配」改**点格命中**（O(1)、零歧义；紧密排列下贴近动物圆形阈值会点错，
 *     分析文档 §2.4-P4）；以逻辑格位（core col/row）为准，动画位移不影响命中。
 *   ② 底板绘制低透明度格线——向玩家传达"格子规则"，兼作后续编辑器视觉基础。
 *   ③ z 序按行主序确定化（紧密排列下相邻精灵必重叠，插入序不确定会导致同一布局
 *     两次渲染遮挡关系不同，分析文档 §5.2）。
 *   ④ ~~新增 roadWaypointsBFS~~（已于 19:52 随绕行机制取消删除）；原设计：
 *     穿缝隙出栏，替代弧线漂移）。
 *   ⑤ 新增 cellPitchPx、删除 coreRadiusPx——相邻格遮挡下接触距离 = 格距 − 精灵宽（常量），
 *     R 常量与投影换算退役（P6 数值/视觉耦合温床消失）。 */
import { EventTouch, Node, UITransform, Vec3 } from 'cc';
import { ASPECT, GRID_COLS, GRID_ROWS } from '../core/Constants';
import { isBlocked } from '../core/Board';
import type { Animal, Dir } from '../core/Types';
import { col, colA, dashedRoundRect, newG, RADIUS } from './Draw2D';
import { AnimalNodeC } from './AnimalNode';
import { place } from './Ui';

export class PenView {
  readonly node: Node;
  private w: number;
  private h: number;
  private sz: number;
  private pool = new Map<number, AnimalNodeC>();
  /** 逻辑格位 → uid 映射（P1.5 点格命中用；idx = row*GRID_COLS+col，岩石不入表）。 */
  private cellUid = new Map<number, number>();

  constructor(parent: Node, left: number, top: number, w: number, h: number, private onPick: (uid: number) => void) {
    this.w = w;
    this.h = h;
    this.sz = w * 0.152;
    const { node, g } = newG('pen', w, h);
    this.node = node;
    // 圆角草地渐变（2026-09-06 10:45 改造）：6 段插值近似 linear-gradient(180deg,#a2dd90,#7cc874)。
    // Graphics 无单侧圆角，采用"圆角帽 + 中段直条"画法：顶部整宽圆角帽（band0 色）、
    // 中段 4 条直色带、底部整宽圆角帽（借用倒数第二档色，与末档肉眼无差），
    // 使农场四角与虚线边界（r=18）一致的圆角收口。
    const c0 = [0xa2, 0xdd, 0x90], c1 = [0x7c, 0xc8, 0x74];
    const stops = c0.map((_, k) => {
      const t = k / 5;
      const mix = c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
      return '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('');
    });
    const b = h / 6;
    g.roundRect(0, -2 * b, w, 2 * b, RADIUS.panel);            // 顶部圆角帽
    g.fillColor = col(stops[0]);
    g.fill();
    for (let k = 1; k <= 4; k++) {                   // 中段直色带
      g.rect(0, -(k + 1) * b - 0.7, w, b + 0.7);
      g.fillColor = col(stops[k]);
      g.fill();
    }
    g.roundRect(0, -h, w, 2 * b, RADIUS.panel);      // 底部圆角帽（stops[4] ≈ stops[5]）
    g.fillColor = col(stops[4]);
    g.fill();
    // 格线（P1.5·阶段C4，2026-09-09）：低透明度白色网格线（6×10），画在渐变之上、
    // 虚线边界之下——向玩家传达"格子规则"，兼作后续关卡编辑器（PRD 5.1 Phase B）视觉基础。
    g.strokeColor = colA('#ffffff', 28);
    g.lineWidth = 1;
    for (let c = 1; c < GRID_COLS; c++) {
      const x = (c / GRID_COLS) * w;
      g.moveTo(x, 0);
      g.lineTo(x, -h);
    }
    for (let r = 1; r < GRID_ROWS; r++) {
      const y = -(r / GRID_ROWS) * h;
      g.moveTo(0, y);
      g.lineTo(w, y);
    }
    g.stroke();
    // 顶部高光椭圆已移除（2026-09-08 用户要求）：原型 radial-gradient 装饰，
    // 在顶视角实拍图美术下表现为「白色半透明大椭圆」违和残留。
    const ut = node.getComponent(UITransform)!;
    // 白色虚线边界（视觉语言：棋盘虚线）
    dashedRoundRect(g, 0, -h, w, h, 18, '#ffffff', 2.5, 8, 7);
    place(node, left, top, w, h);
    parent.addChild(node);
    node.on(Node.EventType.TOUCH_END, this.onTap, this);
  }

  private onTap(e: EventTouch): void {
    const p = e.getUILocation();
    const ut = this.node.getComponent(UITransform)!;
    const lp = ut.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    // P1.5·阶段C1（2026-09-09）：点格命中——本地坐标 → 格位 → 查逻辑占用表。
    // 空格/岩石格无 uid → 忽略（岩石不可选，PRD 5.1）。
    const c = Math.floor(lp.x / (this.w / GRID_COLS));
    const r = Math.floor(-lp.y / (this.h / GRID_ROWS)); // pen 本地 y 向上为负，向下延伸
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return;
    const uid = this.cellUid.get(r * GRID_COLS + c);
    if (uid !== undefined) this.onPick(uid);
  }

  /** 全量同步：新增/移除/位置/吊车目标（P1.5 z 序/格位表；2026-09-10 移除 unlock 弹跳参数——
   *  用户反馈"点击一只动物后周围动物放大"不符合预期，解锁不再有任何视觉标记） */
  render(herd: Animal[], craneMode: boolean): void {
    const alive = new Set<number>();
    this.cellUid.clear();
    for (const a of herd) {
      alive.add(a.uid);
      let an = this.pool.get(a.uid);
      if (!an) {
        an = new AnimalNodeC(a, this.sz);
        this.node.addChild(an.node);
        this.pool.set(a.uid, an);
      }
      an.sync(a, (a.x / 100) * this.w, -(a.yu / (100 * ASPECT)) * this.h);
      if (a.obstacle) an.node.setSiblingIndex(0); // 岩石垫底（z-index 1 < 2）
      else {
        // 点格命中表（P1.5·C1）：同格重复时首到者占格，与 Grid.build 语义一致
        const idx = a.row * GRID_COLS + a.col;
        if (!this.cellUid.has(idx)) this.cellUid.set(idx, a.uid);
      }
    }
    // z 序按行主序确定化（P1.5·C3，2026-09-09）：紧密排列下相邻精灵必重叠，
    // 行主序（row*COLS+col 升序）让"下排压上排"的遮挡关系稳定可复现。
    const zOrder = herd
      .filter((a) => !a.obstacle)
      .sort((x, y) => (x.row * GRID_COLS + x.col) - (y.row * GRID_COLS + y.col));
    zOrder.forEach((a, i) => {
      const an = this.pool.get(a.uid);
      if (an) an.node.setSiblingIndex(i + 1);
    });
    for (const a of herd) {
      if (a.obstacle) continue;
      const an = this.pool.get(a.uid);
      if (an) an.setCrane(craneMode && isBlocked(herd, a));
    }
    for (const [uid, an] of Array.from(this.pool)) {
      if (!alive.has(uid)) { an.markDead(); an.node.destroy(); this.pool.delete(uid); }
    }
  }

  byUid(uid: number): AnimalNodeC | null { return this.pool.get(uid) ?? null; }

  /** core 坐标 (x:0-100, yu:0-125) → pen 本地像素（cocos y 向上，向下延伸为负）。
   * 新增于 2026-09-06 02:15:00：供 GameView 做行走/碰撞动画的路径换算。 */
  posLocal(x: number, yu: number): Vec3 {
    return new Vec3((x / 100) * this.w, -(yu / (100 * ASPECT)) * this.h, 0);
  }

  /** pen 本地 → 世界坐标 */
  localToWorld(p: Vec3): Vec3 {
    return this.node.getComponent(UITransform)!.convertToWorldSpaceAR(p);
  }

  /** 格距（本地像素，P1.5·C5，2026-09-09）：横 = w/COLS、纵 = h/ROWS。
   *  碰撞接触距离 = 格距 − 精灵显示宽（PRD 5.1 常量公式），取代旧投影换算。 */
  cellPitchPx(dir: Dir): number {
    return (dir === 'left' || dir === 'right') ? this.w / GRID_COLS : this.h / GRID_ROWS;
  }

  /** 动物显示尺寸（牧场内像素；土路带宽与之一致，2026-09-06 10:05 需求） */
  animalSize(): number {
    return this.sz;
  }

  /**
   * 沿土路的行走路径（pen 本地坐标，不含起点；末点 = 土路顶边中央的围栏引道口）。
   * 2026-09-06 10:05 需求：动物先按自身朝向走到土路上，再**沿土路**跑到围栏口。
   * 路由：出界点 E（自身朝向投影到路中心线，bandOffset = 路中心线距牧场边界）
   * → 同侧转角 → 顶边中央 T。朝下动物自动选左/右 nearer 侧兜底边。
   * 2026-09-10 19:52 取消绕行机制（用户指令）：删除 exitDir 参数——走廊遮挡语义下
   * 能入栏的动物朝向路径必然全程空，出栏恒为"沿自身朝向直走上土路"，无绕行分支。
   */
  roadWaypoints(a: Animal, bandOffset: number): Vec3[] {
    const dir = a.dir;
    const ys = 100 * ASPECT;
    const pw = this.w, ph = this.h, O = bandOffset;
    const px = (x: number): number => (x / 100) * pw;
    const py = (yu: number): number => -(yu / ys) * ph;
    // 出界点 E：自身位置沿朝向顶到路中心线。
    // 坐标纪律（2026-09-06 10:55 修正符号）：pen 本地 y 向上，牧场草地占 [-ph, 0]，
    //   牧场顶边 = 0、底边 = -ph——因此"顶边外的土路"是 +O、"底边外的土路"是 -(ph+O)。
    //   （原实现 up/down/顶角全部符号颠倒，动物实际没踏上土路。）
    let e: Vec3;
    if (dir === 'up') e = new Vec3(px(a.x), O, 0);
    else if (dir === 'down') e = new Vec3(px(a.x), -(ph + O), 0);
    else if (dir === 'left') e = new Vec3(-O, py(a.yu), 0);
    else e = new Vec3(pw + O, py(a.yu), 0);
    const t = new Vec3(pw / 2, O, 0);               // 围栏引道口（顶边中央的路面）
    const nw: Vec3 = new Vec3(-O, O, 0);            // 左上角（路中心线）
    const ne: Vec3 = new Vec3(pw + O, O, 0);        // 右上角
    const sw2: Vec3 = new Vec3(-O, -(ph + O), 0);   // 左下角
    const se: Vec3 = new Vec3(pw + O, -(ph + O), 0);// 右下角
    switch (dir) {
      case 'up':
        // 修复（2026-09-06 10:50:00）：此前只返回围栏口一个点——朝上动物从原位置
        //   直接斜插过去。必须先沿自身朝向直行上土路（x 不变），再沿顶边路跑到引道口。
        return [new Vec3(px(a.x), -O, 0), t];
      case 'left':
        return [e, nw, t];                           // 先向左走到左路 → 沿左边向上 → 顶边
      case 'right':
        return [e, ne, t];                           // 先向右走到右路 → 沿右边向上 → 顶边
      default: {                                     // 朝下：先向下走到底路，选水平更近的一侧兜边
        const viaLeft = (e.x + O) <= (pw + O - e.x);
        return viaLeft ? [e, sw2, nw, t] : [e, se, ne, t]; // 底边 → 侧边 → 顶边 → 引道口
      }
    }
  }

  /** 动物中心世界坐标（fx 起飞点） */
  uidWorld(uid: number): Vec3 | null {
    const an = this.pool.get(uid);
    return an ? an.node.worldPosition.clone() : null;
  }

  clear(): void {
    this.pool.forEach(an => an.node.destroy());
    this.pool.clear();
  }
}
