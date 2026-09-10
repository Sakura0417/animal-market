/* 棋盘纯函数集：网格占用/遮挡判定 / 生成落位 / 方向 / 洗牌重排（core 层，禁止 import 'cc'）
 * 修改时间：2026-09-10 19:52 —— 🚫 **取消绕行机制**（用户指令）：删除 pickExitDir（换方向
 *   绕行出口）与 findExitPath（BFS 穿缝隙寻路）——走廊语义下"能入栏者朝向路径必然全空"，
 *   出栏恒为沿自身朝向直走，路径被占即被挡（点击冲撞），绕行分支不存在。
 * 2026-09-10 19:43 —— 🔴 **遮挡判定语义统一为"走廊遮挡"**（用户反馈：动物路径远处
 *   有动物时掉头朝上、不符合逻辑，应保持向前运动并发生碰撞）：
 *   ① blockedBy 由"相邻格占用者"改为"沿朝向的第一个占用者"（firstOnLine/lineBlocked）；
 *     ⇒ 能入栏的动物其朝向路径必然全程空 → view 直走（掉头/绕行消失）；
 *     ⇒ 被挡动物点击即沿朝向冲撞到该占用者（view hitDist 按格数计算）；
 *   ② corridorOccupied 与 isBlocked 语义统一（前者=带方向参数版）；
 *   ③ repairUnlocks 保底判据随之为"走廊全空的方向"；
 *   ④ breakAllHeadOnLines 新增 takeAnimal 接线（对局中移走动物会造出新正对）。
 *   实测代价：被挡率 60.9%→70.3%、可入栏 11.8→8.9 只；靠订单压力（orderKinds 2 /
 *   ORDER_QTY3_P 0.2）与 herdN（L7-12 触顶 28）重建难度带，L6-12 一审 59.8-65.5%。
 * 2026-09-10 10:32 —— 线上对冲修正（同一条路线上任意两个动物不方向相对）：① 新增 isHeadOnLinePair/hasHeadOnLinePair——"互为对方朝向上的第一个
 *   占用者"即正对（距离任意，中间隔空格也算，是 hasHeadOnPair 相邻版超集；路线被
 *   岩石/第三方隔开不算）；② 新增 breakAllHeadOnLines 确定性修正（零 rng、单调收敛、
 *   放弃式兜底无死循环），接线 generate/useShuffle/useFlip（见 GameSession）。
 * 2026-09-09 23:35 —— P1.5 紧密化（docs/grid-scheme-review-20260909.md 阶段 A/B）：
 *   ① 新增 clusterLayout(n, rng, t) 团簇落位——t=0 时与 gridLayout 同一洗牌 deck 取前 n，
 *     布局与随机流消耗逐次同构（开关法对拍基点）；t>0 以概率 t 优先取已选格邻域（紧密排列）。
 *   ② smartDir 增加 occupied/pressure 参数——落实 PRD 5.1「高关卡反向偏置制造链条」；
 *     pressure=0 时与旧版 rng 消耗序列逐次一致。
 *   ③ 新增 repairUnlocks——解锁数不足时确定性定向翻向（零 rng），取代紧密盘面下低效的整体重摇。
 *   ④ ~~新增 findExitPath~~（已于 19:52 删除，见文件头最新条目）；原设计背景：
 *     用户否决；网格化让占用图可用，沿空格寻路是该品类正解）。确定性、零 rng。
 * 2026-09-09 22:30 —— corridorOccupied 支持任意方向 + ~~新增 pickExitDir~~（已于 19:52 删除）
 * 2026-09-07 16:30 —— P1 网格化（B2/B3/B4）：
 *   ① 遮挡语义改"相邻格遮挡"：朝向的相邻格被动物/岩石占据即被挡；
 *     边界格朝向场外视为空（可走出）。走廊遮挡（射线+AHEAD/TOL）随散点盘面一起废止。
 *   ② 生成改"网格落位"：6×10=60 格随机取 n 个不重复格（B3 约束式生成器基础，
 *     保留 unlocked≥6 + 互锁环拒绝采样）。
 *   ③ 洗牌改"空格间重排"（B4）：reflow 全场重新落位到随机不重复格
 *     （旧 scatter 散点重摇会把网格洗回散点，废止）。
 * 2026-09-07 23:30 —— 增强 hasHeadOnPair 显式检测 + breakAllHeadOnPairs 定点修复（需求 #2：保证任意两只动物路径不正面相对、不形成 2-环对冲）
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

/** Dir → 相邻格位移（up = yu 减小方向）。 */
const DIR_DELTA: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};

