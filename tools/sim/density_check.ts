/* 紧密化回归（P1.5，2026-09-09 新增，docs/grid-scheme-review-20260909.md）：
 *   T1 clusterLayout(t=0) 与 gridLayout 逐帧同构（同 rng 流 → 同布局，开关法对拍基点）
 *   T2 团簇紧密度：t=1 的 4 邻域均值显著高于 t=0（紧密排列生效的直接证据）
 *   T3 GameSession 实跑：紧密盘面初始被挡率显著高于旧均匀盘面（玩法效力恢复）
 *   T4 repairUnlocks：解锁不足时确定性修复至 ≥need（且零 rng 消耗、无对冲对）
 *   T5 全盘防御：generate 后 0 对冲对 / 0 互锁环 / 0 线上正对
 *   T6 朝向稳定性：对局操作全程不得改动朝向（2026-09-10 用户需求）
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/density_check.ts */
import type { Animal } from '../../assets/scripts/core/Types';
import { Animal as AnimalC } from '../../assets/scripts/core/Types';
import { GRID_COLS, GRID_ROWS, TYPE_MAP } from '../../assets/scripts/core/Constants';
import { clusterLayout, gridLayout, hasBlockCycle, hasHeadOnLinePair, hasHeadOnPair, isBlocked, repairUnlocks } from '../../assets/scripts/core/Board';
import { GameSession } from '../../assets/scripts/core/GameSession';
import { levelCfg } from '../../assets/scripts/core/LevelCfg';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 4 邻域平均占用数（紧密度指标：纯随机理论值 ≈ 4×填充率×3.4/4，紧密满块 ≈ 3.3） */
function avgNeighbors(cells: Array<{ col: number; row: number }>): number {
  const occ = new Set(cells.map((p) => p.row * GRID_COLS + p.col));
  const DELTA = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let sum = 0;
  for (const p of cells) {
    for (const [dc, dr] of DELTA) {
      const c2 = p.col + dc, r2 = p.row + dr;
      if (c2 >= 0 && c2 < GRID_COLS && r2 >= 0 && r2 < GRID_ROWS && occ.has(r2 * GRID_COLS + c2)) sum++;
    }
  }
  return sum / cells.length;
}

console.log('--- T1 clusterLayout(t=0) 与 gridLayout 逐帧同构 ---');
{
  let same = true;
  for (let trial = 0; trial < 50 && same; trial++) {
    const seed = 1000 + trial * 17;
    const a = gridLayout(30, mulberry32(seed));
    const b = clusterLayout(30, mulberry32(seed), 0);
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
  }
  ok('50 组同 seed：t=0 布局与 gridLayout 完全一致', same);
}

console.log('--- T2 团簇紧密度（n=30，400 组平均） ---');
{
  let s0 = 0, s1 = 0;
  for (let trial = 0; trial < 400; trial++) {
    const seed = 2000 + trial * 31;
    s0 += avgNeighbors(clusterLayout(30, mulberry32(seed), 0));
    s1 += avgNeighbors(clusterLayout(30, mulberry32(seed), 1));
  }
  console.log('  4邻域均值：t=0 → ' + (s0 / 400).toFixed(2) + '，t=1 → ' + (s1 / 400).toFixed(2));
  ok('t=1 紧密度显著高于 t=0（≥1.6 倍）', s1 / s0 >= 1.6);
  ok('t=1 接近紧密排列水平（≥2.7）', s1 / 400 >= 2.7);
}

console.log('--- T3 GameSession 实跑：L8/L10/L12 初始被挡率（各 300 局） ---');
{
  const old = new Map<number, number>([[8, 32.2], [10, 32.2], [12, 32.2]]); // 均匀盘面基线（grid-scheme-review 探针）
  let allUp = true;
  for (const lv of [8, 10, 12]) {
    let blocked = 0, n = 0;
    for (let g = 0; g < 300; g++) {
      const s = new GameSession();
      s.start(lv, 50000 + g * 7);
      const herd: Animal[] = s.herd;
      for (const a of herd) {
        if (a.obstacle) continue;
        if (isBlocked(herd, a)) blocked++;
        n++;
      }
    }
    const pct = (blocked / n) * 100;
    console.log('  L' + lv + ' 初始被挡率 ' + pct.toFixed(1) + '%（旧均匀盘面 ≈ ' + old.get(lv) + '%）');
    if (pct <= old.get(lv)!) allUp = false;
  }
  ok('三关被挡率全部显著高于旧均匀盘面（遮挡效力恢复）', allUp);
}

