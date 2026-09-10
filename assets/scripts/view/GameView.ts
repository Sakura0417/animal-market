/* ============================================================
 * GameView（VIEW 总控 · A1）——《动物集市》Cocos 移植的对局组装层
 * 修改时间：2026-09-10 21:41 —— ① 吊车取消"首次免费"，改为每次使用都看激励视频（与翻转/洗牌
 *   同构，craneUsed 字段退役）；② failFence 面板接线由 4 出口收为 2（放生看广告 / 重开）；
 *   ③ failHp 复活提示语改"恢复 1 颗"（core REVIVE_HP 配套）。
 *   2026-09-10 18:33（① 暂停链路清退：HUD 暂停钮 + showPause + Panels.pause；
 *   ② start 预热 preloadIcons。上次：2026-09-09 23:35 P1.5 紧密化 view 适配：① moveTo 出栏三级回落——干净走廊直走 →
 *   BFS 沿空格寻路穿缝隙出栏 → 弧线仅理论极限兜底，根治"漂移感"；② 接触距离改
 *   格距−精灵宽常量公式，coreRadiusPx/R 投影换算退役；头部注释见 core/Board.ts P1.5 条目；
 * 2026-09-10 19:52（取消绕行机制：出栏恒为沿自身朝向直走，pickExitDir/findExitPath 已删）；
 *   2026-09-09 22:30（穿透修复迭代 2：就近绕行替代弧线兜底；
 *   21:25 穿透修复：出栏走廊占用则回落弧线飞出 + 并发入栏车道错位；
 *   20:50 输入锁收窄：装车/发车动画期不再锁动物入栏 + busy 簿记与代数解耦 + 隐藏发车 toast）
 * （初版 2026-09-05 23:47:00；历次修复/迭代均以时间戳注明在各方法内注释：
 *   00:26 布局锚点 column 化；01:24 关卡牌刷新；02:15 碰撞真实接触；
 *   02:20 走出牧场入栏；09:30 土路/看门狗/难度外环；10:05 土路加宽 + 沿路行走；
 *   10:40 农场缩小居中/土路完整可见；10:45 土路宽度减半；
 *   21:10 P5 三小项：C3 星级（复活封顶 1 星 + saveBestStar）/ C4 生命耗尽全场压暗 0.5s /
 *   C5 复活上限 2 次（canRevive 接线 + 复活路径恢复亮度）；
 *   22:25 D2 接触距离参数常量化：碰撞分支 5 个内联字面值收编为 Constants CONTACT_*，兜底 26→21（PRD 2.0 D2 拍板值）；
 *   23:00 需求3 围栏满载判定重做：failTick 终局裁决（isFenceHopeless=false → 装车放行续局）+
 *   failwait 期间落地重裁决 + reconcile 尾部仍满载 re-arm；修复并发行走落地凑齐订单被误判挤爆的真 bug。）
 * ------------------------------------------------------------
 * 职责（交接文档行动项 A1，移植基准 = animal-market-prototype/game.js V4.1）：
 *   1. 设计空间：375 宽设计单位等比缩放铺满屏幕（Ui.ts 布局纪律的宿主，
 *      高瘦屏把多余高度让给牧场，宽扁屏钳制缩放保下限 375×667）；
 *   2. 装配 8 个子视图组件 + Toast，桥接 GameSession ↔ view（本层只接线不碰数值）；
 *   3. 移植 game.js 全部控制流（逐段对照）：
 *      - 触摸路由 takeAnimal：动物点击 → core 判定 → 飞入围栏 / 碰撞弹回扣心 / 吊车吊走
 *      - 装车链 reconcile → findMatch → fulfillSlot（逐只飞上卡车）→ departSlot（发车补车）
 *      - 失败链：围栏挤爆（failwait → failFence）/ 生命耗尽（failHP）/ 死局（noStockEnd）
 *      - 胜利链：isWin → 彩带雨 + 大飘字 + win 面板（翻倍广告 → 下一关/再玩）
 *      - 救援链：吊车（每局首次免费）→ 翻转 → 洗牌，全部挂广告点位
 *      - 车位解锁：锁定车位点击 → 广告 → unlockSlot
 *   4. 广告：AdService 注入 Panels.ad 演示层（dev/浏览器）；wx 真机由 PlatformAdapter 承担。
 * 纪律：
 *   - 动画代数 fxGen 与原型一致：重开局 +1，旧代 scheduleOnce 回调一律作废；
 *     同时用 unscheduleAllCallbacks 双保险清掉挂起计时（crane/fail/装车链）。
 *   - busy 锁（2026-09-09 收窄）：只串行化**装车/发车链**（reconcile:502 门控），
 *     不再锁动物入栏（takeAnimal/moveTo 已去 busy 门）。原因：装车动画 1.5-2.5s 期间静默吞掉
 *     全部点击且无反馈（用户报"点击无响应 + 提示期间点不动"）；入栏容量由 FENCE_MAX 门承担，
 *     core 数据先行 + reconcile 幂等（guard 25）保证并发安全。
 *   - busy 簿记与代数解耦（同 walks 硬化）：busy-- 必须先于 fxGen 判定执行，且只做一次。
 *   - coinsShown：HUD 金币数字等 flyCoin 飞达才更新（入账爽感，原型同款）。
 * 布局（原型 game.html + styles.css 换算，375 设计宽；列宽 351 = 375 - 12*2）：
 *   padding 6/12/12 ｜ HUD(34)+10 ｜ park(84)+8 ｜ fence(40)+10 ｜ pen(flex:1)+10 ｜ tools(54)
 * ============================================================ */
