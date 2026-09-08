/* 棋盘纯函数集：网格占用/相邻遮挡判定 / 生成落位 / 方向 / 洗牌重排（core 层，禁止 import 'cc'）
 * 修改时间：2026-09-07 16:30 —— P1 网格化（B2/B3/B4）：
 *   ① 遮挡语义改"相邻格遮挡"：朝向的相邻格被动物/岩石占据即被挡；
 *     边界格朝向场外视为空（可走出）。走廊遮挡（射线+AHEAD/TOL）随散点盘面一起废止。
 *   ② 生成改"网格落位"：6×10=60 格随机取 n 个不重复格（B3 约束式生成器基础，
 *     保留 unlocked≥6 + 互锁环拒绝采样）。
 *   ③ 洗牌改"空格间重排"（B4）：reflow 全场重新落位到随机不重复格
 *     （旧 scatter 散点重摇会把网格洗回散点，废止）。
 * 修改时间：2026-09-07 23:30 —— 增强 hasHeadOnPair 显式检测 + breakAllHeadOnPairs 定点修复（需求 #2：保证任意两只动物路径不正面相对、不形成 2-环对冲）
 * 历次：2026-09-07 16:30 P1 网格化；2026-09-06 19:47 随机源改 Rng 注入。 */
import type { Animal, Dir, Rng } from './Types';
import { GRID_COLS, GRID_ROWS } from './Constants';
import { Grid } from './Grid';

export function spanY(): number {
  return 100 * 1.25; // = 100*ASPECT；不 import Constants 防环（ASPECT 仅 view 映射与 CELL_H 派生用）
}

/** Fisher-Yates 洗牌（使用注入的 rng）。不读全局 Math.random，保证 GameSession 可控随机流。 */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

export function randDir(rng: Rng): Dir {
  const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
  return DIRS[Math.floor(rng() * 4)];
}

/** 朝向选择（网格版）：50% 概率朝最近场外边（朝外=相邻格越界=无遮挡，天然解锁），
 *  50% 纯随机。col/row 入参取代旧 smartDir(x, yu)。 */
export function smartDir(col: number, row: number, rng: Rng): Dir {
  if (rng() < 0.5) {
    const dl = col, dr = GRID_COLS - 1 - col, du = row, dd = GRID_ROWS - 1 - row;
    const m = Math.min(dl, dr, du, dd);
    if (m === dl) return 'left';
    if (m === dr) return 'right';
    if (m === du) return 'up';
    return 'down';
  }
  return randDir(rng);
}

/** Dir → 相邻格位移（up = yu 减小方向）。 */
const DIR_DELTA: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};

/** 相邻格遮挡：b 朝向的相邻格占用者即遮挡者（可能是动物或岩石）；
 *  相邻格越界 = 朝向场外 = 无遮挡。纯查询，grid 由调用方构建（多次查询复用同一快照）。 */
function blockedBy(grid: Grid, b: Animal): Animal | null {
  const [dc, dr] = DIR_DELTA[b.dir];
  return grid.occupant(b.col + dc, b.row + dr);
}

/** 相邻格遮挡者查询（走廊版 API 兼容：view 层碰撞动画定位用，纯读不耗随机流）。 */
export function blockerOf(herd: Animal[], b: Animal): Animal | null {
  return blockedBy(Grid.build(herd), b);
}

export function isBlocked(herd: Animal[], b: Animal): boolean {
  return blockerOf(herd, b) !== null;
}

/** 互锁环检测：构建"被挡动物 → 朝向相邻格占用者"有向图（岩石作遮挡源但不作环节点，
 *  与旧走廊版语义一致），存在环 = 一组互相锁死的动物（需吊车/翻转/洗牌强拆）。
 *  纯读判定，不消耗随机流；generate() 拒绝采样用。
 *  注：相邻遮挡下环只能沿网格邻接闭合成 2/4 长度环（旧走廊版任意长度），出现率大幅下降，
 *  保留检测作兜底（tools/test-cyclerate.ts 可量化验证）。 */
export function hasBlockCycle(herd: Animal[]): boolean {
  const grid = Grid.build(herd);
  const edges = new Map<number, number[]>();
  for (const b of herd) {
    if (b.obstacle) continue;
    const a = blockedBy(grid, b);
    if (a && !a.obstacle && a !== b) {
      const list = edges.get(b.uid);
      if (list) list.push(a.uid); else edges.set(b.uid, [a.uid]);
    }
  }
  const color = new Map<number, number>(); // 1=在栈 2=已完成
  const visit = (u: number): boolean => {
    const c = color.get(u);
    if (c === 1) return true;              // 回到在栈节点 → 有环
    if (c === 2) return false;
    color.set(u, 1);
    for (const v of edges.get(u) ?? []) if (visit(v)) return true;
    color.set(u, 2);
    return false;
  };
  for (const u of edges.keys()) if (visit(u)) return true;
  return false;
}

export function unlockedSet(herd: Animal[]): number[] {
  const grid = Grid.build(herd);
  const s: number[] = [];
  for (let k = 0; k < herd.length; k++) {
    if (!herd[k].obstacle && blockedBy(grid, herd[k]) === null) s.push(herd[k].uid);
  }
  return s;
}