/** 确定性方向遍历序（up→down→left→right）：repairUnlocks / clusterLayout
 *  的邻居扩展与候选收集顺序。固定序是"同输入必同输出"的确定性保证（不耗随机流）。 */
const DIRS_ORDER: Dir[] = ['up', 'down', 'left', 'right'];

/** 朝向选择（网格版 + PRD 5.1「高关卡反向偏置制造链条」，P1.5 2026-09-09）：
 *  - 朝最近场外边的概率 = 0.5×(1−pressure)：随关卡压力由 50% 降至 0（朝外=相邻格越界=天然解锁）；
 *  - 指向已占格的概率 = 0.4×pressure：直接制造遮挡链（occupied = 本关全部占用格集合，
 *    编码 row*GRID_COLS+col，generate 在落位后构建传入）；
 *  - 其余纯随机。
 *  随机流纪律：pressure=0 时与 2026-09-07 16:30 旧版 rng 消耗序列逐次一致
 *  （第 1 次掷 away 门，未中再 randDir 1 次；occ 段永不可达、不多耗 rng）。 */
export function smartDir(col: number, row: number, rng: Rng, occupied?: Set<number>, pressure = 0): Dir {
  const awayP = 0.5 * (1 - pressure);
  const occP = 0.4 * pressure;
  const roll = rng();
  if (roll < awayP) {
    const dl = col, dr = GRID_COLS - 1 - col, du = row, dd = GRID_ROWS - 1 - row;
    const m = Math.min(dl, dr, du, dd);
    if (m === dl) return 'left';
    if (m === dr) return 'right';
    if (m === du) return 'up';
    return 'down';
  }
  if (occupied && roll < awayP + occP) {
    const hit: Dir[] = [];
    for (const d of DIRS_ORDER) {
      const [dc, dr] = DIR_DELTA[d];
      const c2 = col + dc, r2 = row + dr;
      if (c2 < 0 || c2 >= GRID_COLS || r2 < 0 || r2 >= GRID_ROWS) continue;
      if (occupied.has(r2 * GRID_COLS + c2)) hit.push(d);
    }
    if (hit.length) return hit[Math.floor(rng() * hit.length)];
  }
  return randDir(rng);
}

/** 沿线扫描：从 (col,row) 沿 dir 的**相邻格**起扫到边界，返回第一个占用者
 *  （含岩石/动物；null = 全程空或直接越界=场外）。纯读、不耗随机流。
 *  **2026-09-10 19:17 起这是唯一的遮挡判定基础**（走廊语义，见 blockedBy 注释）。 */
function firstOnLine(grid: Grid, col: number, row: number, dir: Dir): Animal | null {
  const [dc, dr] = DIR_DELTA[dir];
  let c = col + dc, r = row + dr;
  while (!Grid.outOfBounds(c, r)) {
    const o = grid.occupant(c, r);
    if (o) return o;
    c += dc;
    r += dr;
  }
  return null;
}

/** 沿 dir 的走廊是否任一格被占（= firstOnLine 命中）。 */
function lineBlocked(grid: Grid, col: number, row: number, dir: Dir): boolean {
  return firstOnLine(grid, col, row, dir) !== null;
}

