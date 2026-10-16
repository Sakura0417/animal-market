/* 独立模拟 V4.1：复刻 game.js V4.1（碰撞弹回 + 清空通关版）核心逻辑（无 DOM），跑贪心机器人验证难度曲线
 * 规则对应：散点布局 · 走廊遮挡 · 5 车位(3 开 2 锁) · 车位永不为空(发车即补) ·
 *           被挡动物点击 = 碰撞弹回原位(不进围栏)扣 1 生命(共 3，扣完失败) →
 *           理性玩家不碰撞，互锁脱困走救援链：吊车×4 → 翻转×2 → 洗牌×2（广告可续）·
 *           清空牧场+围栏即通关 · 死单换车 · 无免费互锁救援
 * 机器人策略（理性玩家下限）：优先拿订单缺口的无遮挡动物；围栏≥6 只拿订单缺口类型；
 *           围栏满无法装车 = 挤爆失败；全被挡时依次用救援链。
 * 用法：
 *   node _sim-trace.js                 → 关卡曲线扫描 L1-L12（各 400 局）
 *   node _sim-trace.js <level> [局数]  → 单关深测（默认 1600 局） */
'use strict';

var SLOT_TOTAL = 5, SLOT_OPEN = 3;
var FENCE_MAX = 7, CRANE_MAX = 4, HP_MAX = 3, FLIP_MAX = 2, SHUF_MAX = 2;
var R = 7.6;
var TOL = R * 1.22, AHEAD = R * 0.55, PAD = R + 2, MIN_D = R * 1.58;
var ASPECT = 1.25;
var TYPES = [
  { id: 'chicken', price: 8 },
  { id: 'duck', price: 10 },
  { id: 'rabbit', price: 12 },
  { id: 'sheep', price: 15 },
  { id: 'pig', price: 18 },
  { id: 'cow', price: 25 }
];
var TYPE_MAP = {};
TYPES.forEach(function (t) { TYPE_MAP[t.id] = t; });
var DIRS = ['up', 'down', 'left', 'right'];

/* ---------- 关卡配置（与 game.js levelCfg 完全一致） ---------- */
function levelCfg(n) {
  n = Math.max(1, Math.min(30, n | 0));
  return {
    level: n,
    herdN: Math.min(30, 8 + n * 2),
    typeCount: n <= 2 ? 3 : n <= 5 ? 4 : 5,
    rocks: n <= 2 ? 0 : Math.min(3, 1 + ((n - 3) >> 1)),
    rareP: Math.min(.1, .03 + n * .005),
    orderKinds: n <= 3 ? 1 : n <= 7 ? 2 : 3
  };
}

var LV = null, HERD_N = 0, ROCK_N = 0, TYPE_COUNT = 5;

var herd, fence, slots, slotsOpen, coins, ordersDone, hp, craneLeft, phase;
var uidSeq = 1;

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}
function randDir() { return DIRS[Math.floor(Math.random() * 4)]; }
function spanY() { return 100 * ASPECT; }
function smartDir(x, yu) {
  if (Math.random() < 0.5) {
    var dl = x, dr = 100 - x, du = yu, dd = spanY() - yu;
    var m = Math.min(dl, dr, du, dd);
    if (m === dl) return 'left';
    if (m === dr) return 'right';
    if (m === du) return 'up';
    return 'down';
  }
  return randDir();
}

function isBlocked(b) {
  for (var k = 0; k < herd.length; k++) {
    var a = herd[k];
    if (a === b) continue;
    if (b.dir === 'up' && a.yu < b.yu - AHEAD && Math.abs(a.x - b.x) < TOL) return true;
    if (b.dir === 'down' && a.yu > b.yu + AHEAD && Math.abs(a.x - b.x) < TOL) return true;
    if (b.dir === 'left' && a.x < b.x - AHEAD && Math.abs(a.yu - b.yu) < TOL) return true;
    if (b.dir === 'right' && a.x > b.x + AHEAD && Math.abs(a.yu - b.yu) < TOL) return true;
  }
  return false;
}
function countUnlocked() {
  var n = 0;
  herd.forEach(function (a) { if (!a.obstacle && !isBlocked(a)) n++; });
  return n;
}
function herdLeft() {
  var n = 0;
  herd.forEach(function (a) { if (!a.obstacle) n++; });
  return n;
}
function countFence() {
  var m = {};
  fence.forEach(function (a) { m[a.type.id] = (m[a.type.id] || 0) + 1; });
  return m;
}
function unlockedCountOf(id) {
  var n = 0;
  herd.forEach(function (a) { if (!a.obstacle && a.type.id === id && !isBlocked(a)) n++; });
  return n;
}

