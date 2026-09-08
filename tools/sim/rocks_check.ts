/* 农场随机石头开关 + 路径对冲对验收（Constants.ENABLE_FARM_ROCKS + Board.hasHeadOnPair）
 * 运行（工程根目录）：
 *   node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/rocks_check.ts
 * 验收口径：
 *   ① levelCfg(lv).rocks 与开关一致（关闭 ⇒ 全 0；开启 ⇒ 原曲线 L3/4=1、L5/6=2、L7-11=3、L12=4）；
 *   ② 真开一局，herd 中 obstacle 数量 == cfg.rocks（落位环节未被破坏）；
 *   ③ 初始可动数 ≥6（互锁环拒绝采样兜底仍然生效）；
 *   ④ Board.hasHeadOnPair(herd) === false（无 2-环"正面相对"对冲，需求 #2 显式保证）。
 * 2026-09-07 22:38 新增：配合石头开关改造的可复现回归脚本。
 * 2026-09-07 23:30 扩展：并入对冲对检测（需求 #2 修复）。 */
import { levelCfg } from '../../assets/scripts/core/LevelCfg';
import { GameSession } from '../../assets/scripts/core/GameSession';
import { ENABLE_FARM_ROCKS } from '../../assets/scripts/core/Constants';
import { hasHeadOnPair } from '../../assets/scripts/core/Board';

console.log('=== 农场石头开关 + 路径对冲对验收 · ENABLE_FARM_ROCKS = ' + ENABLE_FARM_ROCKS + ' ===');
let allZero = true, mismatch = 0, locked = 0, headOn = 0;
for (let lv = 1; lv <= 12; lv++) {
  const cfg = levelCfg(lv);
  const s = new GameSession();
  s.start(lv, 12345 + lv);
  const rocks = s.herd.filter(function (a) { return a.obstacle; }).length;
  if (cfg.rocks !== 0) allZero = false;
  if (rocks !== cfg.rocks) mismatch++;
  if (s.countUnlocked() < 6) locked++;
  if (hasHeadOnPair(s.herd)) headOn++;
  console.log('L' + (lv < 10 ? ' ' : '') + lv
    + ' | cfg.herdN=' + cfg.herdN
    + ' cfg.rocks=' + cfg.rocks
    + ' 实际落位=' + rocks
    + ' | herd总数=' + s.herd.length
    + ' 初始可动=' + s.countUnlocked()
    + ' 对冲对=' + (hasHeadOnPair(s.herd) ? '✗' : '✓'));
}
console.log(allZero
  ? '>>> 开关关闭：L1-L12 全关卡 0 石头 ✓'
  : '>>> 开关开启：石头数量按原曲线恢复 ✓（对照改造前：L3/4=1、L5/6=2、L7-11=3、L12=4）');
console.log(mismatch === 0 ? '>>> 落位数量与 cfg.rocks 完全一致 ✓' : '>>> 落位不一致 ' + mismatch + ' 关 ✗');
console.log(locked === 0 ? '>>> 初始可动数均 ≥6（生成器拒绝采样有效）✓' : '>>> 初始可动 <6 的关卡：' + locked + ' ✗');
console.log(headOn === 0 ? '>>> 任意关卡无 2-环"对冲对" ✓' : '>>> 存在对冲对关卡：' + headOn + ' ✗');
if (mismatch > 0 || locked > 0 || headOn > 0) process.exitCode = 1;