/** 遮挡判定（2026-09-10 19:17 语义统一为**走廊遮挡**）：
 *  b 朝向路径上（相邻格起直到边界）的**第一个占用者**即遮挡者（动物或岩石）；
 *  路径全程空 / 直接越界 = 未被挡。
 *
 *  **为什么从"相邻格"改回"走廊"**（用户反馈两次）：
 *   ① "动物路径远处存在被遮挡的动物时，动物会掉头朝上运动，不符合逻辑，正确行为应为
 *     保持向前运动并发生碰撞"——相邻格语义下"相邻空但远处有动物"被判为可入栏，
 *     view 只能靠换方向绕行出栏（实测 70%+ 的动物会被迫掉头），观感荒谬；
 *   ② 改为走廊语义后：**能入栏的动物，其朝向路径必然全程空 → 直走即可**（掉头/绕行
 *     自然消失）；**被挡的动物点击即沿朝向冲撞到第一占用者身上发生碰撞**（扣心），
 *     与"保持向前并碰撞"完全一致。
 *   实测代价可控：紧密排列下走廊被堵率 61-70%（相邻格为 60.9%），每关仍有 8.9-10.9 只
 *   可入栏（≥6 保底线上），难度带靠 BalanceSim 复测确认。 */
function blockedBy(grid: Grid, b: Animal): Animal | null {
  return firstOnLine(grid, b.col, b.row, b.dir);
}

/** 相邻格遮挡者查询（走廊版 API 兼容：view 层碰撞动画定位用，纯读不耗随机流）。 */
export function blockerOf(herd: Animal[], b: Animal): Animal | null {
  return blockedBy(Grid.build(herd), b);
}

export function isBlocked(herd: Animal[], b: Animal): boolean {
  return blockerOf(herd, b) !== null;
}

/**
 * 出栏走廊占用检测（带方向参数的"是否被挡"，2026-09-09 新增，2026-09-10 19:17 与
 * isBlocked 语义统一）：沿指定方向（缺省 = b.dir）从相邻格扫到边界，任一格被占用即 true。
 * 现语义下 `corridorOccupied(herd, b)` ≡ `isBlocked(herd, b)`；带 dir 的形态供
 * repairUnlocks 评估"换到这个方向是否可入栏"。纯读、不消耗随机流。
 */
export function corridorOccupied(herd: Animal[], b: Animal, dir?: Dir): boolean {
  return lineBlocked(Grid.build(herd), b.col, b.row, dir ?? b.dir);
}

/* 🚫 绕行机制已取消（2026-09-10 19:52，用户指令）：
 *   pickExitDir（换方向绕行出口）与 findExitPath（BFS 穿缝隙寻路）已删除。
 *   走廊遮挡语义下（blockedBy = 沿朝向第一占用者），**能入栏的动物其朝向路径必然全程空**
 *   ⇒ 出栏恒为"沿自身朝向直走"；路径被占 = 被挡 = 点击冲撞扣心，不存在绕行分支。
 *   保留 corridorOccupied 作为"带方向参数的遮挡查询"（语义 = isBlocked，供 repairUnlocks
 *   评估"换到某方向是否可入栏"与回归断言使用）。 */

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

/** 定点修复所有"对冲对"（2026-09-07 23:30 新增，**2026-09-10 21:10 已删除**）：
 *  事后翻转修正在对局中会让玩家看到"动物自己转头"（用户反馈），已被构造式生成
 *  `assignDirsNoHeadOn` 取代——朝向在放置时一次确定，无需事后修正。
 */

/** "线上正对"判定（2026-09-10，用户需求：同一条路线上任意两个动物不方向相对）：
 *  b 是 a 朝向上的第一个占用者，且 a 也是 b 朝向上的第一个占用者——互相面对面，
 *  **距离任意**（中间隔空格也算，正是用户截图圈出的场景）。
 *  与 hasHeadOnPair（相邻 2-环）的关系：相邻正对 ⊂ 线上正对（本函数超集）。
 *  路线被岩石/第三方动物隔开时**不算**——两只各自的"路线"终点是紧邻遮挡者，
 *  视觉与语义上都不构成面对面。纯读、不耗随机流。 */
