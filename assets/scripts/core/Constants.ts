/* 全局配置常量（单一真相源，业务逻辑禁止硬编码数值）
 * 修改时间：2026-09-07 16:30 —— P1/C1 网格化：① 新增 GRID_COLS/GRID_ROWS/CELL_W/CELL_H
 *   （PRD 2.0 §5.1：6×10 等尺寸网格 60 格）；② 废弃走廊/散点参数 TOL/AHEAD/PAD/MIN_D
 *   （原 R 系派生，随散点盘面一起退役）；R 保留（view 碰撞接触动画过渡期仍引用，P3 上网格语义后收编）；
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
/** 每局吊车次数（首次免费 + 激励视频 2 次），PRD 2.0 §5.4 强约束：
 *  业务逻辑中不得出现硬编码数字，调整此处即可全局生效（2026-09-06 19:09 由 4 改为 3）。 */
export const CRANE_MAX = 3;
export const HP_MAX = 3;
/** 每局生命复活（广告回满 3 心）次数上限，PRD 2.0 P5/C5 强约束（2026-09-06 21:10 新增）。
 *  超限后失败面板不再提供复活广告位，仅可放弃重开。 */
export const REVIVE_MAX = 2;
export const FLIP_MAX = 2;
export const SHUF_MAX = 2;

/** 碰撞接触动画参数（PRD 2.0 D2，2026-09-06 22:25 新增；原内联于 GameView 碰撞分支）。
 *  现行为：动物真实走到路径上遮挡者的接触点才触发碰撞，
 *  接触距离 = 遮挡者投影 − 2×coreRadiusPx()×CONTACT_OVERLAP（略带重叠的"撞实"感），下限 CONTACT_FLOOR；
 *  节点/遮挡者取不到时兜底 CONTACT_DIST（prd2-reconciliation §D2 拍板值 = 格距×0.45 ≈ 21px，
 *  替代旧字面 26——PRD 字面公式 4.2px≈11ms 肉眼不可见，见对拍文档）。
 *  冲刺时长 = 距离 / CONTACT_TRAVEL_SPEED，钳制在 CONTACT_TRAVEL_MIN~MAX。 */
export const CONTACT_DIST = 21;
export const CONTACT_FLOOR = 10;
export const CONTACT_OVERLAP = 0.95;
export const CONTACT_TRAVEL_SPEED = 380;
export const CONTACT_TRAVEL_MIN = 0.14;
export const CONTACT_TRAVEL_MAX = 0.6;

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
export const ORDER_QTY3_P = 0.4;

/** 农场随机石头生成开关（2026-09-07 新增，**默认关闭**）。
 *  - `false`（默认）：所有关卡岩石数 = 0，农场开局不生成石头。
 *  - `true`：按 `core/LevelCfg.ts` 原有曲线随机落岩石（数量公式、落位规则、
 *    相邻格遮挡语义、互锁环拒绝采样全部不变，即开启后行为与改造前逐帧一致）。
 *  单一真相源：只有 `LevelCfg.levelCfg()` 读取本开关决定 `LevelConfig.rocks`，
 *  业务层（GameSession.generate 等）继续只认 `cfg.rocks`，禁止再写第二处判断。
 *  ⚠️ 该开关会改变随机流（gridLayout 取格数变化）⇒ 切换后需重建 tools/sim/baseline-snapshot.json。 */
export const ENABLE_FARM_ROCKS = false;

export const R = 7.6;
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
