/* BalanceSim CLI（在工程根目录运行）：
 *   node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts            → L1-L12 曲线扫描（各 400 局）
 *   node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts 5 1600     → 单关深测
 *   node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts verify 100 → core 自身快照对拍
 * （已配 npm scripts：npm run sim / sim:check / sim:verify）
 *
 * 2026-09-06 19:36 基准切换（用户拍板）：verify 不再与原型 _sim-trace.js 对拍。
 * 根因：吊车 4→3（PRD 2.0 §5.4）+ 末车模式 + 调度洗牌使 core 随机流轨迹必然偏离原型，
 * 旧对拍 11/12 失真是规则变更的预期结果（对齐文档 D4 预判「种子对拍基准必然失效」）。
 * 新语义：首次运行生成快照 tools/sim/baseline-snapshot.json；此后任何 core 改动
 * 必须与快照逐行一致（同 seed 复现），否则即引入了非预期随机流变化。 */
import { mulberry32 } from './prng.mjs';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { curveScan, simulateLevel } from './BalanceSim';

const arg1 = process.argv[2];
const SNAPSHOT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'baseline-snapshot.json');

interface Snapshot {
  version: number;
  createdAt: string;
  note: string;
  games: number;
  lines: Record<string, string>;
}

if (arg1 === 'verify') {
  const exists = existsSync(SNAPSHOT_PATH);
  const snap: Snapshot | null = exists ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null;
  // 已有快照时以快照记录的局数为准（保证对比条件一致）；首次生成用 CLI 参数（默认 100）
  const games = snap ? snap.games : (parseInt(process.argv[3], 10) || 100);

  if (!snap) {
    console.log('=== 首次运行：生成 core 自身基准快照（L1-L12 · 各 ' + games + ' 局） ===');
    const lines: Record<string, string> = {};
    for (let lv = 1; lv <= 12; lv++) {
      const seed = (0xC0FFEE + lv * 7919) >>> 0;
      Math.random = mulberry32(seed);
      lines[String(lv)] = simulateLevel(lv, games).line;
    }
    const out: Snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      note: 'core 自身种子对拍基准（2026-09-06 19:36 起，替代原型 _sim-trace.js 对拍；规则变更：吊车3/末车模式/调度洗牌）',
      games: games,
      lines: lines
    };
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(out, null, 2), 'utf8');
    console.log('>>> 快照已写入 ' + SNAPSHOT_PATH);
    console.log('>>> 后续 core 改动请重跑 npm run sim:verify，与该快照逐行比对。');
  } else {
    console.log('=== core 自身快照对拍（L1-L12 · 各 ' + games + ' 局 · 快照建立于 ' + snap.createdAt + '） ===');
    console.log('判定：同 seed 下随机流一致 ⇒ 输出行与快照完全一致 ⇒ 本次改动未扰动随机流');
    let pass = 0, fail = 0;
    for (let lv = 1; lv <= 12; lv++) {
      const seed = (0xC0FFEE + lv * 7919) >>> 0;
      Math.random = mulberry32(seed);
      const mine = simulateLevel(lv, games).line;
      const refLine = snap.lines[String(lv)] || '';
      const ok = mine === refLine;
      if (ok) pass++; else fail++;
      console.log('L' + (lv < 10 ? ' ' : '') + lv + ' ' + (ok ? '✓ 一致' : '✗ 偏离'));
      if (!ok) {
        console.log('  快照: ' + refLine);
        console.log('  当前: ' + mine);
      }
    }
    console.log(fail === 0
      ? '>>> 随机流零扰动 ✓（' + pass + '/12 关与快照一致）'
      : '>>> 随机流被扰动：' + fail + ' 关偏离快照！若是预期规则变更，请删除快照文件重新生成。');
    if (fail > 0) process.exitCode = 1;
  }
} else if (arg1 && parseInt(arg1, 10) >= 1) {
  const lv = parseInt(arg1, 10);
  const games = parseInt(process.argv[3], 10) || 1600;
  console.log('=== 动物集市 单关深测 · L' + lv + ' · ' + games + ' 局 ===');
  const r = simulateLevel(lv, games);
  console.log(r.line);
} else {
  curveScan();
}