function scatter(n, minD) {
  var pts = [], ys = spanY();
  for (var k = 0; k < n; k++) {
    var best = null, bestD = -1;
    for (var t = 0; t < 220; t++) {
      var p = { x: PAD + Math.random() * (100 - 2 * PAD), yu: PAD + Math.random() * (ys - 2 * PAD) };
      var d = Infinity;
      for (var q = 0; q < pts.length; q++) {
        var dd = Math.hypot(pts[q].x - p.x, pts[q].yu - p.yu);
        if (dd < d) d = dd;
      }
      if (d >= minD) { best = p; break; }
      if (d > bestD) { bestD = d; best = p; }
    }
    pts.push(best);
  }
  return pts;
}

function generate() {
  var tries = 0, un;
  do {
    herd = [];
    var pts = scatter(HERD_N + ROCK_N, MIN_D);
    for (var m = 0; m < HERD_N; m++) {
      herd.push({
        uid: uidSeq++, type: TYPES[m % TYPE_COUNT], dir: smartDir(pts[m].x, pts[m].yu),
        x: pts[m].x, yu: pts[m].yu, rare: Math.random() < LV.rareP
      });
    }
    for (var r = 0; r < ROCK_N; r++) {
      herd.push({ uid: uidSeq++, obstacle: true, dir: 'up', x: pts[HERD_N + r].x, yu: pts[HERD_N + r].yu });
    }
    un = countUnlocked();
    tries++;
  } while (un < 6 && tries < 40);
}

/* ---------- orders / slots（与 game.js 一致） ---------- */
function activeOrders() {
  return slots.filter(function (s) { return s.state !== 'empty' && s.state !== 'locked' && s.order; });
}
function makeOrder() {
  var alive = {};
  herd.forEach(function (a) { if (!a.obstacle) alive[a.type.id] = (alive[a.type.id] || 0) + 1; });
  fence.forEach(function (a) { alive[a.type.id] = (alive[a.type.id] || 0) + 1; });
  var reserved = {};
  activeOrders().forEach(function (s) {
    for (var id in s.order.items) reserved[id] = (reserved[id] || 0) + s.order.items[id];
  });
  var avail = {};
  for (var id2 in alive) {
    var free = alive[id2] - (reserved[id2] || 0);
    if (free > 0) avail[id2] = free;
  }
  var ids = Object.keys(avail);
  if (!ids.length) return null;
  var openIds = ids.filter(function (id3) { return unlockedCountOf(id3) > 0; });
  if (openIds.length && Math.random() < 0.75) ids = openIds;
  /* 偏向围栏已堆积的类型：加速消化、降低挤爆率 */
  var fenceCnt = countFence();
  ids = ids.slice().sort(function (a, b) { return (fenceCnt[b] || 0) - (fenceCnt[a] || 0); });
  var maxKinds = Math.min(LV.orderKinds, ids.length);
  var n = (ids.length >= 2 && maxKinds >= 2 && Math.random() < 0.6) ? 2 : (maxKinds >= 3 && Math.random() < 0.3 ? 3 : 1);
  n = Math.min(n, maxKinds);
  var chosen = Math.random() < 0.8 ? ids.slice(0, n) : shuffle(ids.slice()).slice(0, n);
  var items = {}, value = 0;
  chosen.forEach(function (id) {
    var q = 1 + Math.floor(Math.random() * Math.min(2, avail[id]));
    items[id] = q;
    value += TYPE_MAP[id].price * q;
  });
  value = Math.max(5, Math.round(value * (1.1 + Math.random() * 0.5) / 5) * 5);
  return { items: items, value: value };
}
function tryDispatch() {
  if (phase !== 'play') return;
  for (var i = 0; i < slotsOpen; i++) {
    var s = slots[i];
    if (s.state !== 'empty') continue;
    var o = makeOrder();
    if (!o) return;
    s.order = o;
    s.state = 'truck';
  }
}

function aliveCount(id) {
  var n = 0;
  herd.forEach(function (a) { if (!a.obstacle && a.type.id === id) n++; });
  fence.forEach(function (a) { if (a.type.id === id) n++; });
  return n;
}
function orderSatisfiable(o) {
  if (!o) return false;
  for (var id in o.items) {
    if (aliveCount(id) < o.items[id]) return false;
  }
  return true;
}