export function isHeadOnLinePair(grid: Grid, a: Animal, b: Animal): boolean {
  if (a === b || a.obstacle || b.obstacle) return false;
  if (firstOnLine(grid, a.col, a.row, a.dir) !== b) return false;
  return firstOnLine(grid, b.col, b.row, b.dir) === a;
}

/** 全盘是否存在任一"线上正对"对（供回归断言用）。 */
export function hasHeadOnLinePair(herd: Animal[]): boolean {
  const grid = Grid.build(herd);
  for (const a of herd) {
    if (a.obstacle) continue;
    const b = firstOnLine(grid, a.col, a.row, a.dir);
    if (b && !b.obstacle && isHeadOnLinePair(grid, a, b)) return true;
  }
  return false;
}

/** 线上正对修正（2026-09-10 10:41 新增，**2026-09-10 21:10 已删除**）：
 *  事后翻转（含对局中 takeAnimal 接线）会让玩家看到"动物自己转头"——用户明确要求
 *  "朝向应在生成时即固定，未使用道具的情况下全程不得改动"。已由构造式生成
 *  `assignDirsNoHeadOn` 取代：放置时逐只避让冲突，朝向一次定死、全程零改动。
 *  ⚠️ 由此带来的语义变化：**洗牌 / 翻转道具之后不再自动修正**（道具本就是改朝向/位置的
 *  机制，其结果即最终状态）；对局中新出现的"路径正对"是玩家操作的结果，由吊车/翻转/洗牌
 *  等道具自行化解，系统不再静默替玩家转动物。
 */

/**
 * 构造式朝向分配（2026-09-10 21:10 重构，Rush Hour 式放置）：
 *  **位置全部就位后，逐只择优分配朝向并即时检查与已定朝向动物的路径冲突——一次定死，
 *  永不事后翻转**。这是对"事后修正"范式的根本替换（旧实现先生成再翻，玩家会看到转头）。
 *
 * 冲突定义 = 与该动物形成"**路径正对**"（互为对方朝向上的第一个占用者，距离任意）。
 * 构造完备性：新动物只可能与**已定朝向**者冲突（未定朝向者会在自己分配时避开本只），
 *  故逐只检查即可全局零正对——无需任何回退修正。
 * 返回 false = 某只动物 4 个方向皆冲突（该位置组合不可用）→ 调用方重摇位置
 *  （generate 的 do-while 兜底，与 Rush Hour 的"放不下就换位置"同构）。
 * rng 消耗：每只 1~2 次（与旧 smartDir 同量级）。
 */
export function assignDirsNoHeadOn(herd: Animal[], rng: Rng, occupied: Set<number>, pressure: number): boolean {
  const grid = Grid.build(herd);
  // 位置在格上且分配期间不变 ⇒ "各方向第一占用者"一次算完，冲突检测降为 O(1) 查表
  const first = new Map<number, (Animal | null)[]>();
  for (const a of herd) {
    if (a.obstacle) continue;
    first.set(a.uid, DIRS_ORDER.map((d) => firstOnLine(grid, a.col, a.row, d)));
  }
  const dirOf = new Map<number, Dir>();          // uid → 已定朝向（本函数内唯一真相源）
  const conflicts = (a: Animal, d: Dir): boolean => {
    const b = first.get(a.uid)![DIRS_ORDER.indexOf(d)];
    if (!b || b.obstacle) return false;          // 朝空 / 场外 / 岩石 → 永不成正对
    const bd = dirOf.get(b.uid);
    if (bd === undefined) return false;          // b 朝向未定 → 它分配时自会避开本只
    return first.get(b.uid)![DIRS_ORDER.indexOf(bd)] === a;   // b 已定且正对本只 → 冲突
  };
  for (const a of herd) {
    if (a.obstacle) continue;
    const cands = DIRS_ORDER.filter((d) => !conflicts(a, d));
    if (!cands.length) return false;             // 4 向皆冲突 → 位置不可用，交调用方重摇
    a.dir = pickPreferredDir(cands, first.get(a.uid)!, rng, occupied, pressure);
    dirOf.set(a.uid, a.dir);
  }
  return true;
}

