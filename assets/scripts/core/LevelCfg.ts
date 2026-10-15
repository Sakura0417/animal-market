import type { LevelConfig } from './Types';
import { ENABLE_FARM_ROCKS, MAX_LEVEL } from './Constants';

/** 关卡配置（修改时间：2026-09-24 22:52 —— 全曲线难度重标定，L1-60 整体加压）：
 *
 * 【本次改动】用户要求"整体难度调高 + 全曲线重标定 + 提升 1-10 关难度 + 各档下移约 10pt"。
 *   上一版（19:36）曲线是 L1-3 100% / L4-5 86% / L6-12 63% / L13-40 71% / L41-60 65% ——
 *   后段比中段还简单，与"越玩越难"的体感相反。本次整条曲线下压并改为**单调下降**
 *   （各档实得，600 局/点；括号内为改动前）：
 *     L1-3  90%（100）· L4-5 80%（86）· L6-12 58%（63）· L13-40 50%（71）· L41-60 46%（65）
 *   逐关实得：92 92 87 82 78 ｜ 61 62 61 59 59 52 52 ｜ 约 50（L13-34）｜ 约 46（L35-60）。
 *
 * 【为什么 L13-60 的降幅（约 −20pt）大于用户说的 −10pt】
 *   机械地"每档减 10"会得到 L6-12 53% → L13 61%，即 L13 反而比 L12 简单 8pt —— 那正是本次要
 *   消除的断点。要让曲线单调，L13 必须 ≤ L12，故扩展段降幅必然大于中段。这是"整体调高"的
 *   必然代价。若想取严格 −10 版本，把 ANCHOR_TIGHT / ANCHOR_PRESS 尾部整体回退约 5pt 即可。
 *
 * 【为什么 L1-2 从 3 种动物改成 4 种】
 *   实测：3 种动物下即使 herdN 拉到 22 只、紧密度 0.8、朝向偏置 0.55，一审仍 ≥96% ——
 *   根因是"订单永远凑得齐"（3 种里任选、供给过剩），玩家几乎不可能输。
 *   所以"提升 1-10 关难度"在数学上等价于"L1-2 必须进到 4 种动物"。这是唯一途径，非风格选择。
 *
 * 【难度阶梯的硬边界（实测，见 tools/sim/cfg_scan.ts 多轮扫面，各点 500-800 局）】
 *   · 种类数是**最强杠杆**：同 herdN 下 4→5 种 ≈ −16pt、5→6 种 ≈ −8~12pt。
 *     故难度台阶必然出现在换种处（L6 引入第 5 种、L13 引入第 6 种），这是设计上的"章节节点"。
 *   · 石头与紧密度**强交互**：紧 0.7 时每颗 −3pt，紧 0.9 时每颗 −3.5pt，紧 1.0 时每颗 −13pt。
 *   · **换档点必须错开**：两个杠杆同时换档会叠加成 14pt 以上的断崖（本次迭代在 L9 与 L34 各踩过一次），
 *     故 orderKinds 换档在 L11、rocks 在 L7/L11/L35、换种在 L6/L13，彼此不重合。
 *   · herdN 必须**偶数**：makeOrder 的"末车不剩 1"不变量依赖 HERD_N 恒偶。
 *   · 种类数上限 6：AnimalSchema 只有 6 种动物，再扩必须同步补 Draw2D 矢量美术。
 *
 * 【种子对拍】本次改动**动了 L1-12**，故 `tools/sim/baseline-snapshot.json` 已按项目既定流程
 *   备份为 `baseline-snapshot.20260924-pre-hardening.bak.json` → 删除 → 重跑 `npm run sim:verify`
 *   重建（DEVLOG 2026-09-24 22:52 条目记录了失效原因与重建方式；重建后对拍 12/12）。
 *
 * 历次：2026-09-24 19:36 关卡上限 30→60 + L13-60 曲线首版；2026-09-09 23:35 P1.5 紧密化
 *   （tightness/pressure 成为正式难度旋钮，见 docs/grid-scheme-review-20260909.md）；
 *   2026-09-07 22:38 石头数量统一受 Constants.ENABLE_FARM_ROCKS 开关闸门控制。 */

/* ---------------- 连续量：锚点线性插值 ---------------- */

