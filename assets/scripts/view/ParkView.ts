/* ParkView（VIEW）：停车位公路带 —— 5 车位（3 开 + 2 广告解锁）。
 * 卡车即订单：需求行 have/need + cargo 载货可视化 + 入场/驶离/落货动画。
 * 槽位结构（锚点(0,1)，62.6×68）：
 *   bgG（每次重绘的底板）· decor（锁位文案等重建层，可点解锁）·
 *   truckWrap（持久：truckG + cargo 池 + needs 行）。
 * 修改时间：2026-10-08 11:45 —— UI 审查 **H2（实为运行时 BUG）**：缓动名短横线 → 驼峰 ×3
 *   （`'back-out'`×2 入场/载货弹跳、`'quad-in'`×1 驶离）。🔴 引擎 `TweenEasingAdapter` 只在
 *   首字符大写时才归一化，小写短横线写法被原样返回 ⇒ 查表落空 ⇒ 缓动**静默退化为线性**、
 *   只有一条开发者警告。详见 Panels.ts 头部同类条目 / build 产物 `cocos-js/_virtual_cc-*.js`。
 * 修改时间：2026-09-27 00:01 —— 订单数字字号再降 2（用户："数字可以再调小一点"）：13/12/12/10
 *   （原 15/14/14/11），**图标不动** —— 23:37 已把动物立为主体，本轮只继续弱化附注（数字）。
 *   配平比（鸡本体高 ÷ 数字字形高）全部 ≥1：n≤1 1.63 / n≤2 1.47 / n=3,4 1.32 / n≥5 1.06。
 *   横向连带：digitW = 0.58×fs 同步变小 ⇒ 组宽 27.9→26.8、24.3→23.2、22.8→21.6、16.5→15.9。
 *   2026-09-26 23:37 —— **订单图标/字号重新配平**（用户："现在字体太大，动物太小"）：
 *   23:28 修好 contentSize 坐标系后字号终于按设计值渲染（16px 真实生效），随之暴露失衡 ——
 *   16px 数字字形高 ≈11.5，而 icon 17 的**鸡本体只有 10.8**（鸡是竖长条，水平填充率 0.447）
 *   ⇒ 数字比动物还大、抢走主体。配平原则：**动物本体高 ≈ 数字字形高 × 1.2~1.5**。
 *   新分档（icon 上限由**行数**决定，因纵向预算按行分配）：n≤1 → 24/15、n≤2 → 20/14、
 *   n≤3,4 → 18/14、n≥5 → 12/11（末车 3 行，3×icon ≤ 40 只能保持 12）。
 *   效果对比（鸡本体 vs 数字字形高）：修复前 10.8 vs 11.5（0.94，数字更大）→ n=2 档 12.7 vs 10.1
 *   （1.26）、n≤1 档 15.2 vs 10.8（1.41）。核算 tools/check-slot-geom.cjs 全档 OK。
 *   2026-09-26 23:28 —— **修「订单数字怎么调都显小 + 贴不住动物」的真根因**（用户："订单数字
 *   没有贴住动物身体，似乎还有调整的余地"）：**2x 高清化下 contentSize 坐标系错位** —— Label 的
 *   fontSize/lineHeight 都 ×2、节点 scale=0.5，故 Label 工作在 2 倍本地坐标系；而 placeC 传的
 *   contentSize 是节点本地单位，直接写设计单位就只有实际的一半。SHRINK 据此判为超框 ⇒ 缩放比
 *   min(13.08/18.56, 17/34) = **0.5** ⇒ 名义 16px 实际只渲染 **8px**，左对齐也一起失效（框宽只有
 *   一半，"框左缘"落错位）。像素实测佐证：数字字形高 5.8 设计 = 16×0.5×0.72 ✓。
 *   修法：contentSize 两维 ×LABEL_HIRES（与 Label 同坐标系）⇒ 字号回到真正的 16、左对齐生效、
 *   间距由实测 4.9 收到 NEED_GAP(1.0)。另修 `groupW` 公式（`iconPx` → `iconPx/2`：方框右半是
 *   透明留白，不占位）⇒ 单列档组不再左偏 5px。核算：tools/check-slot-geom.cjs 全档 OK
 *   且新增「单数字不缩」断言全 Y。
 *   2026-09-26 23:01 —— 订单间距再收紧：`ANIMAL_PAD_R` 0.20 → **0.24**（用户"先调整到 0.24 试试"）。
 *   ⚠️ 已越过最宽动物 cow（R=0.195）的"零间隙线"，cow 间距仅 0.24px（靠字形 side bearing 兜住）。
 *   2026-09-26 22:41 —— ① **订单间距二次收紧（方案 F）**：视觉间距的真凶是「图标方框 →
 *   动物本体」的透明留白（animalIcon 走 sprite 层，PNG 不裁透明边，实测水平填充率仅
 *   W∈[0.443,0.607] ⇒ 方框右缘到本体右缘空出 iconPx×0.195~0.279）；旧注释按 icons 的 0.8
 *   归一化填充率估成 1.7px，实际 iconPx=17 时达 3.4~4.7px。现按 ANIMAL_PAD_R=0.20 把计数
 *   文本框左缘对齐到「本体右缘 + NEED_GAP」，并把计数改**左对齐**消除窄数字 "1" 的 2.6px
 *   居中漂移 ⇒ 间距恒为 1px、与数字宽窄解耦。**② 锁定槽简化（方案 B）**：去掉 18×18 白色
 *   锁盒，锁图标 ICON_PX.slotLock 15→30（光学 24）直接落灰底，文案 9→10px、行距 11.5→12.5
 *   ⇒ 层级 5→3；顺带修 `t.lineHeight` 挂包装对象不生效的存量写法（改 .label.lineHeight×HIRES）。
 *   2026-09-26 22:05 —— 订单图标/字号再放大 + 组内间距收紧（用户："可以再调大一点，
 *   缩短动物和数字之间的距离"）：组内间距 2→1（NEED_GAP），省出的 1px 换成图标与字号各 +1 ——
 *   1 组 icon 20/fs 16、2~4 组 **icon 17/fs 16**、5~6 组 icon 12/fs 12。
 *   ⚠️ 宽度已到极限：组宽 27.3 / 列宽 27.8，**余量仅 0.5px**；再放大必然溢出列
 *   （进一步空间只能来自"取消一个车位"这类结构性改动，判断见 DEVLOG 2026-09-26 条目）。
 *   2026-09-26 21:35 —— **方案 1 落地：计数只显示「还差几只」+ 图标/字号全面放大**
 *   （用户审核通过；根因见 syncNeeds 内注释：旧格式 "0/2" 占 3 字符使 2 列组宽 28.5 > 列宽 27.8，
 *   已超宽 0.7px 靠收缩兜住 ⇒ 双数字格式把宽度顶死）：
 *   ① 计数由 "have/need" 改为 `need − have`（单数字，缺口为 0 时转绿）；已收集数在围栏条可见，信息不丢；
 *   ② 分档放大：1 组 icon 19/fs 15；2~4 组 icon 16/fs 15（原 10/9.5）；
 *   ③ 组内横向改为按「组宽 = 图标 + 间距 + 0.58×字号」反推偏移，计数框宽只给列内剩余 ⇒ 两位数由
 *      SHRINK 缩字，绝不顶到相邻组。核算：tools/check-slot-geom.cjs 全档 OK（含两位数最坏情况）。
 *   2026-09-24 18:56 —— **2 组订单改同一行**：单列判定由 `n<=2` 收紧为 `n<=1`，≥2 组统一 2 列网格。
 *   2026-09-24 16:29 —— **槽高回到 68 + ≥3 种订单改 2 列换行**（用户：
 *   "槽高维持 68；横向排是否可以换行，比如第一排显示两组，第二排显示一组"）：
 *   ① 带高/槽高回退到初版（84 / 68，比例 0.92），PARK_H 同步；
 *   ② ≥3 种订单由"单列 3 行"改**2 列换行**（3 种 = 第一排两组 + 第二排一组居中）。
 *      依据：槽高 68 时纵向 3 行需 40 ⇒ 块高 67.8、留白 0.1（放不下）；2 列 2 行只需 26
 *      ⇒ 块高 53.8、上下各留 7.1。
 *   ③ "内容块整体居中 + 车-单间距恒 5"的模型保持不变，全档位上下留白对称差 0.0。
 *   2026-09-24 16:11 —— 槽内纵向布局改「内容块整体居中」（订单离底太近、离车太远）：
 *   内容块 = 卡车可视高 + GAP_TRUCK_NEED(5) + 订单实际跨度，整块垂直居中 ⇒ 顶留白 ≡ 底留白、
 *   车-单间距恒 5。关键：块高用**实际内容跨度** (行数−1)×行距+图标尺寸，而非行距×行数的几何
 *   边界，否则图标与行距不等时会残留 1.5~3px 留白偏差（实测对称差由 3.0 → 0.0）。
 *   2026-09-24 15:27 —— **车位槽重构**（用户：卡车贴顶、不居中，可重构）：
 *   ① 纵向预算：带高 84→106、槽高 68→86（比例 0.92→0.728）—— 原尺寸下「卡车 34 + 3 行订单 40」
 *      超槽高，纵向必然有一端贴边；
 *   ② 布局模型改为「订单区贴槽底 + 卡车在上方剩余空间内居中」（唯一布局点 = syncNeeds，
 *      位置随行数动态算，构造函数只给初值）；加 TRUCK_VIS_DY 补偿卡车图形自身偏移；
 *   ③ 行距上限 16、订单区上限 40（3 行 13.33），字号分档不变。
 *   改 PARK_BAND_H 必须同步 GameView.PARK_H。核算：tools/check-slot-geom.cjs 全档 OK。
 *   2026-09-24 13:30 —— 槽内纵向预算重分配（用户：3 种订单字号再放大、不动槽高）：
 *   ① 卡车 40→34px、y 12→19 ⇒ 底缘抬到 +6.3，需求行可用区间由 28 扩到 38（+36%）；
 *   ② 需求行字号按订单种类数分档放大：1 种 15 / 2 种 13 / 3 种 11.5 / ≥4 种 9.5（两列），
 *      一个动物订单独占一行；行距按区间均分，任意行数都不越出区间；
 *   ③ 载货图标收为单排最多 3 只（原多排第 2 排起压进订单区，装车动画期与 have/need 重叠）。
 *   2026-09-24 —— 修「需求行整体错位」（上一版误按槽左上角换算，x 右移半槽宽、y 落到槽底下方 7px，
 *   需求行溢到下方围栏条）：needsHost 回槽中心 x=0、纵向居中于槽内订单区间。
 *   2026-09-19（二次）—— 锁位文案与广告角标接入 `AD_ENABLED` 总开关（关闭时零广告元素）。
 *   2026-09-19 —— 修复「广告未成交后锁定车位变死键」：锁位的 TOUCH_END 由
 *   `off + once` 改为「每次 render 统一 off、locked 时 on」。once 会在点击后立即解绑，
 *   而广告失败不会改变车位状态 ⇒ render 不重跑 ⇒ 绑定不再重建，车位永久点不动。
 *   2026-09-10 18:33 —— 锁位图标/广告角标接 IconArt（PNG sprite+矢量回退；
 *   白锁 PNG 用 tint 染回 #5a6a78）。2026-09-08 —— 需求行/载货动物图标改统一 animalIcon
 *   （矢量占位+sprite 切换）；2026-09-06 00:12:00 修复 SLOT_COLORS 误从 core/Constants
 *   导入（构建期 rollup MISSING_EXPORT，SLOT_COLORS 实际定义于 Draw2D.ts；交接文档 R1
 *   预言的 view 层问题之一）。 */
