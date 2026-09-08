/* 边界验证（2026-09-06 19:09 四项改造后的回归工具）：
 *   T1 同 seed 双跑一致（Req 3 种子调度）
 *   T2 每车 ≥2 只硬约束（Req 4）
 *   T3 末车模式白盒验证：手工构造 totalAvail=1..6 场态，一次 makeOrder 断言精确收完
 *   T4 看广告解锁车位后新车 ≥2（Req 4）
 *   T5 满载判败 isFenceHopeless 白盒（2026-09-06 23:00 需求 3）：围栏满 + 有无可满足订单的四种组合
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/boundary_check.ts */
import type { Animal } from '../../assets/scripts/core/Types';
import { Animal as AnimalC } from '../../assets/scripts/core/Types';
import { TYPE_MAP } from '../../assets/scripts/core/Constants';
import { GameSession } from '../../assets/scripts/core/GameSession';

/** 白盒构造：herd 恰好 n 只指定类型动物（无石头），slots 全清空（reserved=0）。
 *  P1 网格化（2026-09-07）：Animal 为类，col/row 落 0/0（互不相邻判定不依赖绝对位置，
 *  全部同格属防御外值——Grid.build 首到占格，本用例只走 makeOrder/订单链，不触发遮挡判定）。 */
function makeBareSession(n: number, typeId: string, seed: number): { s: GameSession; animals: Animal[] } {
  const s = new GameSession();
  s.start(1, seed);
  s.slots.forEach(sl => { sl.state = 'empty'; sl.order = null; });
  s.herd = [];
  const animals: Animal[] = [];
  for (let k = 0; k < n; k++) {
    const a = new AnimalC({ uid: k + 1, type: TYPE_MAP[typeId], dir: 'up', rare: false, obstacle: false });
    a.col = k % 6;
    a.row = Math.floor(k / 6) + 2;
    animals.push(a);
    s.herd.push(a);
  }
  s.fence = [];
  return { s: s, animals: animals };
}

console.log('--- T1 同 seed 双跑一致性 ---');
let mismatch = 0;
for (let trial = 0; trial < 20; trial++) {
  const s1 = new GameSession(), s2 = new GameSession();
  const seed = (trial * 7919 + 0xC0FFEE) >>> 0;
  s1.start(5, seed); s2.start(5, seed);
  if (JSON.stringify(s1.slots.map(sl => sl.order)) !== JSON.stringify(s2.slots.map(sl => sl.order))) {
    mismatch++; console.log('  ✗ trial=' + trial + ' seed=' + seed);
  }
}
console.log('  trials=20 mismatches=' + mismatch + (mismatch === 0 ? ' ✓' : ' ✗'));

console.log('--- T2 每辆车 ≥2 只硬约束（30 局 × 10 步采样） ---');
let under2 = 0, totalOrders = 0;
for (let trial = 0; trial < 30; trial++) {
  const s = new GameSession();
  s.start(5, trial * 13 + 7);
  for (let step = 0; step < 10; step++) {
    if (s.phase !== 'play') break;
    s.activeOrders().forEach(slot => {
      totalOrders++;
      const total = Object.values(slot.order!.items).reduce((sum, v) => sum + v, 0);
      if (total < 2) under2++;
    });
    const unlocked = s.unlockedSet();
    if (unlocked.length > 0) s.takeAnimal(unlocked[0]);
    let safety = 0;
    while (s.findMatch() && safety++ < 5) s.fulfillNow(s.findMatch()!);
    if (safety >= 5) break;
  }
}
console.log('  totalOrders=' + totalOrders + ' under2=' + under2 + (under2 === 0 ? ' ✓' : ' ✗'));

console.log('--- T3 末车模式白盒验证（totalAvail=1..6，一次构造） ---');
let t3pass = 0, t3fail = 0;
const t3fails: string[] = [];
// 覆盖：单种 1..6、两种 2+3=5、三种 2+2+2=6、极端单种 1（应 return null）
const cases: Array<{ n: number; kinds: string[] }> = [
  // n=1：尾单豁免（清仓/放生破坏偶数不变量后可用剩 1，发 1 只收尾单防软锁）
  // n=3/5：奇数场态仅清仓后可达；末车"全收"语义下 sum===n 即不搁浅，奇偶不限
  { n: 1, kinds: ['chicken'] },
  { n: 2, kinds: ['chicken'] },
  { n: 3, kinds: ['chicken'] },
  { n: 5, kinds: ['chicken'] },
  { n: 6, kinds: ['chicken'] },
  { n: 5, kinds: ['chicken', 'duck'] },
  { n: 6, kinds: ['chicken', 'duck', 'rabbit'] },
];
for (let ci = 0; ci < cases.length; ci++) {
  const c = cases[ci];
  for (let trial = 0; trial < 5; trial++) {
    const typeId = c.kinds[trial % c.kinds.length];
    const { s } = makeBareSession(c.n, typeId, 12345 + ci * 100 + trial);
    const o = s.makeOrder();
    if (!o) { t3fail++; t3fails.push('n=' + c.n + ' 意外 null'); continue; }
    const sum = Object.values(o.items).reduce((a, b) => a + b, 0);
    // 精确收完：sum === n（reserved=0 时 totalAvail === n），不遗漏、不超收
    if (sum === c.n) t3pass++;
    else { t3fail++; t3fails.push('n=' + c.n + ' sum=' + sum + ' items=' + JSON.stringify(o.items)); }
  }
}
console.log('  pass=' + t3pass + ' fail=' + t3fail + (t3fail === 0 ? ' ✓' : ' ✗'));
t3fails.forEach(f => console.log('    ✗ ' + f));

