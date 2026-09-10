/* BalanceSim：难度曲线回归模拟器（P2）· 复用 core 层 GameSession，策略与原型 _sim-trace.js 逐行对齐
 * 随机流对齐要点（种子对拍零失真的前提）：
 *   1) core 移植时把视觉随机量（rot 倾斜）剥离到 view 层，随机调用序列与 _sim-trace.js 完全一致
 *   2) 机器人直接操作 session.herd/fence（与 _sim-trace.js 一致），救援计数用 session 自带计数器
 *   3) reconcileSync 用同步版装车链：fulfillNow = 装车结算 + 空位补车，死单走 abandonOrder
 * 机器人策略（理性玩家下限）：优先拿订单缺口的无遮挡动物；围栏≥6 只拿缺口类型；
 *   围栏满无法装车 = 挤爆失败；全被挡时依次用救援链：吊车 → 翻转 → 洗牌（广告可续）
 * 2026-09-07 16:30 P1 网格化：洗牌分支改 Board.reflow（空格间重排），移除 scatter/MIN_D。
 * 2026-09-06 19:09 改造：Board.randDir/scatter 不再直接读全局 Math.random，
 *   必须从 session.rng 取，保证种子对拍链路（run.ts verify）行为一致。 */
import type { Animal, LevelConfig } from '../../assets/scripts/core/Types';
import { countFence, countUnlocked, isBlocked, randDir, reflow } from '../../assets/scripts/core/Board';
import { GameSession } from '../../assets/scripts/core/GameSession';
import { levelCfg } from '../../assets/scripts/core/LevelCfg';
import { FENCE_MAX, SLOT_TOTAL } from '../../assets/scripts/core/Constants';

/** typeCount 覆盖钩子（2026-09-06 23:41 新增，typecount_scan 扫描专用，null = 默认 levelCfg 值）。
 *  注入点在 runBot 的 S.start 之后：改写 cfg.typeCount 后重新 generate+tryDispatch。
 *  仅影响本模拟器会话，不触碰 core 与快照对拍基准。 */
let typeCountOverride: number | null = null;
export function setTypeCountOverride(v: number | null): void { typeCountOverride = v; }

export interface BotResult {
  phase: string;
  steps: number;
  bonks: number;
  cranes: number;
  revives: number;
  coins: number;
}

export interface LevelReport {
  line: string;
  rawWin: number;
  win: number;
  games: number;
  rawStuck: number;
  stuck: number;
  end: number;
}

const S = new GameSession();

function pct(x: number): string { return (x * 100).toFixed(1) + '%'; }
function pad(s: string | number, n: number): string { s = String(s); while (s.length < n) s = ' ' + s; return s; }

function lackMap(): Record<string, number> {
  const cnt = countFence(S.fence);
  const lack: Record<string, number> = {};
  S.activeOrders().forEach(function (s) {
    for (const id in s.order!.items) {
      const gap = s.order!.items[id] - (cnt[id] || 0);
      if (gap > 0) lack[id] = (lack[id] || 0) + gap;
    }
  });
  return lack;
}

function pickByOrder(cands: Animal[]): Animal | null {
  const lack = lackMap();
  const pri = cands.filter(function (a) { return (lack[a.type.id] || 0) > 0; });
  if (pri.length) return pri[Math.floor(Math.random() * pri.length)];
  if (S.fence.length >= FENCE_MAX - 1) return null; /* 围栏吃紧：硬点非缺口类型必然挤爆 */
  return cands[Math.floor(Math.random() * cands.length)];
}

/* 被挡动物选择：解锁收益最大（移走后新解锁数 + 订单类型加成） */
function pickBlockedBest(): Animal | null {
  const lack = lackMap();
  let best: Animal | null = null, bestScore = -1;
  const base = countUnlocked(S.herd);
  S.herd.forEach(function (b) {
    if (b.obstacle || !isBlocked(S.herd, b)) return;
    const idx = S.herd.indexOf(b);
    S.herd.splice(idx, 1);
    const gain = countUnlocked(S.herd) - base;
    S.herd.splice(idx, 0, b);
    const score = gain + ((lack[b.type.id] || 0) > 0 ? 5 : 0) + Math.random();
    if (score > bestScore) { bestScore = score; best = b; }
  });
  return best;
}

/* 调和（同步版，与 _sim-trace.js reconcileSync 逐行对齐） */
function reconcileSync(): void {
  let guard = 0;
  while (S.phase === 'play' && guard++ < 60) {
    if (S.herdLeftCount() === 0 && S.fence.length === 0) { S.markOutcome('win'); return; }
    const m = S.findMatch();
    if (m) { S.fulfillNow(m); continue; }
    let swapped = false;
    for (let i = 0; i < SLOT_TOTAL; i++) {
      const s = S.slots[i];
      if (s.state === 'truck' && s.order && !S.orderSatisfiable(s.order)) {
        S.abandonOrder(i);
        swapped = true;
        break;
      }
    }
    S.tryDispatch();
    if (swapped) continue;
    if (S.isStuck()) { S.markOutcome('end'); return; }
    return;
  }
}

/* recover=true：模拟看广告续命（围栏挤爆清仓 / 互锁无救援时送吊车），测广告后胜率
 * recover=false：一审（不用任何广告救援），测真实难度 */