/** 在**无冲突候选**里按压力策略择优（语义对齐旧 smartDir，仅先剔除冲突项）：
 *  - 0.5×(1−pressure) 概率优先"朝场外/空线"（第一占用者为 null，天然无冲突）；
 *  - 0.4×pressure 概率优先"指向已占格"（制造遮挡链条，PRD 5.1 高关卡反向偏置）；
 *  - 其余在候选中均匀随机。 */
function pickPreferredDir(cands: Dir[], first4: (Animal | null)[], rng: Rng,
                          occupied: Set<number>, pressure: number): Dir {
  const awayP = 0.5 * (1 - pressure);
  const occP = 0.4 * pressure;
  const roll = rng();
  const away: Dir[] = [], toOcc: Dir[] = [];
  for (const d of cands) {
    const b = first4[DIRS_ORDER.indexOf(d)];
    if (!b) away.push(d);
    else if (occupied.has(b.row * GRID_COLS + b.col)) toOcc.push(d);
  }
  if (roll < awayP && away.length) return away[Math.floor(rng() * away.length)];
  if (roll < awayP + occP && toOcc.length) return toOcc[Math.floor(rng() * toOcc.length)];
  return cands[Math.floor(rng() * cands.length)];
}

/** 网格落位（P1/B3）：从全部 GRID_COLS×GRID_ROWS 格中随机取 n 个不重复格
 *  （Fisher-Yates 部分洗牌，rng 注入）。调用方按序分配给动物/岩石；
 *  n ≤ 60 由 LevelCfg 保证（最大 herdN 34 + rocks 4 = 38）。
 *  P1.5 注：generate 已改用 clusterLayout（t=0 与本函数逐帧同构），本函数保留供
 *  直调与回归对照（density_check 断言两者 t=0 等价）。 */
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

/** 团簇落位（P1.5·阶段A，2026-09-09）：紧密排列生成器——猪了个猪式"动物挤成块"。
 *  算法：全格洗牌一次得 deck（与 gridLayout 同一调用）→ deck 首格为团簇种子 →
 *  逐格填充：以概率 t 从「已选格的未选邻域（frontier）」随机取一格（团簇生长），
 *  否则从 deck 顺序取下一空格（均匀扩散）。
 *  关键同构性质：**t=0 时不掷生长门、纯按 deck 顺序取格，布局与 rng 消耗与 gridLayout
 *  完全一致**——这是开关法对拍（tightness=0 对拍旧快照 12/12）的基点。
 *  t=1 纯团簇（实测 4 邻域均值 3.01 vs 均匀 1.69，被挡率 61% vs 34%，见 grid-scheme-review）。 */
