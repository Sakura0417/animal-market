/* 全局配置常量（单一真相源，业务逻辑禁止硬编码数值）
 * 修改时间：2026-09-10 21:41 —— ① CRANE_MAX 3→2 且取消"首次免费"，吊车与翻转/洗牌同构；
 *   ② 新增 REVIVE_HP = 1（广告复活由回满 3 心改为回 1 颗）。
 * 2026-09-09 23:35 —— P1.5 紧密化收尾：① R（散点时代 core 半径）与 CONTACT_OVERLAP
 *   退役——相邻格遮挡下接触距离 = 格距 − 精灵宽（常量公式，view 层 cellPitchPx 提供），
 *   投影换算消失（P6 数值/视觉耦合温床拆除）；② GRID_* 家族成为唯一空间常量。
 * 2026-09-09 21:20 —— 新增 WALK_LANE_GAP（并发入栏车道错位间距）
 * 2026-09-07 16:30 —— P1/C1 网格化：① 新增 GRID_COLS/GRID_ROWS/CELL_W/CELL_H
 *   （PRD 2.0 §5.1：6×10 等尺寸网格 60 格）；② 废弃走廊/散点参数 TOL/AHEAD/PAD/MIN_D
 *   （原 R 系派生，随散点盘面一起退役）；
 *   23:00 —— TYPES/TYPE_MAP 改由 core/AnimalSchema.ts 派生（用户需求 2）；
 *   22:25 —— 新增碰撞接触动画参数 CONTACT_*（PRD 2.0 D2）；
 *   2026-09-08 00:04 —— D8 调参轮收官：新增 ORDER_QTY3_P 概率闸门（订单单种数量上限），一审全线入带；
 *   2026-09-07 22:38 —— 新增 ENABLE_FARM_ROCKS 开关（默认 false：农场默认不随机生成石头）；
 *   21:10 —— 新增 REVIVE_MAX = 2（PRD 2.0 P5/C5）；19:47 —— ① CRANE_MAX 4→3；② 新增 DEFAULT_SEED 哨兵 */
import type { AnimalType, Dir } from './Types';
import { ANIMAL_SCHEMA } from './AnimalSchema';

export const SLOT_TOTAL = 5;
export const SLOT_OPEN = 3;
export const FENCE_MAX = 7;
/** 每局吊车次数，PRD 2.0 §5.4 强约束：业务逻辑中不得出现硬编码数字，调整此处即可全局生效。
 *  2026-09-10 21:41 用户需求：与 FLIP_MAX / SHUF_MAX 保持同构 —— 默认 2 次额度，
 *  且**每次使用都需看完激励视频**（原"首次免费 + 之后看广告"的特权取消，原值 3）。
 *  ⚠️ **改这个值必须重建 `tools/sim/baseline-snapshot.json`**：BalanceSim 的救援策略会用吊车，
 *  额度 3→2 使"何时无吊车可用"提前出现 ⇒ 策略分叉 ⇒ **随机流整体偏移**（实测 9/12 关偏离，
 *  一审通过率随之变化）。它不是纯 view 常量。 */
export const CRANE_MAX = 2;
export const HP_MAX = 3;
/** 每局生命复活（看广告）次数上限，PRD 2.0 P5/C5 强约束（2026-09-06 21:10 新增）。
 *  超限后失败面板不再提供复活广告位，仅可放弃重开。 */
export const REVIVE_MAX = 2;
/** 广告复活恢复的生命数（2026-09-10 21:41 新增，用户需求）。
 *  原实现 `revive()` 直接 `hp = HP_MAX`（回满 3 心）⇒ 复活等同于回满，生命耗尽几乎无惩罚；
 *  改为只回 1 颗心：复活是"续一口气"而不是"满血重开"，失败压力与广告价值同时抬升。 */
export const REVIVE_HP = 1;
export const FLIP_MAX = 2;
export const SHUF_MAX = 2;

/** 碰撞接触动画参数（PRD 2.0 D2，2026-09-06 22:25 新增；2026-09-09 P1.5·C5 更新）。
 *  P1.5 起：接触距离 = 格距 − 精灵显示宽（相邻格遮挡下的常量公式，PenView.cellPitchPx
 *  提供格距），下限 CONTACT_FLOOR；CONTACT_OVERLAP（投影重叠系数）随投影换算一并退役。
 *  兜底 CONTACT_DIST 仍保留：blocker 取不到时使用（prd2-reconciliation §D2 拍板值 =
 *  格距×0.45 ≈ 21px）。冲刺时长 = 距离 / CONTACT_TRAVEL_SPEED，钳制在 MIN~MAX。 */