console.log('--- T4 看广告解锁车位后新车 ≥2 ---');
let unlockOrders = 0, unlockUnder2 = 0;
for (let trial = 0; trial < 30; trial++) {
  const s = new GameSession();
  s.start(5, trial * 17 + 11);
  for (let step = 0; step < 5; step++) {
    if (s.phase !== 'play') break;
    const unlocked = s.unlockedSet();
    if (unlocked.length > 0) s.takeAnimal(unlocked[0]);
    let safety = 0;
    while (s.findMatch() && safety++ < 5) s.fulfillNow(s.findMatch()!);
    if (safety >= 5) break;
  }
  s.unlockSlot(3);
  const slot3Order = s.slots[3].order;
  if (slot3Order) {
    unlockOrders++;
    const total = Object.values(slot3Order.items).reduce((sum, v) => sum + v, 0);
    if (total < 2) unlockUnder2++;
  }
}
console.log('  unlockSlot 后订单=' + unlockOrders + ' under2=' + unlockUnder2 + (unlockOrders > 0 && unlockUnder2 === 0 ? ' ✓' : ' ✗'));

console.log('--- T5 满载判败 isFenceHopeless 白盒（需求 3：围栏满 + 有无可满足订单） ---');
/** 白盒构造：fence 灌满 n 只 chicken，slots 由用例自设（fence 动物不参与网格遮挡） */
function fenceFullSession(n: number): GameSession {
  const s = new GameSession();
  s.start(1, 42);
  s.slots.forEach(sl => { sl.state = 'empty'; sl.order = null; });
  s.herd = [];
  s.fence = [];
  for (let k = 0; k < n; k++) {
    const a = new AnimalC({ uid: k + 1, type: TYPE_MAP['chicken'], dir: 'up', rare: false, obstacle: false });
    a.col = k % 6;
    a.row = Math.floor(k / 6) + 2;
    s.fence.push(a);
  }
  return s;
}
let t5pass = 0, t5fail = 0;
function t5check(name: string, cond: boolean): void {
  if (cond) { t5pass++; console.log('  ✓ ' + name); } else { t5fail++; console.log('  ✗ ' + name); }
}
{
  // ① 未满载（6 只）→ 永不判败
  const s = fenceFullSession(6);
  s.slots[0] = { state: 'truck', order: { items: { chicken: 2 }, value: 20 }, loaded: null };
  t5check('未满(6) + 有订单 → false', s.isFenceHopeless() === false);
}
{
  // ② 满载且存在可满足订单 → false（应装车放行，不判败）
  const s = fenceFullSession(7);
  s.slots[0] = { state: 'truck', order: { items: { chicken: 2 }, value: 20 }, loaded: null };
  t5check('满载 + 有可满足订单 → false', s.isFenceHopeless() === false);
}
{
  // ③ 满载且所有 truck 订单均不可满足（种类不符）→ true
  const s = fenceFullSession(7);
  s.slots[0] = { state: 'truck', order: { items: { duck: 3 }, value: 30 }, loaded: null };
  s.slots[1] = { state: 'truck', order: { items: { rabbit: 2 }, value: 24 }, loaded: null };
  t5check('满载 + 全部订单种类不符 → true', s.isFenceHopeless() === true);
}
{
  // ④ 满载 + 多类订单缺一类 → true
  const s = fenceFullSession(7);
  s.slots[0] = { state: 'truck', order: { items: { chicken: 2, duck: 1 }, value: 26 }, loaded: null };
  t5check('满载 + 多类订单缺鸭 → true', s.isFenceHopeless() === true);
}
{
  // ⑤ 满载 + 数量不足（要 9 鸡只有 7）→ true；非 truck 槽位不参与判定
  const s = fenceFullSession(7);
  s.slots[0] = { state: 'truck', order: { items: { chicken: 9 }, value: 72 }, loaded: null };
  s.slots[1] = { state: 'locked', order: { items: { chicken: 1 }, value: 8 } } as never;
  t5check('满载 + 数量不足 → true（locked 槽不参与）', s.isFenceHopeless() === true);
}
console.log('  pass=' + t5pass + ' fail=' + t5fail + (t5fail === 0 ? ' ✓' : ' ✗'));

const allOk = mismatch === 0 && under2 === 0 && t3fail === 0 && unlockUnder2 === 0 && unlockOrders > 0 && t5fail === 0;
console.log(allOk ? '>>> 边界验证全部通过 ✓' : '>>> 存在失败项，见上 ✗');
if (!allOk) process.exitCode = 1;