export function clusterLayout(n: number, rng: Rng, t: number): Array<{ col: number; row: number }> {
  const total = GRID_COLS * GRID_ROWS;
  if (n > total) throw new Error('clusterLayout: n=' + n + ' 超过总格数 ' + total);
  const growth = Math.max(0, Math.min(1, t));
  const idx: number[] = [];
  for (let i = 0; i < total; i++) idx.push(i);
  shuffle(idx, rng);
  const taken = new Set<number>();
  const out: Array<{ col: number; row: number }> = [];
  let deckPos = 0;
  const nextDeck = (): number => {
    while (deckPos < total) {
      const v = idx[deckPos++];
      if (!taken.has(v)) return v;
    }
    return -1;
  };
  // frontier：已选格的未选邻域（确定性顺序：pushNeighbors 按 up→down→left→right）
  let frontier: number[] = [];
  const pushNeighbors = (c: number, r: number): void => {
    for (const d of DIRS_ORDER) {
      const [dc, dr] = DIR_DELTA[d];
      const c2 = c + dc, r2 = r + dr;
      if (Grid.outOfBounds(c2, r2)) continue;
      const i2 = r2 * GRID_COLS + c2;
      if (!taken.has(i2) && !frontier.includes(i2)) frontier.push(i2);
    }
  };
  const place = (i: number): void => {
    taken.add(i);
    out.push({ col: i % GRID_COLS, row: Math.floor(i / GRID_COLS) });
    const fi = frontier.indexOf(i);
    if (fi >= 0) frontier.splice(fi, 1);
    pushNeighbors(i % GRID_COLS, Math.floor(i / GRID_COLS));
  };
  place(nextDeck());
  while (out.length < n) {
    if (growth > 0 && frontier.length > 0 && rng() < growth) {
      place(frontier[Math.floor(rng() * frontier.length)]);
    } else {
      place(nextDeck());
    }
  }
  return out;
}

/** 保底修复（P1.5·阶段A4，2026-09-09；2026-09-10 19:17 判据随走廊语义更新）：解锁数
 *  不足 need 时，把部分被挡动物朝向**确定性**翻向"**走廊全空**的方向"（真正可入栏），
 *  取代紧密盘面下低效的整体重摇。
 *  规则：按 uid 升序遍历被挡动物 → 候选方向 = 沿该方向到边界全程无占用（越界=空），
 *  按「到边界步数升序 → DIRS_ORDER 序」排序 → 翻向后若引入"线上正对"（防御性检查，
 *  翻向空走廊理论上不可能，因为空走廊上它不会成为任何人的第一占用者）则试下一候选。
 *  **零 rng 消耗**（不影响种子对拍）；一只都翻不动即放弃，由调用方 do-while 重摇兜底。 */
export function repairUnlocks(herd: Animal[], need: number): void {
  const distToBorder = (a: Animal, d: Dir): number => {
    switch (d) {
      case 'left': return a.col;
      case 'right': return GRID_COLS - 1 - a.col;
      case 'up': return a.row;
      default: return GRID_ROWS - 1 - a.row;
    }
  };
  let guard = 0;
  while (countUnlocked(herd) < need && guard++ <= herd.length * 2) {
    let flipped = false;
    const blockedList = herd
      .filter((a) => !a.obstacle && isBlocked(herd, a))
      .sort((x, y) => x.uid - y.uid);
    for (const a of blockedList) {
      const grid = Grid.build(herd);
      const cands = DIRS_ORDER
        .filter((d) => !lineBlocked(grid, a.col, a.row, d))   // 走廊全空 → 翻向后必然可入栏
        .sort((x, y) => distToBorder(a, x) - distToBorder(a, y));
      for (const d of cands) {
        const old = a.dir;
        a.dir = d;
        if (!hasHeadOnLinePair(herd)) { flipped = true; break; }
        a.dir = old;
      }
      if (flipped && countUnlocked(herd) >= need) return;
    }
    if (!flipped) return;
  }
}

/** 洗牌重排（P1/B4）：全场（动物+岩石）重新落位到随机不重复格，个体身份/朝向不变。
 *  取代旧 scatter 散点重摇——散点版会把网格盘面洗回连续坐标，违反网格语义。
 *  P1.5（2026-09-09）：加 t 参数透传 clusterLayout——洗牌分布与生成器一致，
 *  否则洗牌会把紧密盘面洗回稀疏盘（t=0 与旧 reflow 逐帧同构）。 */
export function reflow(herd: Animal[], rng: Rng, t = 0): void {
  const cells = clusterLayout(herd.length, rng, t);
  for (let k = 0; k < herd.length; k++) {
    herd[k].col = cells[k].col;
    herd[k].row = cells[k].row;
  }
}