export const CONTACT_DIST = 21;
export const CONTACT_FLOOR = 10;
export const CONTACT_TRAVEL_SPEED = 380;
export const CONTACT_TRAVEL_MIN = 0.14;
export const CONTACT_TRAVEL_MAX = 0.6;

/** 在途入栏动物的"车道错位"间距（px，2026-09-09 新增）。
 *  并发点击时多只动物会共享同一条土路中心线，克隆体在路面段互相穿过；
 *  按在途序号把路面路径整体外推 lane×WALK_LANE_GAP（lane = walks % 3，最多 3 条道），
 *  使同时行走的动物各走各道。单只在途时 lane=0 → 与改造前路径完全一致（零观感变化）。 */
export const WALK_LANE_GAP = 6;

/** 调度默认种子哨兵值（2026-09-06 19:09 新增）。
 *  GameSession.start() 不传 seed 或传 -1 时，调度链（tryDispatch/findMatch/makeOrder）走全局 Math.random；
 *  传具体 seed（≥0）时切到 mulberry32(seed) 实现完全可复现。
 *  选 -1 作为哨兵的原因：避免与玩家可能传入的 0 冲突；
 *  view 层真实运行建议传 Date.now() 派生值，玩家每次开局体验差异化。 */
export const DEFAULT_SEED = -1;

/** 订单中"单个种类"的数量上限档位（D8 调参轮，2026-09-07 23:40）。
 *  实测（400 局曲线，配合 orderKinds L6+ = 3）：
 *    ORDER_QTY3_P = 0.0（恒 2 只）⇒ L6-L12 一审 88.5-95.5%、挤爆 7-11.5%（偏松）
 *    ORDER_QTY3_P = 1.0（恒 3 只）⇒ L6-L12 一审 37-46%、挤爆 54-63%（过难）
 *  故改为概率闸门：**每笔订单**开单时先摇一次，命中则本单数量上限 3、否则 2。
 *  两条独立杠杆：`LevelCfg.orderKinds` 控"订单覆盖几个种类"，本常量控"每种类要几只"。
 *  ⚠️ 调整会改变随机流（每次 makeOrder 多消费 1 个 rng）⇒ 需重建 tools/sim/baseline-snapshot.json。 */
export const ORDER_QTY3_P = 0.2;

/** 农场随机石头生成开关（2026-09-07 新增，**默认关闭**）。
 *  - `false`（默认）：所有关卡岩石数 = 0，农场开局不生成石头。
 *  - `true`：按 `core/LevelCfg.ts` 原有曲线随机落岩石（数量公式、落位规则、
 *    相邻格遮挡语义、互锁环拒绝采样全部不变，即开启后行为与改造前逐帧一致）。
 *  单一真相源：只有 `LevelCfg.levelCfg()` 读取本开关决定 `LevelConfig.rocks`，
 *  业务层（GameSession.generate 等）继续只认 `cfg.rocks`，禁止再写第二处判断。
 *  ⚠️ 该开关会改变随机流（gridLayout 取格数变化）⇒ 切换后需重建 tools/sim/baseline-snapshot.json。 */
export const ENABLE_FARM_ROCKS = false;

export const ASPECT = 1.25;

/** 网格盘面参数（P1/C1，2026-09-07 16:30 新增，PRD 2.0 §5.1）：
 *  6×10 等尺寸网格共 60 格，动物/岩石各占一整格、紧密排列、四朝向。
 *  core 连续坐标 x∈[0,100]、yu∈[0,100*ASPECT=125]；CELL_W/CELL_H 为单格连续坐标尺寸，
 *  格中心 = (col+0.5)*CELL_W, (row+0.5)*CELL_H（Types.Animal 的 x/yu 派生 getter 用，
 *  view 层过渡期零改动）。占用图查询见 core/Grid.ts。 */
export const GRID_COLS = 6;
export const GRID_ROWS = 10;
export const CELL_W = 100 / GRID_COLS;
export const CELL_H = (100 * ASPECT) / GRID_ROWS;

/** 动物种类表（2026-09-06 23:00 改造）：由 AnimalSchema.ts 派生，新增/调整动物只改 schema，
 *  本文件与全部调用方零改动。 */
export const TYPES: AnimalType[] = ANIMAL_SCHEMA;

export const TYPE_MAP: Record<string, AnimalType> = {};
TYPES.forEach(function (t) { TYPE_MAP[t.id] = t; });

export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
export const DIR_DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
