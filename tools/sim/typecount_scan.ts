/* typeCount 扫描（2026-09-06 23:41，一次性咨询脚本）：动物种类数对难度的影响量化。
 * 3-6 用现有种类；7-8 注入占位种类（仅本进程 headless，不触碰 schema/Draw2D/快照）。
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/typecount_scan.ts */
import { TYPES, TYPE_MAP } from '../../assets/scripts/core/Constants';
import { setTypeCountOverride, simulateLevel } from './BalanceSim';

/* 占位种类：core 层只需要 id/name/price/rareMultiplier（Draw2D 是 view 层，headless 不涉及） */
[['gray', '灰', 20], ['fox', '狐', 22]].forEach(([id, name, price], i) => {
  if (!TYPE_MAP[id]) {
    const t = { id, name, price, rareMultiplier: 3, art: 'vector' as const, resourcePath: '' };
    TYPES.push(t);
    TYPE_MAP[id] = t;
  }
  void i;
});

const GAMES = 150;
const LEVELS = [3, 6, 9, 12];

console.log('=== typeCount 扫描 · 各 ' + GAMES + ' 局（贪心机器人，类型分布 m % typeCount） ===');
console.log('基线参考：L3 一审 99% / L6 82% / L9 78% / L12 66%（当前 typeCount 3/4/5/5 爬坡）');
console.log('');
for (let tc = 3; tc <= 8; tc++) {
  setTypeCountOverride(tc);
  const parts: string[] = [];
  for (const lv of LEVELS) {
    const r = simulateLevel(lv, GAMES);
    const firstPass = (r.rawWin / r.games * 100).toFixed(0).padStart(3, ' ');
    const recovered = (r.win / r.games * 100).toFixed(0).padStart(3, ' ');
    parts.push('L' + lv + ' 一审' + firstPass + '% 恢复' + recovered + '%');
  }
  console.log('种类 ' + tc + ' ： ' + parts.join(' ｜ '));
}
setTypeCountOverride(null);