import { Graphics, Label, Node, Tween, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import { SLOT_TOTAL } from '../core/Constants';
import type { Animal, Slot } from '../core/Types';
import { col, colA, dashedRoundRect, drawLock, drawTruck, drawVideoBadge, LABEL_HIRES, makeLabel, newG, RADIUS, SLOT_COLORS } from './Draw2D';
import { animalIcon } from './AnimalArt';
import { ICON_PX, iconArt } from './IconArt';
import { place, placeC, placeCornerBadge, wipeChildren } from './Ui';
import { AD_ENABLED } from '../platform/AdConfig';   // 广告总开关：关闭时锁位不出现任何广告元素

/* 车位槽布局 token（2026-09-24 三次调整，用户：槽高维持 68；3 种订单改"第一排两组、第二排一组"）：
 * 布局模型 = **内容块整体居中**：内容块 = 卡车可视高 + GAP_TRUCK_NEED + 订单实际跨度，
 *   块在槽内垂直居中 ⇒ 顶部留白 ≡ 底部留白 = (槽高 − 块高)/2，且车-单间距恒为 GAP_TRUCK_NEED。
 * 排布规则（本版核心变化）：**≥3 种订单改 2 列换行**。槽高 68 的硬约束下，
 *   3 行纵向单列需 40px（卡车 22.8 + 5 + 40 = 67.8 ⇒ 留白 0.1，实为放不下）；
 *   而 2 列 2 行只需 26px（块高 53.8 ⇒ 上下各留 7.1）——正是用户提的"第一排两组、第二排一组"。
 *   代价是每组宽度减半（列宽 28），字号随之下调至 9.5（单列档可到 15/13）。
 * PARK_BAND_H 与 GameView.PARK_H 必须同值，否则布局断裂。 */
const PARK_BAND_H = 84;     // 公路带高（回到初版值：槽高 68 的上下各留 8）
const SLOT_RATIO = 0.92;    // 槽高 = 槽宽 / 该值 ⇒ 62.6/0.92 ≈ 68（用户指定：槽高维持 68）
const SLOT_PAD_TOP = 8;     // 槽顶距带顶（(84-68)/2，上下留白相等）
const TRUCK_PX = 34;        // 卡车显示尺寸
const TRUCK_K = TRUCK_PX / 64;
const TRUCK_VIS_LO = -24 * TRUCK_K;                    // 卡车图形可视底（64 空间 y∈[-24,19]，
const TRUCK_VIS_HI = 19 * TRUCK_K;                     //   图形中心并非节点中心，故居中需补偿）
const TRUCK_VIS_H = TRUCK_VIS_HI - TRUCK_VIS_LO;       // 可视高（≈22.8）
const TRUCK_VIS_DY = -(TRUCK_VIS_LO + TRUCK_VIS_HI) / 2;   // 可视中心相对节点中心的偏移补偿
const CARGO_DY = -5;        // 载货图标相对卡车中心的偏移（落在车厢上）
const GAP_TRUCK_NEED = 5;   // 卡车可视底缘 ↔ 订单区顶的间距（固定，用户要求"更近"）
const NEED_BAND_MAX = 36;   // 订单区最大高（2 列 3 行档：3 × 12）
const NEED_ROW_MAX = 16;    // 行距上限（1~2 行档用）
const NEED_GAP = 1;         // 「动物本体 ↔ 数字字形」的最小视觉间距（2026-09-26 由 2 收到 1；
                            //   22:41 起语义明确为**本体到字形**：位置由 syncNeeds 的 ANIMAL_PAD_R
                            //   把文本框左缘钉在「本体右缘 + NEED_GAP」，不再是"方框到方框"）

export class ParkView {
  readonly node: Node;
  private slots: Node[] = [];
  private bgG: Graphics[] = [];
  private decor: Node[] = [];
  private truckWrap: Node[] = [];
  private truckN: Node[] = [];      // 卡车节点（2026-09-24：位置改为随行数动态居中）
  private cargo: Node[] = [];
  private needsHost: Node[] = [];
  private prevStates: string[] = [];
  private sw = 62.6;
  private sh = 86;
  private baseX: number[] = [];

  constructor(parent: Node, left: number, top: number, w: number, private onUnlock: (i: number) => void) {
    const { node, g } = newG('park', w, PARK_BAND_H);
    this.node = node;
    // 公路带底色：上浅下深两段 + 顶部内高光
    g.roundRect(0, -PARK_BAND_H, w, PARK_BAND_H, RADIUS.panel);
    g.fillColor = col('#93a0b0');
    g.fill();
    g.roundRect(0, -PARK_BAND_H, w, PARK_BAND_H / 2, RADIUS.panel);
    g.fillColor = col('#7c8999');
    g.fill();
    g.roundRect(0, -2.5, w, 2.5, 0);
    g.fillColor = colA('#ffffff', 56);
    g.fill();
    const padX = 7, gap = 6;
    const sw = (w - padX * 2 - gap * 4) / 5;
    this.sw = sw;
    this.sh = sw / SLOT_RATIO;
    for (let i = 0; i < SLOT_TOTAL; i++) {
      const { node: sn, g: sg } = newG('slot' + i, sw, this.sh);
      this.baseX.push(padX + i * (sw + gap));
      place(sn, this.baseX[i], SLOT_PAD_TOP, sw, this.sh);
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
      // 2026-09-24（重构）：尺寸固定 34px，**位置不再写死** —— 由 syncNeeds 按订单行数算出
      //   「订单区之上的剩余空间」再垂直居中（宿命性的贴顶问题由此消除）。
      tn.setScale(TRUCK_PX / 64, TRUCK_PX / 64, 1);
      tn.setPosition(0, 0, 0);
      tw.addChild(tn);
      this.truckN.push(tn);
      const cg = new Node('cargo');
      // 2026-09-24（重构）：位置随卡车走（卡车中心 + CARGO_DY），落在车厢上；
      //   仍为**单排 ≤3 只**（见 syncCargo）—— 多排会压进订单区。
      placeC(cg, 0, CARGO_DY, sw - 10, 30);
      tw.addChild(cg);
      this.cargo.push(cg);
      const nd = new Node('needs');
      // 坐标系纪律（2026-09-24 修「需求行整体错位」的根因）：needsHost 挂在 truckWrap(tw) 下，
      //   **tw 原点是槽中心**（见上方 placeC(tw, sw/2, -sh/2)），故容器横向必须居中在 x=0。
      //   上一版误写 x=sw/2（整组右移半个槽宽）、y=-(sh)+27（落到槽底下方 7px）⇒ 需求行
      //   溢到下方围栏条上，即用户截图的错位。
      //   纵向：同样不写死 —— syncNeeds 按行数把订单区贴槽底摆放（高 = 行数 × 行距）。
      //   组内排布以 host 本地 0 为区间中心。
      placeC(nd, 0, 0, sw - 4, NEED_BAND_MAX);
      tw.addChild(nd);
      this.needsHost.push(nd);
    }
    place(node, left, top, w, PARK_BAND_H);
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
      // 2026-09-19 修复「广告未成交后车位变死键」：旧写法在 locked 分支用
      //   `off + once(TOUCH_END)`，点击即解绑；一旦广告没成交 → unlockSlot 不执行 →
      //   车位状态不变 → render 不重跑 → 绑定不再重建，该车位从此点不动。
      //   现在每次 render 统一 off、locked 时 on（常驻到下次 render），
      //   广告失败后无需依赖"状态变化触发重渲染"即可再次点击。
      this.decor[i].off(Node.EventType.TOUCH_END);
      this.truckWrap[i].active = s.state === 'truck' || s.state === 'loading' || s.state === 'leaving';
      if (s.state === 'locked') {
        this.resetSlot(i);
        g.roundRect(0, -this.sh, this.sw, this.sh, RADIUS.chip);
        g.fillColor = colA('#3a4452', 105);
        g.fill();
        dashedRoundRect(g, 0, -this.sh, this.sw, this.sh, 10, '#ffffff', 2, 6, 5);
        // 竖向堆叠，整体在槽内居中（2026-09-10 修"锁图标与文案没有间距"）：
        //   此前盒写死 y=-20（占 -11..-29）、文案写死 -sh/2-4 = -38（占 -26..-50）
        //   ⇒ **重叠 3px**，截图里锁和"看广告"直接贴在一起。
        //   改为按「盒 + 间距 + 两行文案」算总高再居中（见下方 top 计算，随 this.sh 自适应），
        //   盒与文案之间留出明确的 6px 间隙。
        // 2026-09-26（方案 B）：**去掉 18×18 白色锁盒**（用户审核通过）——原结构是
        //   灰底 + 白虚线框 + 白锁盒 + 锁图标 + 双行文案 + 角标共 5 层压在 62.6 宽的小格里，
        //   层次过叠。现锁图标（ICON_PX.slotLock 30 → 光学 24）直接落在灰色槽底上，
        //   层级由 5 → 3（灰底/虚线框 → 锁 → 文案），文案 9 → 10px 同步放大。
        const LOCK_PX = ICON_PX.slotLock, GAP_LOCK_TXT = 5, TXT_LH = 12.5, TXT_LINES = 2;
        const txtH = TXT_LH * TXT_LINES;
        const stack = LOCK_PX + GAP_LOCK_TXT + txtH;
        const top = (this.sh - stack) / 2;
        const lock = iconArt('lock', LOCK_PX, gg => drawLock(gg, '#ffffff'), 17, 12, 11.5);
        lock.setPosition(this.sw / 2, -(top + LOCK_PX / 2), 0);
        this.decor[i].addChild(lock);
        // 文案随广告开关切换（2026-09-19）：关闭时不得出现"看广告"字样，
        //   否则玩家会以为必须先看广告 —— 此时解锁是直接可用的（奖励照发）。
        const t = makeLabel(AD_ENABLED ? '看广告\n解锁车位' : '点击解锁\n车位', 10, '#ffffff', false);
        // 修：旧写法 t.lineHeight 挂在 makeLabel 包装对象上（Label 实际未收到，行高一直走默认），
        //   本次堆叠居中的 top 计算依赖真实行高 TXT_LH，故必须写 .label.lineHeight 并 ×LABEL_HIRES
        //   （2x 高清化：内部行距 ×2 + 节点 scale 0.5，外部显式赋值须同乘）。
        t.label.lineHeight = TXT_LH * LABEL_HIRES;
        placeC(t.node, this.sw / 2, -(top + LOCK_PX + GAP_LOCK_TXT + txtH / 2), this.sw - 4, txtH);
        this.decor[i].addChild(t.node);
        // 贴角不越界（2026-09-10）：此前写死 (sw-7,-7)，角标半宽 10.5 会戳出虚线框右/上边缘
        // 广告角标：开关关闭时不渲染（页面零广告元素）
        if (AD_ENABLED) {
          const badge = iconArt('video', ICON_PX.badge, drawVideoBadge, 38, 25, 32, undefined, 'adbadge');
          this.decor[i].addChild(badge);
          placeCornerBadge(badge, this.sw, ICON_PX.badge);
        }
        this.decor[i].on(Node.EventType.TOUCH_END, () => this.onUnlock(i));
        this.syncCargo(i, []);
        this.syncNeeds(i, null, fenceCnt, false);
        continue;
      }
      if (s.state === 'empty') {
        this.resetSlot(i);
        g.roundRect(0, -this.sh, this.sw, this.sh, RADIUS.chip);
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
      g.roundRect(0, -this.sh, this.sw, this.sh, RADIUS.chip);
      g.fillColor = colA('#ffffff', 240);
      g.fill();
      if (s.state === 'loading') {
        g.roundRect(-1.5, -this.sh - 1.5, this.sw + 3, this.sh + 3, RADIUS.chip + 1);
        g.strokeColor = colA('#58c06c', 120);
        g.lineWidth = 3;
        g.stroke();
      }
      g.roundRect(0, -this.sh, this.sw, this.sh, RADIUS.chip);
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
    // 2026-09-24：槽顶部偏移改用 SLOT_PAD_TOP —— 原硬编码 -8 与 place(…, 8, …) 是同一个值，
    //   重构后偏移改成 10，若仍用 -8 会把槽整体上移 2px（上下留白不对称）。三处（reset/arrive/leave）同步。
    sn.setPosition(this.baseX[i], -SLOT_PAD_TOP, 0);
    sn.setScale(1, 1, 1);
    const op = sn.getComponent(UIOpacity) ?? sn.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
  }

  /** 需求行：图标 + 缺口数（每行最多 2 组，整行居中；不足 2 组的行居中于槽）。
   * 槽内纵向布局（2026-09-24 三次调整，本函数是**唯一布局点**）：
   *   内容块 = 卡车可视高 + GAP_TRUCK_NEED + 订单实际跨度，**整块在槽内垂直居中**
   *   ⇒ 顶留白 ≡ 底留白，且车-单间距恒为 GAP_TRUCK_NEED（订单离底别太近、离车要近）。
   *   位置随订单行数动态计算（行数只有 render 时才知）；构造函数只给初值。载货容器随卡车（卡车中心 + CARGO_DY）。
   * 组内：host 本地 0 = 订单内容跨度中心，行组以 0 为中心上下排布。
   * 字号与排队分档（槽高 68 硬约束下；数值以代码为准，改档位须同步 tools/check-slot-geom.cjs）：
   *   1 组 → icon 20 / 16px（单列独占一行）
   *   2~4 组 → **icon 17 / 16px**（2 列网格：2 组同一行、3 组"第一排两组 + 第二排一组"、4 组 2×2）
   *   5~6 组 → icon 12 / 12px（末车大单，2 列 3 行）
   *   为什么 ≥2 组必须走 2 列：槽高 68 里卡车已占 22.8，2 组纵向排需 32 ⇒ 块高 59.8、留白 4.1；
   *     3 组纵向排需 40 ⇒ 块高 67.8、留白 0.1（实为放不下）。改 2 列后 2 组块高 40.8（留白 12.1）、
   *     3~4 组块高 53.8（留白 4.1）。
   *   横向宽度的杠杆有两条：① **计数长度**（单数字 vs 双数字，见下方"计数格式"注释）；
   *     ② **图标透明留白**（2026-09-26 二次收紧，见下方"组内横向"注释，ANIMAL_PAD_R）。
   *     注：横向"3 组并排"仍不可行（每组仅 17.5px 宽），故 3~6 组只能 2 列多行。
   * 行高收紧到 fs×1.05（默认 1.35 会让行间距不足、字形相贴）；文本开 Overflow.SHRINK
   *   兜底超宽计数，超宽自动缩小而非挤邻组。
   *
   * 2026-09-08 17:55 防御层：core 层 makeOrder 偶数化已修 items value ≥ 1，
   *   但本函数对 items 仍兜底过滤 need<=0 的项（@image#1 截图曾现 0/0），防无意义计数。 */
  private syncNeeds(i: number, order: Slot['order'], fenceCnt: Record<string, number>, loading: boolean): void {
    const host = this.needsHost[i];
    wipeChildren(host);
    const items: { id: string; have: number; need: number }[] = [];
    if (order) {
      for (const id in order.items) {
        const need = order.items[id];
        if (!need || need < 1) continue;
        items.push({ id, have: loading ? need : Math.min(fenceCnt[id] ?? 0, need), need });
      }
    }
    const n = items.length;
    const single = n <= 1;                                  // 仅 1 组时单列（独占一行，字号可放大到 15）
    const perRow = single ? 1 : 2;                          // ≥2 组：2 列网格 —— 2 组同一行、3 组"第一排两组 + 第二排一组"
    const rows = Math.max(1, Math.ceil(n / perRow));        // 无订单时按 1 行占位（locked/empty 槽的卡车位置）
    /* 计数格式（2026-09-26 方案 1，用户审核通过）：只显示「还差几只」（单数字）。
       为什么必须减字符：槽内可用宽 58.6 ⇒ 2 列时每组仅 27.8px；旧格式 "0/2" 占 3 字符
       （1.74×字号）使组宽达 28.5（**已超列宽 0.7px**，靠文字收缩勉强兜住）⇒ 图标/字号被顶死。

       分档重新配平（2026-09-26 23:37，用户："现在字体太大，动物太小"）：
       23:28 修好 contentSize 坐标系后字号终于按设计值渲染（16px 真实生效），随即暴露失衡 ——
       16px 数字字形高 ≈11.5，而 icon 17 的鸡本体只有 17×0.635 ≈ **10.8**（鸡是竖长条，水平
       填充率仅 0.447）⇒ **数字比动物还大**，抢走了主体。
       配平原则：**让动物本体高 ≈ 数字字形高 × 1.2~1.5**（动物是信息主体，数字是附注）。
       纵向预算（槽高 68 − 卡车 22.8 − 间距 5 = 40.2）按**行数**分配，故图标上限随行数收紧：
         rows=1（n≤2）余量最足 → icon 20~24；rows=2（n=3,4）需 2×icon ≤ 36 → icon ≤18；
         rows=3（n=5,6）需 3×icon ≤ 40 → icon ≤13（末车大单，只能保持 12）。
       横向复核（组宽 = 图标/2 + textL + 数字宽 ≤ 列宽 28）：单列档 27.9/58.6、n=2 档 24.3/28、
       n=3,4 档 22.8/28、n=5,6 档 16.5/28 —— 全部有余量。
       注：n=2 与 n=3,4 同为 fs 14，但图标不同（20 vs 18）—— 因为 n=2 只占 1 行、纵向余量更多，
       icon 由**行数**而非组数决定。 */
    const iconPx = n <= 1 ? 24 : n <= 2 ? 20 : n <= 4 ? 18 : 12;
    // 2026-09-27 00:01（用户："数字可以再调小一点"）：字号整体再降 2（15/14/14/11 → 13/12/12/10），
    //   **图标不动** —— 上一轮已把动物立为主体，本轮继续弱化附注（数字）一侧即可。
    //   配平比（鸡本体高 ÷ 数字字形高）：n≤1 1.62 / n≤2 1.48 / n=3,4 1.33 / n≥5 1.06（全部 ≥1）。
    //   横向连带收益：digitW = 0.58×fs 同步变小 ⇒ 组宽变窄、列内余量增加（见 check-slot-geom 输出）。
    const fs = n <= 1 ? 13 : n <= 4 ? 12 : 10;
    // 行距：按订单区上限均分，且不得小于图标（否则相邻行图标会叠在一起）
    const rowH = Math.max(iconPx, Math.min(NEED_ROW_MAX, NEED_BAND_MAX / rows));
    /* ---------- 槽内纵向布局：内容块（卡车 ─ 间距 ─ 订单区）整体居中 ---------- */
    /* 块高必须用**实际内容跨度**而非订单区几何边界（行距 × 行数）：图标常大于/小于行距
       （单行 icon 19 > 行距 16、两列 icon 10 < 行距 16），用几何边界算会残留 1.5~3px 的
       上下留白偏差。实际跨度 = (行数−1) × 行距 + 图标尺寸。 */
    const needSpan = (rows - 1) * rowH + iconPx;
    const blockH = TRUCK_VIS_H + GAP_TRUCK_NEED + needSpan;
    const pad = (this.sh - blockH) / 2;                     // 上下留白（相等 = 视觉居中）
    const blockTop = this.sh / 2 - pad;                     // 块顶（槽坐标系，原点=槽中心）
    const needTop = blockTop - TRUCK_VIS_H - GAP_TRUCK_NEED;
    host.setPosition(0, needTop - needSpan / 2, 0);         // host 本地 0 = 订单内容跨度中心
    const truckCy = blockTop - TRUCK_VIS_H / 2 + TRUCK_VIS_DY;   // 卡车**可视**中心
    this.truckN[i].setPosition(0, truckCy, 0);
    this.cargo[i].setPosition(0, truckCy + CARGO_DY, 0);
    if (n === 0) return;
    /* 组内横向：图标在左、计数在右。
       单列（1 组）时把"图标 + 计数"当作紧凑组整体居中；两列时按列宽分布（图标贴列左、计数贴列右）。
       计数框按**一位数**写定位置、宽度只给"列内剩余"⇒ 出现两位数（如 "12"）时由 SHRINK 自动缩字，
       绝不溢出列（旧写法框宽 18 > 列内剩余，两位数会顶到相邻组）。

       间距收紧（2026-09-26 二次，用户："肉眼观感上动物和数字还有一定距离"）：
       视觉间距 = 「图标方框 → 动物本体」的透明留白 + NEED_GAP + 数字居中漂移。三项叠加才是真凶：
       ① 留白：动物走 animalIcon 的 sprite 层，PNG（process-animal-art.cjs 输出，**不裁透明边**）
          512×512 里动物只占水平 W∈[0.443,0.607]（实测 alpha 包围盒：左右边距 R∈[0.195,0.279]）
          ⇒ 方框右缘到本体右缘空出 iconPx×R，iconPx=17 时达 3.4~4.7px（**这一项此前被严重低估**，
          旧注释按 icons 归一化的 0.8 填充率估成 1.7px）；
       ② NEED_GAP = 1（框到框）；
       ③ 漂移：计数框宽 > 字形宽且 Label 居中，窄数字 "1"（实际宽仅 ~0.30em）比 "0" 右漂 2.6px。
       合计 5.1~7.7px（设计单位）——正是截图里"隔得远"的来源。
       解法：按 ANIMAL_PAD_R 反推文本框左缘 = **本体右缘 + NEED_GAP**，并把计数改**左对齐**
       （Panels.sub 已有先例），使间距恒为 NEED_GAP、与数字宽窄无关。
       ANIMAL_PAD_R 的取值权衡：0.20 = 最宽动物 cow（R=0.195）上浮出的"零间隙线"，可保证任何
       物种都不与数字相碰（代价：鸡/鸭 R=0.277 多留 ≈1.4px）。2026-09-26 23:01 用户要求再收紧
       一档，取 0.24 —— 已越过该零间隙线，风险标注见下方常量处。 */
    const DIGIT_K = 0.58;                                   // 单个数字宽 ≈ 0.58em（与 estTextW 同口径）
    const ANIMAL_PAD_R = 0.24;                              // 动物 PNG 右缘留白率（实测 R∈[0.195,0.279]）
    // ⚠️ 0.24 已越过最宽动物 cow（R=0.195）的"零间隙线"0.20：cow 的间距只剩 0.24px，靠字形
    //   左侧 side bearing（≈0.06em ≈ 1px）才不至于视觉相碰。若真机看到 cow 订单数字贴住牛身，
    //   回调到 0.22；鸡/鸭/羊/兔（R=0.215~0.279）在此值下仍有 0.9~2.2px 间距，不受影响。
    const colW = 28;
    const digitW = DIGIT_K * fs;
    const textL = iconPx / 2 - iconPx * ANIMAL_PAD_R + NEED_GAP;   // 文本框左缘（相对图标中心）
    // 紧凑组宽 = 「图标方框左缘 → 数字右缘」。含图标内部留白（方框右半的透明区不占位）。
    // 修（2026-09-26 23:28）：原式 `iconPx + textL + digitW` 把方框**全宽**当占位，比实际宽出
    //   iconPx/2 ⇒ 单列档（唯一用 groupW 的档位）整组左移 iconPx/4 = 5px，视觉重心偏左。
    const groupW = iconPx / 2 + textL + digitW;
    const iconDX = single ? -(groupW / 2) + iconPx / 2 : -(colW / 2) + iconPx / 2;
    const textLeftRel = iconDX + textL;                     // 文本框左缘（相对行中心 / 列中心）
    const textW = single ? digitW * 2 : colW / 2 - textLeftRel - 1;   // 宽度只作 SHRINK 兜底
    const textDX = textLeftRel + textW / 2;                 // placeC 用中心锚点，故转回中心
    const yTop = (rows - 1) * rowH / 2;                     // 顶行中心（订单区中心 = host 本地 0）
    items.forEach((it, k) => {
      const row = Math.floor(k / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const x = single || inRow === 1
        ? 0
        : -(inRow * colW) / 2 + (k % perRow) * colW + colW / 2;  // 该组中心（整行居中）
      const y = yTop - row * rowH;
      const icon = animalIcon('need', iconPx, it.id);
      icon.setPosition(x + iconDX, y, 0);
      host.addChild(icon);
      // 计数 = 还差几只（方案 1：玩家一眼看到缺口，无需自己算差值；满足时 = 0 且转绿）
      const lack = Math.max(0, it.need - it.have);
      const t = makeLabel(String(lack), fs, lack <= 0 ? '#2f9e4f' : '#5a6a78');
      t.label.lineHeight = Math.round(fs * 1.05) * LABEL_HIRES;   // 紧凑行高（×HIRES 抵消节点 0.5 缩放）
      t.label.overflow = Label.Overflow.SHRINK;
      t.label.enableWrapText = false;
      // 左对齐（2026-09-26）：文本框按「本体右缘 + NEED_GAP」定位，若仍居中则窄数字 "1" 会右漂
      //   2.6px、胖数字 "0" 几乎不漂 ⇒ 同一排各组的间距忽大忽小。左对齐后字形恒贴框左缘，
      //   间距只由 textL 决定，与数字宽窄解耦（SHRINK 仍兜底两位数）。
      t.label.horizontalAlign = Label.HorizontalAlign.LEFT;
      /* contentSize 必须 ×LABEL_HIRES（2026-09-26 23:28 —— **"数字怎么调都显小"的真根因**）：
         makeLabel 是 2x 高清化 —— Label 的 fontSize/lineHeight 都 ×2、节点 scale = 0.5，故
         **Label 工作在 2 倍本地坐标系里**；而 placeC 的 contentSize 也是节点本地单位，直接传
         设计单位会让它只有视觉值的一半。后果（SHRINK 模式下）：
           文本本地宽 = fs×2×0.58 = 18.56 vs contentSize 本地宽 = textW = 13.08 → 判为超框
           文本本地高 = lineHeight = 34        vs contentSize 本地高 = rowH = 17    → 也超框
           ⇒ 缩放比 = min(13.08/18.56, 17/34) = **0.5** ⇒ 实际字号只有 **8**（名义 16）！
         这就是此前"字号一路从 9.5 加到 16 仍显小"的原因：加的是名义值，渲染始终被砍半。
         实测佐证（用户截图像素反推）：数字字形高 5.8 设计单位 = 16 × 0.5 × 0.72 ✓ 恰好一半。
         同时左对齐也失效 —— 框只有规定宽度的一半，"框左缘"自然落错位置，间距被撑大到 4.9px。
         修法：contentSize 与 Label 同坐标系 ⇒ 两维都 ×LABEL_HIRES。修后 SHRINK 比 = min(1.41, 1.0)
         = 1（单数字不缩，字号回到真正的 16），两位数的兜底缩字仍有效（37.12/26.16 = 0.70）。
         注：全工程仅此处用了 Overflow.SHRINK，其余 Label 均为默认 NONE（**忽略 contentSize 按原文
         渲染**），故不受此坐标系问题影响 —— 这也是为什么按钮/面板文字一直显示正常。 */
      placeC(t.node, x + textDX, y, textW * LABEL_HIRES, rowH * LABEL_HIRES);
      host.addChild(t.node);
    });
  }

  /** cargo 载货池：按 uid diff，新增弹跳（cargoPop）。
   * 2026-09-24（二次）：**单排最多 3 只**（原为 3 列多排，第 2 排起就压进下方订单区，
   *   装车动画期与 have/need 文字重叠）。槽内纵向预算已全部让给订单文字，装载进度本身
   *   由 have/need 精确表达，图标只作"车上有货"的示意；超出 3 只不再渲染。 */
  private syncCargo(i: number, loaded: Animal[]): void {
    const host = this.cargo[i];
    const seen = new Set<number>();
    const SHOWN = 3;
    loaded.forEach((a, k) => {
      seen.add(a.uid);
      if (k >= SHOWN) return;              // 超出显示上限：不新建（进度由 have/need 表达）
      let child: Node | null = null;
      for (const c of host.children) if (c.name === 'c' + a.uid) { child = c; break; }
      if (!child) {
        child = animalIcon('c' + a.uid, 14, a.type.id, a.rare);
        child.setPosition(-15 + k * 15, 0, 0);   // 单排 3 列、居中于车厢（跨 -22..22）
        const final = 14 / 64;
        child.setScale(final * 0.25, final * 0.25, 1);
        tween(child).to(0.3, { scale: new Vec3(final, final, 1) }, { easing: 'backOut' }).start();
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
    sn.setPosition(this.baseX[i] + this.sw * 1.5, -SLOT_PAD_TOP, 0);
    tween(sn).to(0.38, { position: new Vec3(this.baseX[i], -SLOT_PAD_TOP, 0) }, { easing: 'backOut' }).start();
  }

  /** 驶离：向左 -170% 冲出 + 淡出（truckOut） */
  playLeave(i: number): void {
    const sn = this.slots[i];
    Tween.stopAllByTarget(sn);
    const op = sn.getComponent(UIOpacity) ?? sn.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
    tween(sn)
      .to(0.34, { position: new Vec3(this.baseX[i] - this.sw * 1.7, -SLOT_PAD_TOP, 0) }, { easing: 'quadIn' })
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