/* ---------- 装车链（同步版，动画后的最终状态） ---------- */
function findMatch() {
  var cnt = countFence();
  for (var i = 0; i < SLOT_TOTAL; i++) {
    var s = slots[i];
    if (s.state !== 'truck' || !s.order) continue;
    var ok = true;
    for (var id in s.order.items) {
      if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
    }
    if (!ok) continue;
    var taken = [], picked = {};
    for (var id1 in s.order.items) {
      var needN = s.order.items[id1], k;
      for (k = 0; k < fence.length && needN > 0; k++) {
        var a = fence[k];
        if (picked[a.uid]) continue;
        if (a.type.id === id1 && !a.rare) { picked[a.uid] = 1; taken.push(a); needN--; }
      }
      for (k = 0; k < fence.length && needN > 0; k++) {
        var b = fence[k];
        if (picked[b.uid]) continue;
        if (b.type.id === id1) { picked[b.uid] = 1; taken.push(b); needN--; }
      }
    }
    return { slot: s, idx: i, taken: taken };
  }
  return null;
}
function fulfillSync(match) {
  var s = match.slot, taken = match.taken;
  var rareBonus = 0;
  taken.forEach(function (a) {
    fence.splice(fence.indexOf(a), 1);
    if (a.rare) rareBonus += a.type.price * 2;
  });
  coins += s.order.value + rareBonus;
  ordersDone++;
  s.state = 'empty';
  s.order = null;
  tryDispatch();
}

/* 死局收摊（与 game.js isStuck 一致） */
function isStuck() {
  if (herdLeft() > 0) return false;
  if (fence.length === 0) return false;
  var cnt = countFence();
  for (var i = 0; i < SLOT_TOTAL; i++) {
    var s = slots[i];
    if (s.state !== 'truck' || !s.order) continue;
    var ok = true;
    for (var id in s.order.items) {
      if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
    }
    if (ok) return false;
  }
  return makeOrder() === null;
}

/* 调和（同步版） */
function reconcileSync() {
  var guard = 0;
  while (phase === 'play' && guard++ < 60) {
    if (herdLeft() === 0 && fence.length === 0) { phase = 'win'; return; }
    var m = findMatch();
    if (m) { fulfillSync(m); continue; }
    var swapped = false;
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (s.state === 'truck' && s.order && !orderSatisfiable(s.order)) {
        s.state = 'empty';
        s.order = null;
        swapped = true;
        break;
      }
    }
    tryDispatch();
    if (swapped) continue;
    if (isStuck()) { phase = 'end'; return; }
    return;
  }
}

/* ---------- 机器人 ---------- */
function lackMap() {
  var cnt = countFence();
  var lack = {};
  activeOrders().forEach(function (s) {
    for (var id in s.order.items) {
      var gap = s.order.items[id] - (cnt[id] || 0);
      if (gap > 0) lack[id] = (lack[id] || 0) + gap;
    }
  });
  return lack;
}
function pickByOrder(cands) {
  var lack = lackMap();
  var pri = cands.filter(function (a) { return (lack[a.type.id] || 0) > 0; });
  if (pri.length) return pri[Math.floor(Math.random() * pri.length)];
  if (fence.length >= FENCE_MAX - 1) return null; /* 围栏吃紧：没有缺口类型可点，硬点会挤爆 */
  return cands[Math.floor(Math.random() * cands.length)];
}
/* 被挡动物选择：解锁收益最大（移走后新解锁数 + 订单类型加成） */
function pickBlockedBest() {
  var lack = lackMap();
  var best = null, bestScore = -1;
  var base = countUnlocked();
  herd.forEach(function (b) {
    if (b.obstacle || !isBlocked(b)) return;
    var idx = herd.indexOf(b);
    herd.splice(idx, 1);
    var gain = countUnlocked() - base;
    herd.splice(idx, 0, b);
    var score = gain + ((lack[b.type.id] || 0) > 0 ? 5 : 0) + Math.random();
    if (score > bestScore) { bestScore = score; best = b; }
  });
  return best;
}

function resetLevel(n) {
  LV = levelCfg(n);
  HERD_N = LV.herdN; ROCK_N = LV.rocks; TYPE_COUNT = LV.typeCount;
  fence = [];
  coins = 0; ordersDone = 0;
  hp = HP_MAX;
  craneLeft = CRANE_MAX;
  slots = [];
  slotsOpen = SLOT_OPEN;
  for (var i = 0; i < SLOT_TOTAL; i++) {
    slots.push({ state: i < SLOT_OPEN ? 'empty' : 'locked', order: null });
  }
  phase = 'play';
  generate();
  tryDispatch();
}

/* recover=true：模拟看广告续命（围栏挤爆清仓 / 互锁无救援时送吊车），测广告后胜率
 * recover=false：一审（不用任何广告救援），测真实难度 */
