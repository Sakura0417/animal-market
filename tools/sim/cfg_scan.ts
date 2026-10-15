/* 难度「响应面」扫描（2026-09-24 随全曲线重标定改造，咨询脚本）。
 *
 * 用途：固定「种类数 / 紧密度 / 朝向偏置 / 订单种类」，扫 (herdN × rocks) 的一审通过率矩阵，
 *   供 core/LevelCfg.ts 的关卡阶梯定值，或日后重调难度时复用。
 *
 * 为什么要扫面而不是逐级试错：难度灵敏度远超直觉，实测硬边界——
 *   · 同 herdN 下 5 种→6 种动物 = **−8~12pt**
 *   · 石头与紧密度强交互：紧 0.7 时每颗 −3pt，紧 1.0 时每颗 −13pt
 *   · herdN 必须偶数（makeOrder 的"末车不剩 1"不变量依赖 HERD_N 恒偶）
 *   逐级改 LevelCfg 再扫全曲线至少 20 轮编辑-重跑；一次扫面即可定出全部换档点。
 *
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/cfg_scan.ts
 * 输出解读：找到落在该档目标带内的 (herdN, rocks) → 抄进 LevelCfg 的阶梯；✓/↑/↓ 为带内/越界标注。
 */
import { setCfgOverride, simulateLevel } from './BalanceSim';
import type { LevelConfig } from '../../assets/scripts/core/Types';

/** 每个采样点的局数。500 局时一审的抽样标准误约 ±2.1pt，够分辨 3pt 以上的台阶。 */
const GAMES = 500;
/** 仅作 levelCfg 基底；难度相关字段全部由 cfgOverride 覆盖，故取值不影响结论。 */
const BASE_LV = 30;

interface Preset {
  tag: string;
  typeCount: number;
  orderKinds: number;
  tightness: number;
  pressure: number;
  herdNs: number[];
  rockss: number[];
  lo: number;
  hi: number;
}

/** 各档预设：给定该档的 tightness/pressure/种类/订单种类，扫 herdN × rocks。
 *  目标带（lo-hi）对应当前 LevelCfg 的分档实得区间（2026-09-24 全曲线重标定后）。 */
const PRESETS: Preset[] = [
  { tag: 'L1-2 教学（种4 单2 紧.60 偏.35）', typeCount: 4, orderKinds: 2, tightness: 0.60, pressure: 0.35, herdNs: [20, 22, 24], rockss: [0], lo: 88, hi: 94 },
  { tag: 'L3-5 爬升（种4 单2 紧.78 偏.52）', typeCount: 4, orderKinds: 2, tightness: 0.78, pressure: 0.52, herdNs: [24, 26, 28], rockss: [0, 1], lo: 75, hi: 85 },
  { tag: 'L6-12 中段（种5 单2 紧.86 偏.60）', typeCount: 5, orderKinds: 2, tightness: 0.86, pressure: 0.60, herdNs: [28, 30], rockss: [0, 1, 2], lo: 50, hi: 62 },
  { tag: 'L13-40（种6 单3 紧.85 偏.61）', typeCount: 6, orderKinds: 3, tightness: 0.85, pressure: 0.61, herdNs: [22, 24, 26], rockss: [1, 2, 3], lo: 44, hi: 52 },
  { tag: 'L41-60（种6 单3 紧.91 偏.74）', typeCount: 6, orderKinds: 3, tightness: 0.91, pressure: 0.74, herdNs: [22, 24, 26], rockss: [2, 3, 4], lo: 40, hi: 48 },
];

for (const p of PRESETS) {
  console.log('=== ' + p.tag + ' · 目标带 ' + p.lo + '-' + p.hi + '% ===');
  for (const rocks of p.rockss) {
    for (const herdN of p.herdNs) {
      const cfg: Partial<LevelConfig> = {
        typeCount: p.typeCount, herdN, rocks, orderKinds: p.orderKinds,
        tightness: p.tightness, pressure: p.pressure,
      };
      setCfgOverride(cfg);
      const r = simulateLevel(BASE_LV, GAMES);
      const fp = r.rawWin / r.games * 100;
      const mark = fp < p.lo ? '  ↓低于带' : fp > p.hi ? '  ↑高于带' : '  ✓带内';
      console.log(
        '  石' + rocks + ' 动物' + String(herdN).padStart(2, ' ') +
        ' | 一审' + fp.toFixed(1).padStart(5, ' ') + '%' + mark +
        '  恢复后' + (r.win / r.games * 100).toFixed(1) + '%'
      );
    }
  }
}

setCfgOverride(null);