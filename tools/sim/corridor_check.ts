/* 遮挡/走廊语义回归（2026-09-10 19:17 语义统一后重写；原"走廊 vs 相邻"差异已消除）
 * 背景：原实现为"相邻格遮挡"（只判相邻 1 格），导致"相邻空但远处有动物"被判可入栏，
 *   view 只能靠"换方向绕行"出栏（实测 70%+ 动物被迫掉头，用户反馈"不符合逻辑"）。
 *   现统一为**走廊遮挡**：朝向路径上的第一个占用者即遮挡者 → 能入栏的必然直走通畅、
 *   被挡的点击即沿朝向冲撞到该占用者。本脚本锁定该语义，防止回退。
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/corridor_check.ts */
import { Animal as AnimalC } from '../../assets/scripts/core/Types';
import { TYPE_MAP } from '../../assets/scripts/core/Constants';
import { assignDirsNoHeadOn, blockerOf, corridorOccupied, hasHeadOnLinePair, hasHeadOnPair, isBlocked } from '../../assets/scripts/core/Board';
import { GRID_COLS } from '../../assets/scripts/core/Constants';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function mk(uid: number, col: number, row: number, dir: 'up' | 'down' | 'left' | 'right', obstacle = false) {
  const a = new AnimalC({ uid: uid, type: TYPE_MAP['chicken'], dir: dir, rare: false, obstacle: obstacle });
  a.col = col;
  a.row = row;
  return a;
}

console.log('--- T1 走廊语义核心：相邻格空、但同线远处有动物 → 被挡（点击冲撞而非绕行） ---');
{
  const a = mk(1, 1, 5, 'right');        // 朝右，(2,5) 空
  const b = mk(2, 3, 5, 'up');           // 第 2 格处挡路
  ok('isBlocked=true（走廊遮挡）', isBlocked([a, b], a) === true);
  ok('corridorOccupied=true（与遮挡判定同语义）', corridorOccupied([a, b], a) === true);
  ok('blockerOf 返回该远处遮挡者（冲撞目标定位）', blockerOf([a, b], a) === b);
}

console.log('--- T2 遮挡者取"沿朝向的第一个"（不是数组序首个） ---');
{
  const a = mk(1, 0, 5, 'right');
  const near = mk(2, 2, 5, 'up');
  const far = mk(3, 4, 5, 'up');
  ok('返回最近的 near（数组序在前的 far 不干扰）', blockerOf([a, far, near], a) === near);
  ok('near 被移除后返回 far', blockerOf([a, far], a) === far);
}

console.log('--- T3 走廊清空 → 未被挡（可入栏且直走必然通畅） ---');
{
  const a = mk(1, 1, 5, 'right');
  const b = mk(2, 3, 7, 'up');           // 不在同一行 → 不在走廊上
  ok('corridorOccupied=false', corridorOccupied([a, b], a) === false);
  ok('isBlocked=false（可点击入栏）', isBlocked([a, b], a) === false);
}

console.log('--- T4 边界朝外：越界视为空 → 未被挡 ---');
{
  const a = mk(1, 5, 5, 'right');        // col=5 是最右列，右侧越界
  ok('corridorOccupied=false（朝场外可走出）', corridorOccupied([a], a) === false);
  ok('isBlocked=false', isBlocked([a], a) === false);
}

console.log('--- T5 岩石同样算走廊占用（不可选但挡路） ---');
{
  const a = mk(1, 1, 5, 'right');
  const rock = mk(2, 4, 5, 'up', true);
  ok('corridorOccupied=true', corridorOccupied([a, rock], a) === true);
  ok('blockerOf 返回岩石（碰撞目标含岩石）', blockerOf([a, rock], a) === rock);
}

console.log('--- T6 纵向走廊（up/down）同样生效 ---');
{
  const a = mk(1, 2, 7, 'down');         // 向下，(2,8) 空、(2,9) 有动物
  const b = mk(2, 2, 9, 'up');
  ok('down 走廊被占=true', corridorOccupied([a, b], a) === true);
  const c = mk(3, 2, 7, 'up');           // 向上，(2,6)...(2,0) 全空
  ok('up 走廊干净=false', corridorOccupied([c, b], c) === false);
}

console.log('--- T7 构造式朝向分配：放置即无路径正对（Rush Hour 式，2026-09-10 21:10） ---');
{
  // 三只动物在同列固定位置：构造式分配必须让每只的选择都不与已定朝向者形成"路径正对"——
  // 一次定死、零事后翻转（旧实现先生成再 breakAllHeadOnLines 翻转 = 玩家可见的"自己转头"）。
  const herd = [mk(1, 2, 2, 'up'), mk(2, 2, 5, 'up'), mk(3, 2, 8, 'up')];
  const occupied = new Set(herd.map(a => a.row * GRID_COLS + a.col));
  const assigned = assignDirsNoHeadOn(herd, () => 0.5, occupied, 0);
  ok('分配成功（无不可放置位置）', assigned === true);
  ok('生成后 0 线上正对', hasHeadOnLinePair(herd) === false);
  ok('生成后 0 相邻对冲对', hasHeadOnPair(herd) === false);
}

console.log('\npass=' + pass + ' fail=' + fail + (fail === 0 ? ' ✓' : ' ✗'));
if (fail > 0) process.exitCode = 1;
console.log(fail === 0 ? '>>> 遮挡/走廊语义回归全部通过 ✓' : '>>> 存在失败用例 ✗');