console.log('--- T4 repairUnlocks：解锁不足 → 确定性修复（零 rng、无对冲对） ---');
{
  function mk2(uid: number, col: number, row: number, dir: 'up' | 'down' | 'left' | 'right'): Animal {
    const a = new AnimalC({ uid, type: TYPE_MAP['chicken'], dir, rare: false, obstacle: false });
    a.col = col; a.row = row;
    return a;
  }
  // 构造：中心 4-环互挡链（(2,4)→(2,3)→(1,3)→(1,4)→(2,4) 全被挡）+ 3 只场外朝向解锁动物
  //   → 初始解锁 3 < 6；周围大量空格 → 每只被挡动物都有"空格/场外"方向可翻。
  const herd: Animal[] = [
    mk2(1, 2, 4, 'up'),    // 挡于 (2,3)
    mk2(2, 2, 3, 'left'),  // 挡于 (1,3)
    mk2(3, 1, 3, 'down'),  // 挡于 (1,4)
    mk2(4, 1, 4, 'right'), // 挡于 (2,4)
    mk2(5, 5, 5, 'up'),    // 解锁（目标 (5,4) 空）
    mk2(6, 0, 7, 'up'),    // 解锁（目标 (0,6) 空）
    mk2(7, 5, 9, 'down'),  // 解锁（朝场外越界）
  ];
  const beforeUnlocked = herd.filter((x) => !isBlocked(herd, x)).length;
  repairUnlocks(herd, 6);
  const after = herd.filter((x) => !isBlocked(herd, x)).length;
  ok('修复前解锁数 3 < 6（构造成立）', beforeUnlocked === 3);
  ok('修复后解锁数 ≥ 6（' + beforeUnlocked + ' → ' + after + '）', after >= 6);
  ok('修复不引入对冲对', !hasHeadOnPair(herd));
  const snap1 = JSON.stringify(herd.map((x) => [x.uid, x.dir]));
  repairUnlocks(herd, 6);
  ok('幂等：已达标时二次调用不改盘面', snap1 === JSON.stringify(herd.map((x) => [x.uid, x.dir])));
}

console.log('--- T5 全盘防御：generate 后 0 对冲对 / 0 互锁环 / 0 线上正对（紧密盘面） ---');
{
  let bad = 0, badLine = 0, tries = 0;
  for (let lv of [4, 8, 12, 20]) {
    for (let g = 0; g < 100; g++) {
      const s = new GameSession();
      s.start(lv, 90000 + g * 13);
      tries++;
      if (hasHeadOnPair(s.herd) || hasBlockCycle(s.herd)) bad++;
      if (hasHeadOnLinePair(s.herd)) badLine++;
    }
  }
  ok('400 局（L4/8/12/20）0 对冲对 / 0 互锁环', bad === 0);
  ok('400 局 0 线上正对（含隔空对峙，2026-09-10 需求）', badLine === 0);
}

console.log('--- T6 朝向稳定性：对局操作全程不得改动动物的朝向（用户需求 2026-09-10 21:10） ---');
{
  let changed = 0, moves = 0;
  for (let lv of [6, 8, 12]) {
    for (let g = 0; g < 60; g++) {
      const s = new GameSession();
      s.start(lv, 800000 + g * 37);
      const snap = new Map<number, string>();
      for (const a of s.herd) if (!a.obstacle) snap.set(a.uid, a.dir);
      let guard = 0;
      while (s.phase === 'play' && guard++ < 400) {
        const cands = s.herd.filter((a: Animal) => !a.obstacle && !isBlocked(s.herd, a));
        if (!cands.length) break;
        s.takeAnimal(cands[0].uid);      // 移走一只 → 旧实现在此处翻转动物的朝向（已废止）
        moves++;
        for (const a of s.herd) {
          if (a.obstacle) continue;
          const d0 = snap.get(a.uid);
          if (d0 !== undefined && d0 !== a.dir) changed++;   // 在场动物朝向被系统改动 = 违规
        }
      }
    }
  }
  console.log('  共模拟 ' + moves + ' 次拿取');
  ok('对局操作全程未改动任何动物朝向（朝向生成即定死）', changed === 0);
}

console.log('\npass=' + pass + ' fail=' + fail + (fail === 0 ? ' ✓' : ' ✗'));
if (fail > 0) process.exitCode = 1;
console.log(fail === 0 ? '>>> 紧密化回归全部通过 ✓' : '>>> 存在失败用例 ✗');