export function countUnlocked(herd: Animal[]): number {
  return unlockedSet(herd).length;
}

export function herdLeft(herd: Animal[]): number {
  let n = 0;
  for (let k = 0; k < herd.length; k++) if (!herd[k].obstacle) n++;
  return n;
}

export function countFence(fence: Animal[]): Record<string, number> {
  const m: Record<string, number> = {};
  fence.forEach(function (a) { m[a.type.id] = (m[a.type.id] || 0) + 1; });
  return m;
}

export function unlockedCountOf(herd: Animal[], id: string): number {
  const grid = Grid.build(herd);
  let n = 0;
  for (let k = 0; k < herd.length; k++) {
    const a = herd[k];
    if (!a.obstacle && a.type.id === id && blockedBy(grid, a) === null) n++;
  }
  return n;
}

export function allLocked(herd: Animal[]): boolean {
  return countUnlocked(herd) === 0 && herd.some(function (x) { return !x.obstacle; });
}

/** 2-环"对冲对"显式检测（2026-09-07 23:30 增强，需求 #2）：
 *  存在两只动物 A、B 在相邻格，且 A 朝向 B、B 朝向 A（路径正面相对）即返回 true。
 *  语义比 hasBlockCycle 更严格：hasBlockCycle 含 2/3/4+ 环且仅做"是否有环"判定；
 *  本函数专为"任何两只动物路径不应正面对冲"做显式断言，供 generate() 防御层 + 回归测试使用。
 *  岩石虽作遮挡源但不参与（obstacle 不算动物），避免误报"动物↔岩石"的对冲。 */
export function hasHeadOnPair(herd: Animal[]): boolean {
  const grid = Grid.build(herd);
  for (const a of herd) {
    if (a.obstacle) continue;
    const [dc, dr] = DIR_DELTA[a.dir];
    const b = grid.occupant(a.col + dc, a.row + dr);
    if (!b || b.obstacle) continue;
    const [bdc, bdr] = DIR_DELTA[b.dir];
    if (b.col + bdc === a.col && b.row + bdr === a.row) return true;
  }
  return false;
}

/** 定点修复所有"对冲对"（2026-09-07 23:30 新增）：对每对 A↔B（A 朝 B、B 朝 A），
 *  把 A 的方向翻为既不朝向 B、也不等于 B 当前方向的两个剩余方向之一（rng 选）。
 *  翻 A 不翻 B 是有意的：翻一个就够、且不会引入"翻 B 仍可能与 A 旧方向对冲"的歧义。
 *  反复迭代至无对冲对或达 herd.length*4 上限（防极端退化棋盘死循环）。 */
export function breakAllHeadOnPairs(herd: Animal[], rng: Rng): void {
  const grid = Grid.build(herd);
  const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
  const safetyMax = Math.max(8, herd.length * 4);
  for (let safety = 0; safety < safetyMax; safety++) {
    let fixedThisPass = false;
    for (const a of herd) {
      if (a.obstacle) continue;
      const [dc, dr] = DIR_DELTA[a.dir];
      const b = grid.occupant(a.col + dc, a.row + dr);
      if (!b || b.obstacle) continue;
      const [bdc, bdr] = DIR_DELTA[b.dir];
      if (b.col + bdc !== a.col || b.row + bdr !== a.row) continue;
      // A↔B 对冲：从 {up,down,left,right} \ {a.dir, b.dir} 随机选一个翻给 A
      const choices: Dir[] = [];
      for (const d of DIRS) if (d !== a.dir && d !== b.dir) choices.push(d);
      a.dir = choices[Math.floor(rng() * choices.length)];
      fixedThisPass = true;
    }
    if (!fixedThisPass) return;
  }
}

/** 网格落位（P1/B3）：从全部 GRID_COLS×GRID_ROWS 格中随机取 n 个不重复格
 *  （Fisher-Yates 部分洗牌，rng 注入）。调用方按序分配给动物/岩石；
 *  n ≤ 60 由 LevelCfg 保证（最大 herdN 34 + rocks 4 = 38）。 */
export function gridLayout(n: number, rng: Rng): Array<{ col: number; row: number }> {
  const total = GRID_COLS * GRID_ROWS;
  if (n > total) throw new Error('gridLayout: n=' + n + ' 超过总格数 ' + total);
  const idx: number[] = [];
  for (let i = 0; i < total; i++) idx.push(i);
  shuffle(idx, rng);
  const out: Array<{ col: number; row: number }> = [];
  for (let k = 0; k < n; k++) {
    out.push({ col: idx[k] % GRID_COLS, row: Math.floor(idx[k] / GRID_COLS) });
  }
  return out;
}

/** 洗牌重排（P1/B4）：全场（动物+岩石）重新落位到随机不重复格，个体身份/朝向不变。
 *  取代旧 scatter 散点重摇——散点版会把网格盘面洗回连续坐标，违反网格语义。 */
export function reflow(herd: Animal[], rng: Rng): void {
  const cells = gridLayout(herd.length, rng);
  for (let k = 0; k < herd.length; k++) {
    herd[k].col = cells[k].col;
    herd[k].row = cells[k].row;
  }
}