/** 锚点关卡（升序；首末锚点外自动钳制）。锚点位置与换种/换档点对齐。 */
const ANCHOR_LV = [1, 5, 12, 22, 34, 60];
/** 盘面紧密度：0 = 均匀随机取格，1 = 纯团簇生长。全程不放满 1.0 —— 见文件头"石头强交互"说明。
 *  L5→L12 段爬得较陡（0.78→0.86）：中段（L6-12）在没有更多种类可用的情况下，
 *  紧密度是唯一能把它压到目标带的连续杠杆。 */
const ANCHOR_TIGHT = [0.60, 0.78, 0.86, 0.85, 0.87, 0.91];
/** 朝向反向偏置：0 = 朝最近场外（好上手），1 = 指向已占格制造遮挡链。 */
const ANCHOR_PRESS = [0.35, 0.52, 0.60, 0.61, 0.65, 0.74];

/** 锚点线性插值；lv 落在首/末锚点外时钳制到端点值。 */
function lerpAt(lv: number, lvs: number[], vals: number[]): number {
  const last = lvs.length - 1;
  if (lv <= lvs[0]) return vals[0];
  if (lv >= lvs[last]) return vals[last];
  for (let i = 0; i < last; i++) {
    if (lv <= lvs[i + 1]) {
      const t = (lv - lvs[i]) / (lvs[i + 1] - lvs[i]);
      return vals[i] + (vals[i + 1] - vals[i]) * t;
    }
  }
  return vals[last];
}

/* ---------------- 离散量：阶梯 ---------------- */
/* 只有离散量能提供 >2pt 的难度台阶（插值出的小数在取偶/取整后会被抹平，反而制造"同配置多关卡"）。 */

/** 动物种类数（**最强难度杠杆**）：4（L1-5，含教学）→ 5（L6-12）→ 6（L13-60，上限）。
 *  L1-2 由 3 种改为 4 种的原因见文件头 —— 3 种动物下通过率恒 ≥96%，无法体现难度。 */
function typeCountAt(n: number): number {
  return n <= 5 ? 4 : n <= 12 ? 5 : 6;
}

/** 订单种类数：2（L1-10）→ 3（L11-60）。原 L1-3 的"单一种类"教学档已取消——
 *  实测 1 种订单在 4 种动物下同样恒 ≥96%，与"提升 1-10 关难度"直接冲突。
 *  ⚠️ 换档点必须与 rocks / 换种错开：两个杠杆若同时换档，实测产生 14pt 以上的断崖。 */
function orderKindsAt(n: number): number {
  return n <= 10 ? 2 : 3;
}

/** 石头数：0（L1-6）→ 1（L7-10）→ 2（L11-34）→ 3（L35-60）。
 *  上限只有 3：紧密度 0.9 附近时第 3 颗的边际代价最大（实测可达 −13pt），
 *  故换档点必须避开换种点（L6/L13），否则两处叠加成断崖。 */
function rocksAt(n: number): number {
  return n <= 6 ? 0 : n <= 10 ? 1 : n <= 34 ? 2 : 3;
}

/** 动物数（**必须偶数**）。注意 L12→L13 由 28 降到 24：第 6 种动物值约 −10pt，
 *  必须同时减动物才能把一审压回目标带 —— 板面会略变疏，这是换种的必然代价。
 *  L13-60 保持 24 只不变：扩展段的难度台阶全部由 石头/订单种类/紧密度/偏置 提供，
 *  避免"动物数忽多忽少"造成板面观感波动。 */
function herdNAt(n: number): number {
  if (n <= 2) return 22;      // L1-2 教学：板面不必太挤，难度靠 4 种动物 + 双种类订单撑
  if (n === 3) return 24;
  if (n === 4) return 26;
  if (n <= 12) return 28;     // L5-12
  return 24;                  // L13-60
}

export function levelCfg(n: number): LevelConfig {
  n = Math.max(1, Math.min(MAX_LEVEL, n | 0));

  return {
    level: n,
    herdN: herdNAt(n),
    typeCount: typeCountAt(n),
    rocks: ENABLE_FARM_ROCKS ? rocksAt(n) : 0,
    // 闪光概率：0.035 起步，L14 起封顶 0.10（影响营收，几乎不影响难度）。
    rareP: Math.min(.1, .03 + n * .005),
    orderKinds: orderKindsAt(n),
    tightness: lerpAt(n, ANCHOR_LV, ANCHOR_TIGHT),
    pressure: lerpAt(n, ANCHOR_LV, ANCHOR_PRESS),
  };
}