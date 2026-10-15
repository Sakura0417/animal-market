/* 全局配置常量（单一真相源，业务逻辑禁止硬编码数值）
 * 修改时间：2026-09-26 23:30 —— 新增自动挪窝 B 档开关 AUTO_RESHUF_ENABLED / AUTO_RESHUF_MAX
 *   （三道具用尽 + 全场互锁 → 免费打散重排一次，防死锁挫败；见 Constants.ts 内注释）。
 * 2026-09-24 19:36 —— ① 新增 MAX_LEVEL = 60 单一真相源（收编 LevelCfg/GameSession/
 *   SaveService/GameView 四处硬编码的 30）；② ENABLE_FARM_ROCKS 置 true（关卡扩至 60 时
 *   启用石头作为扩展段难度变量，L1-12 仍恒 0 以保持种子对拍）。
 * 2026-09-10 21:41 —— ① CRANE_MAX 3→2 且取消"首次免费"，吊车与翻转/洗牌同构；
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

/** 关卡数上限（2026-09-24 新增，单一真相源）：
 *  原先 30 这个数字散落在 LevelCfg / GameSession / SaveService / GameView 四处硬编码，
 *  违反"业务逻辑禁止硬编码数值"约定，且扩展关卡数必须四改（易漏）。
 *  现收编为唯一常量——扩展关卡只改这里。
 *  消费方：LevelCfg.levelCfg（钳制入参）、GameSession.start（钳制入参）、
 *  SaveService（进度/星级钳制）、GameView（hasNext 判定 + 下一关推进）。
 *  ⚠️ 改动本值不影响 L1-12 的配置与随机流，故无需重建 baseline-snapshot。 */
export const MAX_LEVEL = 60;

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

/** 自动挪窝兜底开关（2026-09-26 新增，B 档）。
 *  - `true`（默认）：全场互锁且吊车/转身/挪窝三道具**全部用尽**时，免费打散重排一次
 *    （每局上限 AUTO_RESHUF_MAX），把"硬死锁"降级为"免费再试一次"，消除碰撞扣心折磨。
 *  - `false`：保持现状——互锁只能靠道具或碰撞扣心硬扛（模拟器模拟为 faillock 判负）。
 *  触发语义（B 档，用户拍板）：道具链正常优先，自动挪窝只做极端兜底，不侵蚀道具/广告价值。
 *  ⚠️ 该开关与 AUTO_RESHUF_MAX 都会**改变随机流**（reflow 消费 rng）⇒ 任何调整
 *    必须重建 `tools/sim/baseline-snapshot.json`（与 ENABLE_FARM_ROCKS 同款纪律）。
 *    验证：npm run sim:verify 出现预期偏离 → 备份 + 删 + 重建 + DEVLOG 说明。 */
export const AUTO_RESHUF_ENABLED = true;
/** 每局自动挪窝次数上限（2026-09-26 新增，B 档：每局限 1 次，防刷盘与无限循环）。 */
export const AUTO_RESHUF_MAX = 1;

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

/** 农场随机石头生成开关（2026-09-07 新增；2026-09-24 关卡扩展至 60 时**打开**）。
 *  - `false`：所有关卡岩石数 = 0，农场开局不生成石头。
 *  - `true`（当前）：按 `core/LevelCfg.ts` 的岩石曲线随机落岩石（数量公式、落位规则、
 *    相邻格遮挡语义、互锁环拒绝采样全部不变）。
 *  单一真相源：只有 `LevelCfg.levelCfg()` 读取本开关决定 `LevelConfig.rocks`，
 *  业务层（GameSession.generate 等）继续只认 `cfg.rocks`，禁止再写第二处判断。
 *  ⚠️ 该开关会改变随机流（clusterLayout 取格数变化）⇒ 切换后**理论**需重建
 *    `tools/sim/baseline-snapshot.json`。但 2026-09-24 打开时同步把岩石曲线定义为
 *    **L1-12 恒为 0**（`n <= 12 ? 0 : …`），而种子对拍只覆盖 L1-12
 *    （tools/sim/run.ts 的 verify 分支硬编码 1..12）⇒ 对拍区内 rocks 恒 0、
 *    随机流零扰动 ⇒ `sim:verify` 仍应 12/12，**无需重建快照**。
 *    验证命令：npm run sim:verify。 */
export const ENABLE_FARM_ROCKS = true;

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