function runBot(recover) {
  resetLevel(LV.level);
  var steps = 0, bonks = 0, cranes = 0, revives = 0, clears = 0;
  var craneLeft = CRANE_MAX, flipLeft = FLIP_MAX, shufLeft = SHUF_MAX;
  var guard = 0;
  while (guard++ < 3000) {
    reconcileSync();
    if (phase === 'win') return { phase: 'win', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };
    if (phase === 'end') return { phase: 'end', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };

    /* 围栏满且无法装车 = 挤爆 */
    if (fence.length >= FENCE_MAX) {
      if (recover) {
        clears++;
        fence = [];
        continue;
      }
      phase = 'failfence';
      return { phase: 'failfence', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };
    }

    var cands = herd.filter(function (a) { return !a.obstacle && !isBlocked(a); });

    if (cands.length) {
      var pick = pickByOrder(cands);
      if (!pick) {
        /* 围栏吃紧且无缺口类型：点非缺口动物必然挤爆，等价失败路径 */
        if (recover) { clears++; fence = []; continue; }
        phase = 'failfence';
        return { phase: 'failfence', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };
      }
      herd.splice(herd.indexOf(pick), 1);
      fence.push(pick);
      steps++;
      continue;
    }

    if (herdLeft() > 0) {
      /* V4.1 碰撞弹回：点被挡动物无收益（弹回原位+扣血），理性玩家不碰撞。
       * 互锁脱困救援链：吊车 → 翻转 → 洗牌 →（广告续） */
      if (craneLeft > 0) {
        var b = pickBlockedBest();
        if (!b) break;
        craneLeft--;
        cranes++;
        herd.splice(herd.indexOf(b), 1);
        fence.push(b);
        steps++;
        continue;
      }
      if (flipLeft > 0) {
        flipLeft--;
        herd.forEach(function (a) { if (!a.obstacle) a.dir = randDir(); });
        steps++;
        continue;
      }
      if (shufLeft > 0) {
        shufLeft--;
        var pts = scatter(herd.length, MIN_D);
        for (var k = 0; k < herd.length; k++) { herd[k].x = pts[k].x; herd[k].yu = pts[k].yu; }
        steps++;
        continue;
      }
      if (recover) { craneLeft = 1; revives++; continue; } /* 广告送吊车 */
      phase = 'faillock';
      return { phase: 'faillock', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };
    }

    /* 牧场已清空、围栏有货：reconcileSync 无进展且非 win/end → 理论死区（保险退出） */
    break;
  }
  return { phase: 'stuck', steps: steps, bonks: bonks, cranes: cranes, revives: revives, coins: coins };
}

/* ---------- 主程序 ---------- */
var argLv = parseInt(process.argv[2], 10);
if (argLv >= 1) {
  var games = parseInt(process.argv[3], 10) || 1600;
  deepRun(argLv, games);
} else {
  curveScan();
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function pad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

function runLevel(n, games) {
  resetLevel(n);
  var win = 0, failfence = 0, faillock = 0, end = 0, stuck = 0;
  var rawWin = 0, rawFence = 0, rawLock = 0, rawEnd = 0, rawStuck = 0;
  var totSteps = 0, totBonks = 0, totCranes = 0, totRevives = 0, totCoins = 0;
  for (var g = 0; g < games; g++) {
    var r1 = runBot(false);
    if (r1.phase === 'win') rawWin++; else if (r1.phase === 'failfence') rawFence++;
    else if (r1.phase === 'faillock') rawLock++; else if (r1.phase === 'end') rawEnd++; else rawStuck++;
    var r2 = runBot(true);
    if (r2.phase === 'win') win++; else if (r2.phase === 'failfence') failfence++;
    else if (r2.phase === 'faillock') faillock++;
    else if (r2.phase === 'end') end++; else stuck++;
    totSteps += r2.steps; totBonks += r2.bonks; totCranes += r2.cranes; totRevives += r2.revives; totCoins += r2.coins;
  }
  var cfg = levelCfg(n);
  console.log(
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
    ' | 营收' + Math.round(totCoins / games)
  );
  return { rawWin: rawWin, win: win, games: games, rawStuck: rawStuck, stuck: stuck, end: end + rawEnd };
}

function curveScan() {
  console.log('=== 动物集市 V4.1（碰撞弹回+清空通关）关卡难度曲线 · L1-L12 · 各 400 局（贪心机器人） ===');
  console.log('目标：L1-2 教学保过(一审≥95%) · L3-5 爬升 · L6+ 靠广告续命(恢复后≥95%) · 全程无卡死');
  var bad = 0;
  for (var n = 1; n <= 12; n++) {
    var r = runLevel(n, 400);
    bad += r.stuck + (r.rawStuck || 0);
  }
  console.log(bad === 0 ? '>>> 全程 0 卡死 ✓' : '>>> 存在卡死：' + bad + ' 局，需修复！');
}

function deepRun(n, games) {
  console.log('=== 动物集市 V4.1 单关深测 · L' + n + ' · ' + games + ' 局 ===');
  runLevel(n, games);
}