function runBot(recover: boolean): BotResult {
  S.start(S.level);
  /* typeCount 覆盖（扫描专用）：改写 cfg 后重新生成盘面（generate 私有，运行时 strip-types 可达） */
  if (typeCountOverride !== null && typeCountOverride !== S.cfg.typeCount) {
    const sc = S as unknown as { cfg: LevelConfig; generate(): void };
    sc.cfg = { ...S.cfg, typeCount: typeCountOverride };
    sc.generate();
    S.tryDispatch();
  }
  let steps = 0, bonks = 0, cranes = 0, revives = 0;
  let guard = 0;
  while (guard++ < 3000) {
    reconcileSync();
    if (S.phase === 'win') return { phase: 'win', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };
    if (S.phase === 'end') return { phase: 'end', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };

    /* 围栏满且无法装车 = 挤爆 */
    if (S.fence.length >= FENCE_MAX) {
      if (recover) {
        S.fence = [];
        continue;
      }
      return { phase: 'failfence', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };
    }

    const cands = S.herd.filter(function (a) { return !a.obstacle && !isBlocked(S.herd, a); });

    if (cands.length) {
      const pick = pickByOrder(cands);
      if (!pick) {
        /* 围栏吃紧且无缺口类型：点非缺口动物必然挤爆，等价失败路径 */
        if (recover) { S.fence = []; continue; }
        return { phase: 'failfence', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };
      }
      S.herd.splice(S.herd.indexOf(pick), 1);
      S.fence.push(pick);
      steps++;
      continue;
    }

    if (S.herdLeftCount() > 0) {
      /* V4.1 碰撞弹回：点被挡动物无收益（弹回原位+扣血），理性玩家不碰撞。
       * 互锁脱困救援链：吊车 → 翻转 → 洗牌 →（广告续） */
      if (S.craneLeft > 0) {
        const b = pickBlockedBest();
        if (!b) break;
        S.craneLeft--;
        cranes++;
        S.herd.splice(S.herd.indexOf(b), 1);
        S.fence.push(b);
        steps++;
        continue;
      }
      if (S.flipLeft > 0) {
        S.flipLeft--;
        S.herd.forEach(function (a) { if (!a.obstacle) a.dir = randDir(S.rng); });

        steps++;
        continue;
      }
      if (S.shufLeft > 0) {
        S.shufLeft--;
        reflow(S.herd, S.rng, S.cfg.tightness); /* P1.5：洗牌分布与生成器一致（tightness 透传） */
        steps++;
        continue;
      }
      if (recover) { S.craneLeft = 1; revives++; continue; } /* 广告送吊车 */
      return { phase: 'faillock', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };
    }

    /* 牧场已清空、围栏有货：reconcileSync 无进展且非 win/end → 理论死区（保险退出） */
    break;
  }
  return { phase: 'stuck', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: S.coins };
}

/* 跑一个关卡（不打印，返回数据行 + 汇总，供 CLI 与种子对拍共用） */
export function simulateLevel(n: number, games: number): LevelReport {
  S.start(n);
  let win = 0, failfence = 0, faillock = 0, end = 0, stuck = 0;
  let rawWin = 0, rawFence = 0, rawLock = 0, rawEnd = 0, rawStuck = 0;
  let totSteps = 0, totBonks = 0, totCranes = 0, totRevives = 0, totCoins = 0;
  for (let g = 0; g < games; g++) {
    const r1 = runBot(false);
    if (r1.phase === 'win') rawWin++; else if (r1.phase === 'failfence') rawFence++;
    else if (r1.phase === 'faillock') rawLock++; else if (r1.phase === 'end') rawEnd++; else rawStuck++;
    const r2 = runBot(true);
    if (r2.phase === 'win') win++; else if (r2.phase === 'failfence') failfence++;
    else if (r2.phase === 'faillock') faillock++;
    else if (r2.phase === 'end') end++; else stuck++;
    totSteps += r2.steps; totBonks += r2.bonks; totCranes += r2.cranes; totRevives += r2.revives; totCoins += r2.coins;
  }
  const cfg = levelCfg(n);
  const line =
    'L' + pad(n, 2) +
    ' | 动物' + pad(cfg.herdN, 2) + ' 种' + cfg.typeCount + ' 石' + cfg.rocks +
    ' | 一审' + pad(pct(rawWin / games), 6) +
    ' 恢复后' + pad(pct(win / games), 6) +
    ' | 挤爆' + pad(pct(rawFence / games), 5) +
    ' 锁死败' + pad(pct(rawLock / games), 5) +
    ' 卖不掉' + pad(pct(rawEnd / games), 4) +
    ' 卡' + pad(pct(rawStuck / games), 4) +
    ' | 步' + pad((totSteps / games).toFixed(1), 5) +
    ' 吊车' + (totCranes / games).toFixed(1) +
    ' 广告续' + (totRevives / games).toFixed(1) +
    ' | 营收' + Math.round(totCoins / games);
  return { line: line, rawWin: rawWin, win: win, games: games, rawStuck: rawStuck, stuck: stuck, end: end + rawEnd };
}

export function curveScan(games = 400): void {
  console.log('=== 动物集市 V4.1（碰撞弹回+清空通关）· core 层关卡难度曲线 · L1-L12 · 各 ' + games + ' 局（贪心机器人） ===');
  console.log('目标：L1-2 教学保过(一审≥95%) · L3-5 爬升 · L6+ 靠广告续命(恢复后≥95%) · 全程无卡死');
  let bad = 0;
  for (let n = 1; n <= 12; n++) {
    const r = simulateLevel(n, games);
    console.log(r.line);
    bad += r.stuck + (r.rawStuck || 0);
  }
  console.log(bad === 0 ? '>>> 全程 0 卡死 ✓' : '>>> 存在卡死：' + bad + ' 局，需修复！');
}