import { _decorator, Component, Node, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { GameSession } from '../core/GameSession';

import { CONTACT_DIST, CONTACT_FLOOR, CONTACT_TRAVEL_MAX, CONTACT_TRAVEL_MIN, CONTACT_TRAVEL_SPEED, FENCE_MAX, SLOT_TOTAL, TYPES, WALK_LANE_GAP } from '../core/Constants';
import type { Animal, Dir, Match } from '../core/Types';
import { AdService } from '../services/AdService';
import { LastResult, SaveService } from '../services/SaveService';
import { col, dashedRoundRect, newG } from './Draw2D';
import { FenceView } from './FenceView';
import { FxService } from './FxService';
import { HudView } from './HudView';
import { preloadIcons } from './IconArt';
import { preloadAnimalArt } from './AnimalArt';
import { Panels } from './Panels';
import { ParkView } from './ParkView';
import { PenView } from './PenView';
import { place, Toast } from './Ui';   // place：土路容器定位（2026-09-06 09:40 漏导入致 buildLayout 中断）
import { ToolsBar } from './ToolsBar';
import { track } from '../services/TrackService';   // T8 埋点（2026-09-07）：仅 view 层调用，core 零污染

const { ccclass } = _decorator;

/* 设计画布基准（原型 phone 375×667；本文件所有布局常量单位 = 设计像素） */
const DESIGN_W = 375;
const DESIGN_H_MIN = 667;
const COL_PAD = 12;          // game-root 左右留白
const HUD_TOP = 6;           // 顶部留白
const HUD_H = 34;            // d-iconbtn 高
const GAP_HUD_PARK = 10;     // d-hud margin-bottom
const PARK_H = 84;           // d-park（ParkView 内部固定 84）
const GAP_PARK_FENCE = 8;    // d-park margin-bottom
const FENCE_H = 40;          // d-fence 槽位 ≈ (351-34-8-30)/7 ≈ 39.86
const GAP_FENCE_PEN = 10;    // d-fencebar margin-bottom
const GAP_PEN_TOOLS = 10;    // d-pen margin-bottom
const TOOLS_H = 54;          // d-tool 高
const PAD_BOTTOM = 12;       // game-root 底部留白

/** 构建版本戳（2026-09-07）：startGame 打印，用于鉴别"预览跑的是不是当前磁盘代码"
 *  （截图取证发现预览滞留旧 bundle 导致修复"看似无效"）。上线前可整体删除。 */
const BUILD_TAG = 'planA-20260907b';
/** 看门狗诊断探针开关：每 1.5s 打印 phase/busy/walks/fence/panel，用于定位卡点。
 *  判修完成后改 false 即静默（保留设施，下次排查再开）。 */
const DEBUG_PROBE = true;

@ccclass('GameView')
export class GameView extends Component {

  /* ---------- 对局会话与子系统（core 是数值唯一来源） ---------- */
  private session = new GameSession();
  private ad = new AdService();
  private hud!: HudView;
  private park!: ParkView;
  private fence!: FenceView;
  private pen!: PenView;
  private tools!: ToolsBar;
  private fx!: FxService;
  private panels!: Panels;
  private toast!: Toast;

  /* ---------- 控制流状态（与 game.js 顶部 state 一一对应） ---------- */
  private level = 1;
  private busy = 0;                    // 链式动画锁（装车/发车/碰撞等，>0 锁输入）
  private walks = 0;                   // 在途入栏行走数（2026-09-06 14:05 并发点击改造：
                                       //   行走期间不锁输入，可继续点下一只动物）
  private walkingUids = new Set<number>(); // 在途动物 uid（围栏条隐藏其落格显示，防"分身"）
  private fxGen = 0;                   // 动画代数：重开局 +1，旧代回调作废
  private craneMode = false;           // 吊车瞄准模式
  private doubled = false;             // 营收翻倍（win 面板广告点位）
  private coinsShown = 0;              // HUD 显示金币（等 flyCoin 飞达才追平 session.coins）
  private lostHeartIdx = -1;           // 刚失去的心 index（心碎动画一次性标记）
  private firstRun = true;             // 本次启动是否弹「开局须知」（重开/下一关不弹）
  private booted = false;              // start 的素材预加载是否已完成（onDestroy 前置守卫）
  private design!: Node;               // 设计空间宿主（DW×DH，等比缩放）
  private roadBand = 13.25;            // 土路中心线距牧场边界的偏移（buildLayout 内赋值）

  /* ---------- 计时器回调（具名以便 unschedule；原型 craneTimer / failTimer） ---------- */
  /** 吊车 8 秒瞄准超时：全场仍互锁则续时，否则退出瞄准（原型 armCrane 的 craneTimer） */
  private craneTick = (): void => {
    if (this.session.canPlay() && this.session.allLocked()) {
      this.armCrane(true);
      return;
    }
    this.craneMode = false;
    this.renderTools();
    this.renderPen();
  };
  /** 围栏满载终局裁决（需求 3，2026-09-06 23:00 重做）：0.5s 缓冲到期后——
   *  ① 缓冲期内已被装车链消化（< 满载）→ 回 play 继续对局；
   *  ② 仍满载但存在可满足的在途订单（core isFenceHopeless=false）→ 回 play + 装车放行；
   *  ③ 确实无可满足订单 → 才弹挤爆失败面板。
   *  旧实现无裁决直接弹面板，并发行走落地凑齐订单时会被误判失败（真 bug）。 */
  private failTick = (): void => {
    const s = this.session;
    if (s.phase !== 'failwait') return;
    if (!s.isFenceHopeless()) {
      s.markOutcome('play');
      this.reconcile();                          // 装车放行 / 补车 / 死局判定统一走调和链
      return;
    }
    this.failFence();
  };
  /** 空闲看门狗（2026-09-06 09:30:00）：对局中且无动画时每 1.5s 调和一次。
   * 兜底任何因回调时序丢失导致的车位空置/死单滞留——保证牧场里还有动物就一定
   * 会有车可接（reconcile 幂等：无事可做时空转）。 */
  private watchdogTick = (): void => {
    const s = this.session;
    if (DEBUG_PROBE) {
      // 诊断探针（2026-09-07）：卡点四要素一次看全——phase 停 failwait=裁决链断、
      // busy>0=装车动画链泄漏、fence>7=超载通道未堵、panel=true=看门狗被面板压住
      console.log('[probe]', 'build=' + BUILD_TAG, 'phase=' + s.phase, 'busy=' + this.busy,
        'walks=' + this.walks, 'fence=' + s.fence.length + '/' + FENCE_MAX, 'panel=' + this.panels.node.active);
    }
    if (s.canPlay() && this.busy === 0 && !this.panels.node.active) this.reconcile();
  };

  /* ============================================================
   * 生命周期与装配
   * ============================================================ */

  /** 首屏装配（2026-09-10 改造）：**先把素材备齐再 buildLayout**。
   *  原因：动物/图标都是「异步加载 + 矢量占位回退」的双层结构，若先搭 UI 再等素材，
   *  进场必然先渲染一帧矢量占位再跳成图片（用户截图反馈"先加载之前的图标，再加载动物资源"）。
   *  预加载走的是 resources 本地资源（6 张动物图 + 8 张图标，总计约 300KB），耗时约 1 帧；
   *  预加载完成后各素材 cache 命中，回调同步执行 ⇒ 首帧即最终形态，无闪烁。 */
  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      let left = 2;
      const done = (): void => { if (--left === 0) resolve(); };
      preloadAnimalArt(done);
      preloadIcons(done);
    });
    if (!this.node || !this.node.isValid) return;   // 加载期间节点已销毁（切场景/热重载）
    this.booted = true;
    this.level = SaveService.loadLevel();   // 续档：从存档关卡进入对局
    this.buildLayout();
    // dev/浏览器：把 Panels 的 3 秒演示广告层注入 AdService（wx 真机自动切换真实广告）
    this.ad.registerDevDisplay((onDone) => this.panels.ad(onDone));
    this.schedule(this.watchdogTick, 1.5);   // 空闲看门狗：保证车辆永远自动补齐
    this.startGame();
  }

  onDestroy(): void {
    if (!this.booted) return;               // start 的 await 还没回来 → 子系统尚未创建，别碰
    this.panels.adCancel();                 // 清掉演示广告的 setTimeout
    this.unscheduleAllCallbacks();
  }

  /** 搭建设计空间与全部子视图（唯一一处涉及屏幕尺寸换算的地方） */
  private buildLayout(): void {
    const vis = view.getVisibleSize();
    // 等比缩放：宽与高取小者，保证 375×667 内容完整可见（Ui.ts 约定：GameView 负责缩放）
    const s = Math.min(vis.width / DESIGN_W, vis.height / DESIGN_H_MIN);
    const dw = vis.width / s;
    const dh = vis.height / s;
    const design = new Node('design');
    design.addComponent(UITransform).setContentSize(dw, dh);   // 锚点默认 (0.5,0.5) 居中
    design.setScale(s, s, 1);
    this.node.addChild(design);
    this.design = design;

    // 屏幕底色：4 段渐变近似原型 .screen--game（linear-gradient 180deg #97d68d→#82ca7b→#6cbf6e）
    const bg = newG('bg', dw, dh);
    const bands: [string, number, number][] = [
      ['#97d68d', 0, 0.28], ['#8bcf80', 0.28, 0.55], ['#82ca7b', 0.55, 0.78], ['#6cbf6e', 0.78, 1]
    ];
    bands.forEach(([hex, t0, t1]) => {
      bg.g.fillColor = col(hex);
      bg.g.rect(-dw / 2, -dh / 2 + dh * (1 - t1), dw, dh * (t1 - t0) + 0.7); // 自上而下铺色带
      bg.g.fill();
    });
    design.addChild(bg.node);

    // 布局列容器：锚点(0,1)=左上（Ui.place 的容器纪律：子节点 place(l,t) → position(l,-t)），
    // 定位到屏幕左上角；Hud/Park/Fence/Tools/Pen 全部挂这层。
    // （2026-09-06 00:26:00 修复：此前 5 个布局组件直接挂中心锚点的 design，
    //   place 坐标从屏幕中心起算，内容整体错位到右下象限——预览冒烟发现，R1 类问题。）
    const column = new Node('column');
    const colUt = column.addComponent(UITransform);
    colUt.setAnchorPoint(0, 1);
    colUt.setContentSize(dw, dh);
    column.setPosition(-dw / 2, dh / 2, 0);
    design.addChild(column);

    // 内容列左缘：宽扁屏（dw>375）时 375 列居中，两侧用底色补齐
    const colX = (dw - DESIGN_W) / 2 + COL_PAD;

    // 顶部 HUD（重开/关卡牌/生命/进度/金币）—— 暂停钮已移除（无实际功能）
    this.hud = new HudView(column, colX, HUD_TOP, DESIGN_W - COL_PAD * 2, {
      onRestart: () => this.requestRestart(),
    });
    // 停车位公路带（锁定车位点击 → 广告解锁）
    const parkTop = HUD_TOP + HUD_H + GAP_HUD_PARK;                     // 50
    this.park = new ParkView(column, colX, parkTop, DESIGN_W - COL_PAD * 2, (i) => this.unlockSlot(i));
    // 围栏 7 格条
    const fenceTop = parkTop + PARK_H + GAP_PARK_FENCE;                 // 142
    this.fence = new FenceView(column, colX, fenceTop, DESIGN_W - COL_PAD * 2, FENCE_H);
    // 底部道具栏（吊车/翻转/洗牌）
    const toolsTop = dh - PAD_BOTTOM - TOOLS_H;
    this.tools = new ToolsBar(column, colX, toolsTop, DESIGN_W - COL_PAD * 2, {
      onCrane: () => this.enterCraneMode(),
      onFlip: () => this.useFlip(),
      onShuf: () => this.useShuffle(),
    });
    // 牧场散落区（2026-09-06 10:45 调整）：农场缩小并居中，四周让出土路带 + 6px 草地
    // 边距——土路四边等宽且完整落在屏幕内，也不再顶到围栏（围栏与路带间留草地缝隙）。
    const ROAD_W = 26.5;                                 // 土路带宽（2026-09-06 10:45 改为原 53 的一半）
    const roadOut = ROAD_W + 6;                          // 牧场每侧让出：路带 + 草缝
    const penW = DESIGN_W - COL_PAD * 2 - roadOut * 2;   // 351 - 65 = 286
    const penLeft = COL_PAD + roadOut;                   // 44.25（列内居中）
    const penTop = fenceTop + FENCE_H + GAP_FENCE_PEN + roadOut;              // ≈224.5
    const penH = toolsTop - GAP_PEN_TOOLS - roadOut - penTop;                 // ≈478

    // 农村土路：环带贴牧场边界向外铺满 ROAD_W（中心线在边界外 半宽），
    // 画在 pen 之下（内半圈被草地盖住），动物走出牧场即落在路中央。
    const roadO = ROAD_W / 2;
    this.roadBand = roadO;   // 记录实际路带偏移，供 moveTo 生成沿路路径（10:55 修复 ROAD_W 局部变量越界引用）
    const road = newG('road', penW, penH);
    road.g.lineWidth = ROAD_W;
    road.g.strokeColor = col('#d8bd8f');
    road.g.roundRect(-roadO, -penH - roadO, penW + ROAD_W, penH + ROAD_W, 24 + roadO);
    road.g.stroke();
    dashedRoundRect(road.g, -roadO, -penH - roadO, penW + ROAD_W, penH + ROAD_W, 24 + roadO, '#a9834f', 1.5, 5, 4); // 车辙虚线
    place(road.node, penLeft, penTop, penW, penH);
    column.addChild(road.node);
    // 土路 z 序在围栏/工具之下：hud(0) → park(1) → road(2) → fence(3) → tools(4) → pen(5)
    road.node.setSiblingIndex(2);

    this.pen = new PenView(column, penLeft, penTop, penW, penH, (uid) => this.takeAnimal(uid));

    // 覆盖层按 z 序自下而上：toast → 面板 → 特效（原型 fxLayer 压在 modal 之上，彩带盖住面板）
    this.toast = new Toast(design, dw, dh);
    this.panels = new Panels(design, dw, dh);
    this.fx = new FxService(design, dw, dh);
  }

  /* ============================================================
   * 开局 / 重开（原型 resetGame）
   * ============================================================ */

  private startGame(): void {
    const s = this.session;
    // 作废旧代：挂起计时全部取消 + 代数 +1（旧代 fly/flyCoin 回调由 FxService 自灭）
    this.unscheduleAllCallbacks();
    this.fxGen++;
    this.fx.reset();
    this.busy = 0;
    this.walks = 0;
    this.walkingUids.clear();
    this.craneMode = false;
    this.doubled = false;
    this.coinsShown = 0;
    this.lostHeartIdx = -1;
    this.undimBoard();            // C4（2026-09-06 21:10）：重开时恢复全场亮度
    this.pen.clear();
    this.panels.hide();
    this.panels.adCancel();

    s.start(this.level);          // core：重置全部状态 + 散点生成 + tryDispatch 补车
    track({ event: 'level_start', level: s.level });   // T8 埋点（2026-09-07）：最小 5 事件集
    console.log('[GameView] startGame build=' + BUILD_TAG + ' level=' + s.level);   // 版本戳：鉴别预览是否最新构建
    this.hud.setLevel(s.level);   // 关卡牌（原型按页加载设关卡号；Cocos 连续会话需每次开局刷新）
    this.renderAll();
    if (this.firstRun) {
      // 开局须知仅本次启动展示（原型 firstRun 语义；下一关/重开不重复打扰）
      this.firstRun = false;
      s.markOutcome('intro');
      this.panels.intro(() => {
        s.markOutcome('play');
        this.panels.hide();
      });
    }
  }

  /* ============================================================
   * 渲染门面（原型 renderAll / renderHUD / renderTools…）
   * ============================================================ */

  private renderAll(hideUid = -1): void {
    this.renderPark();
    this.renderFence(hideUid);
    this.renderPen();
    this.renderHud();
    this.renderTools();
  }

  private renderPark(): void {
    const s = this.session;
    // 空车位自愈兜底（2026-09-10）：tryDispatch 幂等（非 empty 槽直接跳过），play 态下
    // 只要存在空车位就尝试补车。正常链路（start/unlockSlot/settleSlot→tryDispatch）已覆盖
    // 绝大多数场景；此处兜住"makeOrder 概率性采样失败后无调用点重试"的窗口——任何后续
    // 渲染时机（点动物/装车/动画回调）都会自然重试，偏向采样是概率性的，多试必成功；
    // 真供给不足（全场每种 avail≤1，终局形态）时 makeOrder 返回 null，槽保持空属合理。
    if (s.canPlay() && s.slots.some(sl => sl.state === 'empty')) s.tryDispatch();
    this.park.render(s.slots, s.fenceCount());
  }

  /** 围栏条：needs = 在场订单的需求类型集合（匹配高亮）；隐藏集 = 在途动物 ∪ 显式 uid */
  private renderFence(hideUid = -1): void {
    const needs = new Set<string>();
    this.session.activeOrders().forEach((sl) => {
      if (!sl.order) return;
      for (const id in sl.order.items) needs.add(id);
    });
    const hide = new Set(this.walkingUids);
    if (hideUid >= 0) hide.add(hideUid);
    this.fence.render(this.session.fence, needs, hide);
  }

  private renderPen(): void {
    this.pen.render(this.session.herd, this.craneMode);
  }

  /** HUD：进度 = 牧场剩余 + 围栏存货（原型 progEl 口径）；渲染后清掉心碎标记 */
  private renderHud(): void {
    const s = this.session;
    this.hud.render(s.hp, s.herdLeftCount() + s.fence.length, this.coinsShown, this.lostHeartIdx);
    this.lostHeartIdx = -1;
  }

  private renderTools(): void {
    const s = this.session;
    this.tools.render(s.craneLeft, this.craneMode, s.flipLeft, s.shufLeft);
  }

  /** 设计坐标 → 世界坐标（win 大飘字等以设计坐标表达） */
  private designWorld(x: number, y: number): Vec3 {
    return this.design.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(x, y, 0));
  }

  /* ============================================================
   * 触摸路由（原型 takeAnimal + moveTo）
   * ============================================================ */

  private takeAnimal(uid: number): void {
    const s = this.session;
    // 2026-09-09 输入锁收窄：去掉 `|| this.busy > 0`。装车/发车链（fulfillSlot→departSlot）
    // 期间旧逻辑静默吞掉全部动物点击且无反馈，与"卡车发车"提示时长(≈2.7s)重合被误读为提示拦截。
    // 入栏安全性由 moveTo 的 FENCE_MAX 容量门 + core 数据先行 + reconcile 幂等保证。
    if (!s.canPlay()) return;
    let a: Animal | null = null;
    for (const x of s.herd) if (x.uid === uid) { a = x; break; }
    if (!a || a.obstacle) return;
    const blocked = s.isBlocked(a);

    if (blocked && this.craneMode) {
      // 吊车吊走：免扣血（core 在 takeAnimal(uid,true) 内扣 craneLeft）
      this.craneMode = false;
      this.unschedule(this.craneTick);
      this.renderTools();
      this.toast.show('吊车吊走一只被挡动物 · 不扣生命');
      this.moveTo(uid, a, true);
      return;
    }
    if (blocked) {
      // 碰撞（2026-09-06 02:15:00 重做）：动物先沿朝向**真实走到**路径上的遮挡者身边，
      // 接触瞬间才执行碰撞流程（粒子/飘字/震屏/扣心）并过冲弹回原位。
      const out = s.takeAnimal(uid);
      if (out.kind !== 'collide') return;
      const hpLeft = out.hpLeft;
      this.lostHeartIdx = hpLeft;                 // 心碎动画标记（renderHud 消费后复位）
      const node = this.pen.byUid(uid);
      const g0 = this.fxGen;

      // 接触距离（2026-09-10 19:17 随走廊遮挡语义更新）：遮挡者是**朝向路径上的第一个占用者**，
      // 可能在 1~N 格之外 → 冲刺距离 = 格数 × 格距 − 精灵显示宽（下限 CONTACT_FLOOR）。
      // 动物因此"保持向前运动，直到撞上挡路者才发生碰撞"（用户需求），不再出现掉头/绕行。
      let hitDist = CONTACT_DIST;
      let contactW: Vec3 | null = null;
      const blocker = s.blockerOf(a);
      if (node && blocker) {
        const f = node.pos;                        // pen 本地（cocos y 向上，负值向下）
        const cells = Math.abs(blocker.col - a.col) + Math.abs(blocker.row - a.row); // 同线格距
        hitDist = Math.max(CONTACT_FLOOR, cells * this.pen.cellPitchPx(a.dir) - this.pen.animalSize());
        const DIRV: Record<Dir, Vec3> = {
          up: new Vec3(0, 1, 0), down: new Vec3(0, -1, 0),
          left: new Vec3(-1, 0, 0), right: new Vec3(1, 0, 0),
        };
        const dv = DIRV[a.dir];
        contactW = this.pen.localToWorld(new Vec3(f.x + dv.x * hitDist, f.y + dv.y * hitDist, 0));
      }
      const travel = Math.min(CONTACT_TRAVEL_MAX, Math.max(CONTACT_TRAVEL_MIN, hitDist / CONTACT_TRAVEL_SPEED));

      if (node) {
        // 接触瞬间：接触点粒子爆开 + "-1 生命"飘字 + 震屏 + 心碎（bonk 内部点亮红闪）
        node.bonk(a.dir, hitDist, () => {
          if (g0 !== this.fxGen) return;
          const pt = contactW ?? node.node.worldPosition.clone();
          this.fx.burst(pt, 8);
          this.fx.floatText(pt, hpLeft > 0 ? '-1 生命' : '生命耗尽', false);
          this.fx.shake(this.design);
          this.renderHud();
          if (hpLeft > 0) this.toast.show('撞到前面的动物了！被弹回原地 · 生命剩 ' + hpLeft + ' 颗');
        });
      } else {
        this.renderHud();
      }
      this.busy++;
      // busy 释放 = 冲刺 + 撞击 + 弹回（0.33s）+ 缓冲
      if (hpLeft <= 0) {
        // C4（2026-09-06 21:10）：生命耗尽 → 全场（牧场+围栏）动物压暗 0.5s 再弹失败面板
        this.dimBoard();
        this.scheduleOnce(() => {
          if (g0 !== this.fxGen) return;
          this.busy--;
          this.failHP();
        }, travel + 0.6);
        return;
      }
      this.scheduleOnce(() => {
        if (g0 !== this.fxGen) return;
        this.busy--;
      }, travel + 0.5);
      return;
    }
    this.moveTo(uid, a, false);
  }

  /**
   * 拿取入栏：core 数据先行（herd→fence），视图再补飞行动画（原型 moveTo）。
   * viaCrane=true 时 core 走 crane 分支（已被挡仍免扣血入栏）。
   */
  private moveTo(uid: number, _a: Animal, viaCrane: boolean): void {
    const s = this.session;
    // 方案A（2026-09-07 15:43）：加围栏容量门——fence 数据先行已含在途动物，≥FENCE_MAX 不再放行。
    // 堵死 core takeAnimal 无上限 push 的超载通道（配对改动：reconcile 去 walks 门控，实时装车腾位）
    // 同上（2026-09-09）：去 busy 门，保留 canPlay + FENCE_MAX 容量门（超载通道仍被堵死）
    if (!s.canPlay() || s.fence.length >= FENCE_MAX) return;
    const fromW = this.pen.uidWorld(uid) ?? this.pen.node.worldPosition.clone(); // 起飞点（渲染清理前抓取）
    const lane = this.walks % 3;                 // 车道号（0/1/2）：单只在途恒为 0 → 路径与改造前一致
    this.walks++;                                // 并发点击（14:05）：行走不再锁 busy
    this.walkingUids.add(uid);
    const out = s.takeAnimal(uid, viaCrane);     // 数据先行：herd.splice + fence.push
    if (out.kind !== 'fly' && out.kind !== 'crane') { this.walks--; return; }
    const g0 = this.fxGen;
    this.renderAll(out.animal.uid);              // 围栏留位但隐藏（hideUid），牧场移除该节点
    const toW = this.fence.slotWorld(out.fenceLen - 1);
    // 落格回调（飞行版与走路版共用）
    const onArrive = (): void => {
      // 资源簿记与代数解耦（方案A 2026-09-07）：walks 增减必须对称执行，不依赖回调代数是否作废。
      // 当前重开局路径由 fx.reset() 掐断旧回调 + startGame 归零 walks，本无泄漏；
      // 但簿记置于代数检查之前可保证未来任何"回调被丢弃"的新路径都不再可能使 walks 卡 >0（死锁态）
      this.walks--;
      this.walkingUids.delete(out.animal.uid);
      if (g0 !== this.fxGen) return;
      this.renderFence();                        // 落格：popIn 弹跳由 FenceView diff 触发
      this.renderHud();
      if (s.isWin()) { this.win(); return; }     // 清空通关（冗余判定，与原型一致）
      this.reconcile();                          // 方案A：每次落地即调和（去 walks 门控，凑齐订单立即装车腾位）
      // 需求3（2026-09-06 23:00）：failwait 缓冲期内有动物落地 → 重新裁决。
      // 落地可能凑齐订单/已入栏的订单被装车消化 → 满载不再无可满足 → 解除失败倒计时继续对局
      if (s.phase === 'failwait') {
        if (!s.isFenceHopeless()) {
          s.markOutcome('play');
          this.reconcile();                      // 回 play 后立即装车放行/补车
        }
        return;                                  // 仍无可满足 → 维持 failwait 等 failTick 终裁
      }
      if (!s.canPlay()) return;
      // 2026-09-10 17:16：移除"新解锁动物弹跳"（原 PRD 5.1 unlockBounce）——用户反馈点击
      //   一只动物后周围动物放大（bounceUnlock scale 0.85→1.16→1.0）观感为"点击效果泄漏"，
      //   不符合预期。现点击只影响被点动物自身（走出/bonk），周围动物显示状态零变化。
      if (s.fence.length >= FENCE_MAX) {
        // 围栏满：0.5s 缓冲等装车链消化；failTick 终局裁决（可满足 → 装车放行，
        // 确实无可满足订单才弹挤爆面板——需求 3 语义）
        s.markOutcome('failwait');
        this.scheduleOnce(this.failTick, 0.5);
        return;
      }
      if (s.allLocked()) this.toast.show('⚠️ 全场互相挡住了！点被挡动物会扣生命，或用吊车吊走');
    };
    // 2026-09-10 19:52 取消绕行机制（用户指令）：出栏只剩一条路径——**沿自身朝向直走上土路**。
    // 走廊遮挡语义下（core blockedBy = 沿朝向第一占用者），能入栏的动物朝向路径必然全程空，
    // 因此直走既不会掉头、也不会穿透；路径被占 = 被判被挡 = 走 collide 分支（冲撞扣心），
    // 根本不进此分支。原三级回落（pickExitDir 绕行 → BFS 穿缝隙 → 弧线）已全部删除。
    if (out.kind === 'fly') {
      // 需求（2026-09-06 10:05 迭代）：普通拿取 = 走到土路 → 沿土路跑到围栏口 → 入栏
      // 车道错位（方案D）：并发在途动物共享同一条土路中心线会互穿，按车道号整体外推路带
      const bandOffset = this.roadBand + lane * WALK_LANE_GAP;   // 与 buildLayout 绘制的路带中心线一致
      // 路径末点延伸到围栏格本身（10:50 补）：沿土路跑到引道口后再跑进入栏格
      const wayWs = this.pen.roadWaypoints(out.animal, bandOffset).map((p) => this.pen.localToWorld(p));
      wayWs.push(toW);
      this.fx.walkPath(out.animal, fromW, wayWs, this.pen.animalSize(), onArrive, out.animal.dir);
    } else {
      this.fx.flyAnimal(out.animal, fromW, toW, 42, onArrive);     // 吊车吊走：被吊起走弧线
    }
  }

  /* ============================================================
   * 装车链（原型 reconcile / fulfillSlot / departSlot）
   * ============================================================ */

  /** 调和循环：装车 → 死单换车 → 兜底补车 → 死局判定（回调驱动，guard 防死循环）。
   *  方案A（2026-09-07 15:43）：去 walks 门控——数据先行下在途动物已入 fence 参与匹配，
   *  行走中凑齐订单即实时装车腾位；仅保留 busy 门控（装车动画序列串行化）。
   *  根因修复：原 walks>0 门控 + moveTo 无容量门 + failTick 补偿被吞 → 并发点击时
   *  围栏满却不装车不判败、动物持续涌入（play↔failwait 反复横跳）。 */
  private reconcile(): void {
    if (this.busy > 0) return;
    const g0 = this.fxGen;             // 2026-09-09：departSlot 失配也回调 done，此处自行判代数决定是否续链
    let guard = 0;
    const step = (): void => {
      const s = this.session;
      if (!s.canPlay() || guard++ > 25) return;
      if (s.isWin()) {                                       // 清空通关（主判定点）：
        if (this.walks > 0) return;                          // 在途克隆未落地先不弹面板——末次落地 onArrive 再调和收尾
        this.win(); return;
      }
      const match = s.findMatch();
      if (match) { this.fulfillSlot(match, step); return; }  // 围栏凑齐订单 → 装车
      for (let i = 0; i < SLOT_TOTAL; i++) {                 // 死单空驶换车
        const sl = s.slots[i];
        if (sl.state === 'truck' && sl.order && !s.orderSatisfiable(sl.order)) {
          this.departSlot(i, null, () => { if (g0 !== this.fxGen) return; step(); });
          return;
        }
      }
      s.tryDispatch();                                       // 兜底：错过空位立即补车
      this.renderPark();
      // 需求3（2026-09-06 23:00）：装车链跑完围栏仍满载（并发溢出等场景）→ 重新进入
      // 满载缓冲裁决（failTick 会终裁：可满足 → 装车放行，无可满足 → 判败）；guard 防重复挂计时
      if (s.fence.length >= FENCE_MAX && s.phase !== 'failwait') {
        s.markOutcome('failwait');
        this.scheduleOnce(this.failTick, 0.5);
        return;
      }
      if (s.canPlay() && s.isStuck()) this.noStockEnd();     // 剩货凑不齐任何订单 → 死局
    };
    step();
  }

  /** 装车序列：围栏逐只飞上卡车 → cargo 落货回弹 → 金币飞 HUD + 发车（原型 fulfillSlot） */
  private fulfillSlot(match: Match, done?: () => void): void {
    const s = this.session;
    const g0 = this.fxGen;
    this.busy++;
    const idx = match.slotIdx;
    const taken = match.taken;
    // 起飞点：数据移除前记录各围栏槽位世界坐标
    const froms = taken.map((a) => {
      const k = s.fence.indexOf(a);
      return this.fence.slotWorld(k >= 0 ? k : 0);
    });
    // 数据先行：移出围栏 + 结算金币 + 订单转 loading（core beginFulfill）
    s.beginFulfill(match);             // 返回值 value 不再用于 toast（发车提示已隐藏，营收由 flyCoin 反馈）
    this.renderAll();
    const truckPt = this.park.slotWorld(idx);
    /** busy 簿记与代数解耦（2026-09-09，同 walks 硬化）：任何 fxGen 失配的早退分支都必须先释放锁，
     *  否则代数变更后 busy 永久 +1 → 全场点击死锁（旧代码仅在正常回调里 busy--，存在该隐患）。 */
    let released = false;
    const release = (cont: boolean): void => {
      if (released) return;
      released = true;
      this.busy--;
      if (cont && done) done();
    };
    let i = 0;
    const loadNext = (): void => {
      if (g0 !== this.fxGen) { release(false); return; }
      if (i >= taken.length) { this.scheduleOnce(afterAll, 0.16); return; }
      const a = taken[i];
      const from = froms[i];
      i++;
      this.fx.flyAnimal(a, from, truckPt, 34, () => {
        if (g0 !== this.fxGen) { release(false); return; }
        s.pushLoaded(idx, a);          // cargo 可视化
        this.renderPark();
        this.park.bump(idx);           // 落货下沉回弹
        this.scheduleOnce(loadNext, 0.08);
      });
    };
    const afterAll = (): void => {
      if (g0 !== this.fxGen) { release(false); return; }
      // 金币飞向 HUD（到达才入账）与发车链并行（原型同款并行）
      this.fx.flyCoin(truckPt, this.hud.coinWorld(), () => {
        if (g0 !== this.fxGen) return;
        this.coinsShown = s.coins;
        this.renderHud();
      });
      // 发车提示已隐藏（2026-09-09 用户要求）：营收反馈改由金币飞向 HUD 承担
      this.departSlot(idx, null, () => {
        if (g0 !== this.fxGen) { release(false); return; }
        release(true);
      });
    };
    loadNext();
  }

  /** 发车：驶离动画 0.38s → 空位 → 立即补新车（车位永不为空，原型 departSlot） */
  private departSlot(idx: number, msg: string | null, done?: () => void): void {
    const s = this.session;
    const g0 = this.fxGen;
    s.departSlot(idx);                 // core：state → 'leaving'
    this.renderPark();                 // ParkView diff 到 leaving → playLeave 动画
    if (msg) this.toast.show(msg);
    this.scheduleOnce(() => {
      // 代数失配也必须回调 done（2026-09-09）：调用方要靠它完成 busy 簿记；
      // 是否续链由调用方自行判代数决定，避免旧行为"失配即不回调 → 锁永久泄漏"。
      if (g0 !== this.fxGen) { if (done) done(); return; }
      if (s.slots[idx].state !== 'leaving') { if (done) done(); return; }
      s.settleSlot(idx);               // core：state → empty +（play 态）tryDispatch 补车
      this.renderPark();
      if (done) done();
    }, 0.38);
  }

  /* ============================================================
   * 救援道具（原型 enterCraneMode / armCrane / useFlip / useShuffle）
   * ============================================================ */

  /** 吊车激活（2026-09-10 21:41 用户需求：与翻转/洗牌保持同构）：
   *  取消旧的"每局首次免费、之后才看广告"特权 —— 吊车与翻转、洗牌一样是**广告道具**，
   *  额度 2 次（core CRANE_MAX），每次进入瞄准模式都需看完激励视频，用尽后按钮置灰。
   *  ⇒ craneUsed 字段随之退役（广告角标改为常显，见 ToolsBar.render）。 */
  private enterCraneMode(): void {
    const s = this.session;
    if (!s.canPlay() || this.busy > 0 || this.craneMode) return;
    if (s.craneLeft <= 0) { this.toast.show('本局吊车次数已用完'); return; }
    this.ad.show(() => {
      this.armCrane(false);
    });
  }

  /** 吊车瞄准 8 秒：被挡动物虚线圈高亮（AnimalNodeC.setCrane 由 PenView.render 驱动） */
  private armCrane(silent: boolean): void {
    this.craneMode = true;
    this.renderTools();
    this.renderPen();
    if (!silent) this.toast.show('吊车模式：点击任意被挡动物');
    this.unschedule(this.craneTick);
    this.scheduleOnce(this.craneTick, 8);
  }

  private useFlip(): void {
    const s = this.session;
    if (!s.canPlay() || this.busy > 0) return;
    if (s.flipLeft <= 0) { this.toast.show('翻转次数已用完'); return; }
    this.ad.show(() => {
      if (!s.useFlip()) return;        // core 扣次数 + 全体随机转向
      this.renderAll();
      this.toast.show('全体转向完成！');
      this.reconcile();                // 转向后可能解锁新单/新目标
    });
  }

  private useShuffle(): void {
    const s = this.session;
    if (!s.canPlay() || this.busy > 0) return;
    if (s.shufLeft <= 0) { this.toast.show('洗牌次数已用完'); return; }
    this.ad.show(() => {
      if (!s.useShuffle()) return;     // core 扣次数 + 散点重排
      this.renderAll();
      this.toast.show('位置已重排！');
      this.reconcile();
    });
  }

  /* ============================================================
   * 车位解锁（原型 parkEl 点击锁定位）
   * ============================================================ */

  private unlockSlot(i: number): void {
    const s = this.session;
    if (!s.canPlay() || this.busy > 0) return;
    this.ad.show(() => {
      if (s.slots[i].state !== 'locked') return;   // 广告期间状态可能已变
      s.unlockSlot(i);                             // core：slotsOpen 扩容 + tryDispatch
      this.renderAll();
      this.toast.show('新车位解锁！卡车已入场');
    });
  }

  /* ============================================================
   * 失败链（原型 failFence / failHP / noStockEnd）
   * ============================================================ */

  /** 围栏挤爆：两条出路 —— 看广告放生 3 只续局 / 免费重开
   *  （2026-09-10 21:41 用户需求：摘除"清仓大甩卖"与"好友求救"两个旧出口） */
  private failFence(): void {
    this.session.markOutcome('fail');
    track({ event: 'level_fail', level: this.session.level, reason: 'fence' });   // T8 埋点
    this.panels.failFence(
      () => this.ad.show(() => {   // 吊车放生 3 只 · 返还 50%
        const n = Math.min(3, this.session.fence.length);
        const refund = this.session.releaseSome(3);
        this.coinsShown = this.session.coins;
        this.afterRescue('放生 ' + n + ' 只 · 回收 ' + refund + ' 金币');
      }),
      () => this.startGame()
    );
  }

  /** 救援成功的公共收尾：回 play → 收面板 → 全量渲染 → 调和 → toast */
  private afterRescue(msg: string): void {
    this.session.markOutcome('play');
    this.panels.hide();
    this.renderAll();
    this.reconcile();
    this.toast.show(msg);
  }

  /** C4（2026-09-06 21:10）：生命耗尽时全场动物压暗（牧场+围栏容器 UIOpacity → 0.55，
   *  0.25s 渐变；重开/复活时由 undimBoard 恢复） */
  private dimBoard(): void {
    [this.pen.node, this.fence.node].forEach((n) => {
      let op = n.getComponent(UIOpacity);
      if (!op) op = n.addComponent(UIOpacity);
      tween(op).to(0.25, { opacity: 140 }).start();
    });
  }

  /** C4（2026-09-06 21:10）：恢复全场亮度（startGame 重开 + revive 复活续局两条路径调用） */
  private undimBoard(): void {
    [this.pen.node, this.fence.node].forEach((n) => {
      const op = n.getComponent(UIOpacity);
      if (op) { Tween.stopAllByTarget(op); op.opacity = 255; }
    });
  }

  /** 生命耗尽：广告恢复 1 颗心原地续局（营收保留），或重开；
   *  C5（2026-09-06 21:10）：复活上限 REVIVE_MAX 次/局，用尽后仅可放弃重开
   *  2026-09-10 21:41 用户需求：回血量由 3 颗降为 1 颗（core REVIVE_HP = 1） */
  private failHP(): void {
    const s = this.session;
    s.markOutcome('fail');
    track({ event: 'level_fail', level: s.level, reason: 'hp' });                 // T8 埋点
    const canRevive = s.canRevive();
    const left = s.herdLeftCount() + s.fence.length;
    this.panels.failHp(left, canRevive,
      () => this.ad.show(() => {
        if (!s.revive()) return;                 // core 守卫：超限无效（双保险）
        track({ event: 'revive', level: s.level, revivesUsed: s.revivesUsed }); // T8 埋点
        s.markOutcome('play');
        this.panels.hide();
        this.undimBoard();
        this.renderHud();
        this.reconcile();
        this.toast.show('❤️ 生命恢复 1 颗，继续营业');
      }),
      () => this.startGame()
    );
  }

  /** 死局：牧场清空但围栏剩货凑不齐任何订单也开不出新单（原型 noStockEnd） */
  private noStockEnd(): void {
    const s = this.session;
    s.markOutcome('end');
    track({ event: 'level_fail', level: s.level, reason: 'deadlock' });           // T8 埋点
    this.panels.noStock(s.level, s.fence.length, s.coins, () => this.startGame());
  }

  /* ============================================================
   * 胜利链（原型 win + 双倍广告）
   * ============================================================ */

  private win(): void {
    const s = this.session;
    if (s.phase === 'win') return;   // 方案A（2026-09-07）：实时调和下 step/onArrive 双入口可能先后触发，防双结算双存档
    s.markOutcome('win');
    // C3（2026-09-06 21:10）：星级按剩余生命结算（hp 3/2/1 → 3/2/1 星）；
    // 本局复活过（revivesUsed > 0）则封顶 1 星——复活回满心不算无损通关（用户拍板）
    const stars = s.revivesUsed > 0 ? 1 : Math.max(1, s.hp);
    track({ event: 'level_win', level: s.level, stars: stars, revivesUsed: s.revivesUsed }); // T8 埋点
    SaveService.saveLevelProgress(s.level);   // 存档：解锁下一关
    SaveService.saveBestStar(s.level, stars); // 存档：每关最佳星级（只增不减）
    SaveService.saveResult(this.buildResult(stars));
    SaveService.addWallet(s.coins);           // 本局营收入账钱包
    // 通关特效：彩带金币雨 + 大飘字 + 面板弹性弹出（Panels.win 内部 winPop）
    this.fx.confetti(this.designWidth(), this.designHeight());
    this.fx.floatText(this.designWorld(0, this.designHeight() * (0.5 - 0.32)), '🎉 牧场清空！', true);
    const stats = TYPES
      .filter((t) => s.soldByType[t.id].n > 0)
      .map((t) => ({ id: t.id, n: s.soldByType[t.id].n, rare: s.soldByType[t.id].rare }));
    this.panels.win({
      level: s.level,
      coins: s.coins,
      ordersDone: s.ordersDone,
      stars: stars,
      stats: stats,
      doubled: this.doubled,
      hasNext: s.level < 30,
      onDouble: () => this.ad.show(() => {
        // 翻倍：总额翻倍 → 重存结算 → 增量（= 原营收）入钱包 → 重弹面板（原型同序）
        s.coins *= 2;
        this.doubled = true;
        this.coinsShown = s.coins;
        SaveService.saveResult(this.buildResult());
        SaveService.addWallet(s.coins / 2);
        this.win();
        this.toast.show('营收翻倍！');
      }),
      onNext: () => {
        this.level = Math.min(30, s.level + 1);
        this.startGame();
      },
      onRestart: () => this.startGame(),
    });
  }

  /** 结算快照（SaveService.LastResult），键值口径与原型 buildResult 一致；
   *  C3（2026-09-06 21:10）：增 stars 字段（默认按当前 hp 换算，翻倍重存时复用 win 已算值） */
  private buildResult(stars = Math.max(1, this.session.hp)): LastResult {
    const s = this.session;
    const stats: Record<string, number> = {};
    let rare = 0;
    TYPES.forEach((t) => {
      const rec = s.soldByType[t.id];
      stats[t.id] = rec.n;
      rare += rec.rare;
    });
    stats.rare = rare;
    return {
      level: s.level,
      coins: s.coins,
      ordersDone: s.ordersDone,
      hpLeft: s.hp,
      fenceLeft: FENCE_MAX - s.fence.length,
      doubled: this.doubled,
      best: s.bestSale ?? { id: 'chicken', name: '鸡', rare: false, value: 8 },
      stats: stats,
      stars: stars,
    };
  }

  /* ============================================================
   * 重开入口（原型 restartBtn；暂停入口 showPause 已随暂停钮移除）
   * ============================================================ */

  /** HUD 重开钮：仅 play / failwait 态可重开（原型 restartBtn 守卫） */
  private requestRestart(): void {
    const p = this.session.phase;
    if (p === 'play' || p === 'failwait') this.startGame();
  }

  /* ---------- 设计尺寸便捷读取（bg/confetti/win 飘字用） ---------- */
  private designWidth(): number {
    return this.design.getComponent(UITransform)!.width;
  }

  private designHeight(): number {
    return this.design.getComponent(UITransform)!.height;
  }
}
