/* 满载判败判定回归（isFenceHopeless）· 无头 Node 测试（core 零 cc 依赖可直接跑）。
 * 修改时间：2026-09-07 16:30（P1 网格化：Animal 改类构造，fence 动物 col/row 任意——不参与遮挡判定）
 * 场景 A（用户截图）：围栏满 7 只（含 2 鸡），在场订单含"鸡×2"→ 应判 NOT hopeless（继续游戏）；
 * 场景 B：围栏满 7 只，在场订单都要鸭、围栏无鸭 → 应判 hopeless（弹挤爆救援面板）。
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/test-hopeless.ts */
import { GameSession } from '../assets/scripts/core/GameSession';
import { TYPE_MAP } from '../assets/scripts/core/Constants';
import { Animal } from '../assets/scripts/core/Types';

const s = new GameSession();
s.start(3);
let uid = 900;
const mk = (id: string): Animal => {
  const a = new Animal({ uid: uid++, type: TYPE_MAP[id], dir: 'up', rare: false, obstacle: false });
  return a;
};

// —— 场景 A：围栏满 7（含 2 鸡），slot0 订单=鸡×2（用户截图：两只鸡已满足订单）——
s.herd = [{ ...mk('pig') }];
s.fence = [mk('rabbit'), mk('rabbit'), mk('chicken'), mk('sheep'), mk('chicken'), mk('rabbit'), mk('duck')];
s.slots[0] = { state: 'truck', order: { items: { chicken: 2 }, value: 40 }, loaded: null };
s.slots[1] = { state: 'truck', order: { items: { duck: 2 }, value: 20 }, loaded: null };
s.slots[2] = { state: 'empty', order: null, loaded: null };
const A = s.isFenceHopeless();
console.log(`A 围栏满+鸡×2满足在场订单 → hopeless=${A} ${A === false ? '✓ 正确（继续游戏，不弹失败）' : '✗ 误判（会错误弹出失败）'}`);

// —— 场景 B：订单都要鸭、围栏一只鸭都没有（换无鸭围栏）→ 真 hopeless ——
s.fence = [mk('rabbit'), mk('rabbit'), mk('chicken'), mk('sheep'), mk('chicken'), mk('rabbit'), mk('pig')];
s.slots[0] = { state: 'truck', order: { items: { duck: 2 }, value: 20 }, loaded: null };
s.slots[1] = { state: 'truck', order: { items: { duck: 1 }, value: 10 }, loaded: null };
const B = s.isFenceHopeless();
console.log(`B 围栏满+无鸭可满足订单 → hopeless=${B} ${B === true ? '✓ 正确（弹挤爆救援面板）' : '✗ 误判'}`);

// —— 场景 C：围栏满、鸡×1 + 订单鸡×1（部分满足也算可继续）——
s.fence = [mk('chicken'), mk('rabbit'), mk('rabbit'), mk('sheep'), mk('rabbit'), mk('duck'), mk('pig')];
s.slots[0] = { state: 'truck', order: { items: { chicken: 1 }, value: 10 }, loaded: null };
const C = s.isFenceHopeless();
console.log(`C 围栏满+鸡×1满足鸡×1订单 → hopeless=${C} ${C === false ? '✓ 正确' : '✗ 误判'}`);

const pass = A === false && B === true && C === false;
console.log(pass ? '>>> 满载判败判定全部通过 ✓' : '>>> 存在误判 ✗');
if (!pass) process.exitCode = 1;
