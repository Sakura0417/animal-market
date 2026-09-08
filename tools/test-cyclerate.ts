/* 一次性测量：初始布局互锁环发生率（修复前后对比）。
 * 修改时间：2026-09-07 16:30（P1 网格化：生成改 gridLayout 网格落位 + smartDir(col,row)）
 * 运行：node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/test-cyclerate.ts
 * 逻辑：按 generate() 同款流程生成布局（旧逻辑：只查 un<6），统计 hasBlockCycle 命中率；
 *       新逻辑会把这些布局拒绝重采样，故修复后发生率 = 0（重试上限内）。
 *       P1 语义注：相邻遮挡下环只能为 2/4 长度（网格邻接闭环），预期发生率较走廊版大幅下降。 */
import { GameSession } from '../assets/scripts/core/GameSession';
import { hasBlockCycle, gridLayout, smartDir } from '../assets/scripts/core/Board';
import { levelCfg } from '../assets/scripts/core/LevelCfg';
import { TYPES } from '../assets/scripts/core/Constants';
import { Animal } from '../assets/scripts/core/Types';

const s = new GameSession();
s.start(1); // 仅借用 rng/schema

for (let lv = 1; lv <= 12; lv += 3) {
  const cfg = levelCfg(lv);
  let hit = 0;
  const N = 400;
  for (let n = 0; n < N; n++) {
    const cells = gridLayout(cfg.herdN + cfg.rocks, s.rng);
    const herd: Animal[] = [];
    for (let m = 0; m < cfg.herdN; m++) {
      const a = new Animal({
        uid: m + 1, type: TYPES[m % cfg.typeCount], dir: 'up',
        rare: s.rng() < cfg.rareP, obstacle: false,
      });
      a.col = cells[m].col; a.row = cells[m].row;
      a.dir = smartDir(a.col, a.row, s.rng);
      herd.push(a);
    }
    for (let r = 0; r < cfg.rocks; r++) {
      const rock = new Animal({ uid: 1000 + r, type: TYPES[0], dir: 'up', rare: false, obstacle: true });
      rock.col = cells[cfg.herdN + r].col; rock.row = cells[cfg.herdN + r].row;
      herd.push(rock);
    }
    if (hasBlockCycle(herd)) hit++;
  }
  console.log(`L${lv}: 互锁环发生率 ${((hit / N) * 100).toFixed(1)}%（${hit}/${N}）`);
}
