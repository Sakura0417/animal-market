/* ============================================================
 * 《动物集市》高保真原型 · 对局引擎 V4.1（碰撞弹回 + 特效版）
 * 布局：上=停车位公路带（5 车位 · 3 默认 + 2 广告解锁）
 *       下=牧场散落动物（非网格 · 箭头方向 · 走廊遮挡判定）
 * V4.1 变更：
 *   1) 碰撞弹回：被挡动物点击后冲撞前方动物被弹回原位（不进围栏），
 *      动物按朝向弹跳 + 粒子爆开 + "-1 生命"飘字 + 屏幕震动 + 心碎动画
 *   2) 通关特效：彩带金币雨（70 粒）+ "牧场清空"大飘字 + 面板弹性弹出
 * V4 变更（保留）：
 *   1) 生命值：被挡动物可点但碰撞扣 1 心（共 3，扣完失败，可广告复活）
 *   2) 通关判定：清空牧场 + 围栏全部动物；吊车 = 免扣血吊走（每局 4 次）
 *   3) 飞行动画 / cargo 载货 / 车位永不为空 / levelCfg 关卡系统
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 关卡配置（难度曲线：前期教学保过，中期爬升，后期靠广告续命） ----------
   * 难度旋钮：动物总数（清空工作量）· 种类数（围栏压力）· 石头数（被挡→扣血源）
   *          · 稀有率 · 订单复杂度。生命 3 点为全局常数。 */
  function levelCfg(n) {
    n = Math.max(1, Math.min(30, n | 0));
    return {
      level: n,
      herdN: Math.min(30, 8 + n * 2),             /* L1=10 → L11=30 封顶（清空型通关的工作量曲线） */
      typeCount: n <= 2 ? 3 : n <= 5 ? 4 : 5,     /* 种类越多越难（猪了个猪核心难度旋钮） */
      rocks: n <= 2 ? 0 : Math.min(3, 1 + ((n - 3) >> 1)),
      rareP: Math.min(.1, .03 + n * .005),
      orderKinds: n <= 3 ? 1 : n <= 7 ? 2 : 3      /* 订单复杂度随关卡解锁 */
    };
  }
  var LEVEL_NO = (function () {
    var n = parseInt(new URLSearchParams(location.search).get('lv'), 10);
    if (!(n >= 1 && n <= 30)) {
      try { n = parseInt(localStorage.getItem('am_level'), 10) || 1; } catch (e) { n = 1; }
    }
    return Math.min(30, Math.max(1, n || 1));
  })();
  var LV = levelCfg(LEVEL_NO);

  var FENCE_MAX = 7, CRANE_MAX = 4;
  var SLOT_TOTAL = 5, SLOT_OPEN = 3;
  var HP_MAX = 3;                 /* 生命值：碰撞扣 1，扣完失败 */
  var HERD_N = LV.herdN, ROCK_N = LV.rocks, TYPE_COUNT = LV.typeCount;
  var R = 7.6;                 /* 动物半径（单位 = 牧场宽度的 1%） */
  var PAD = R + 2;             /* 中心距牧场边缘最小距离 */
  var MIN_D = R * 1.58;        /* 散点最小中心距（允许轻微交叠） */
  var TOL = R * 1.22;          /* 走廊遮挡横向容差（模拟器调优值：V4 生命值版收窄） */
  var AHEAD = R * 0.55;        /* 前方判定阈值 */
  var TYPES = [
    { id: 'chicken', emoji: '🐔', name: '鸡', price: 8 },
    { id: 'duck', emoji: '🦆', name: '鸭', price: 10 },
    { id: 'rabbit', emoji: '🐰', name: '兔', price: 12 },
    { id: 'sheep', emoji: '🐑', name: '羊', price: 15 },
    { id: 'pig', emoji: '🐖', name: '猪', price: 18 },
    { id: 'cow', emoji: '🐮', name: '牛', price: 25 }
  ];
  var TYPE_MAP = {};
  TYPES.forEach(function (t) { TYPE_MAP[t.id] = t; });
  var DIRS = ['up', 'down', 'left', 'right'];
  var SLOT_COLORS = [
    ['#ffcf3e', '#ff9d2b'], ['#8ad94f', '#58b52e'], ['#5cb2ea', '#2c7fb8'],
    ['#ff9ec7', '#e06a9d'], ['#b9a0fb', '#7c5cc4']
  ];
  var DIR_DEG = { up: 0, right: 90, down: 180, left: 270 };

  var root = document.getElementById('gameRoot');
  if (!root) return;
  var phone = root.closest('.phone') || root;

  /* ---------- state ---------- */
  var herd, fence, slots, slotsOpen, coins, ordersDone, hp, craneLeft, craneUsed, doubled, bestSale;
  var flipLeft, shufLeft, craneMode, craneTimer, phase, soldByType, pendingUnlock;
  var firstRun = true, failTimer = null, uidSeq = 1, aspect = 1.25;
  var busy = 0;                /* 动画进行中计数（>0 时锁输入） */
  var fxGen = 0;               /* 动画代数：重开局时 +1，旧代回调全部作废 */
  var lostHeartIdx = -1;       /* 刚失去的心 index（心碎动画一次性标记） */
  var coinsShown = 0;          /* HUD 显示的金币（装车后等金币飞达才更新，制造入账爽感） */

  /* ---------- DOM scaffold ---------- */
  var hud = document.createElement('div'); hud.className = 'd-hud';
  var pauseBtn = document.createElement('button'); pauseBtn.className = 'd-iconbtn';
  pauseBtn.title = '暂停';
  pauseBtn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';
  var restartBtn = document.createElement('button'); restartBtn.className = 'd-iconbtn';
  restartBtn.title = '重新开局';
  restartBtn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>';
  var lvEl = document.createElement('span'); lvEl.className = 'd-lv';
  lvEl.textContent = '第' + LEVEL_NO + '关';
  var progEl = document.createElement('span'); progEl.className = 'd-progress';
  var hpEl = document.createElement('span'); hpEl.className = 'd-hp';
  hpEl.title = '生命值：碰到其他动物会扣 1 颗';
  var coinEl = document.createElement('span'); coinEl.className = 'd-coin';
  coinEl.style.marginLeft = 'auto';
  hud.appendChild(pauseBtn); hud.appendChild(restartBtn); hud.appendChild(lvEl);
  hud.appendChild(hpEl); hud.appendChild(progEl); hud.appendChild(coinEl);

  var parkEl = document.createElement('div'); parkEl.className = 'd-park';

  var fenceBar = document.createElement('div'); fenceBar.className = 'd-fencebar';
  var fenceLabel = document.createElement('span'); fenceLabel.className = 'd-fence-label';
  var fenceEl = document.createElement('div'); fenceEl.className = 'd-fence';
  fenceBar.appendChild(fenceLabel); fenceBar.appendChild(fenceEl);

  var penEl = document.createElement('div'); penEl.className = 'd-pen';

  var toolsEl = document.createElement('div'); toolsEl.className = 'd-tools';
  var craneBtn = document.createElement('button'); craneBtn.className = 'd-tool'; craneBtn.id = 'toolCrane';
  var flipBtn = document.createElement('button'); flipBtn.className = 'd-tool'; flipBtn.id = 'toolFlip';
  var shufBtn = document.createElement('button'); shufBtn.className = 'd-tool'; shufBtn.id = 'toolShuf';
  toolsEl.appendChild(craneBtn); toolsEl.appendChild(flipBtn); toolsEl.appendChild(shufBtn);

  var modal = document.createElement('div'); modal.className = 'd-modal hidden';
  var adOverlay = document.createElement('div'); adOverlay.className = 'adoverlay hidden';
  var toastEl = document.createElement('div'); toastEl.className = 'toast';

  [hud, parkEl, fenceBar, penEl, toolsEl].forEach(function (el) { root.appendChild(el); });
  [modal, adOverlay, toastEl].forEach(function (el) { phone.appendChild(el); });

  /* ---------- FX 飞行层（viewport 坐标，脱离滚动/裁剪影响） ---------- */
  var fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  document.body.appendChild(fxLayer);

  function rectCenter(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  /* 弧线飞行：动物从 fromPt 到 toPt（WAAPI 三关键帧，中段抬升） */
  function flyAnimal(a, fromPt, toPt, size, done) {
    var gen = fxGen;
    var el = document.createElement('div');
    el.className = 'fx-fly';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = AM.animals.svg(a.type.id, { rare: a.rare });
    fxLayer.appendChild(el);
    var dx = toPt.x - fromPt.x, dy = toPt.y - fromPt.y;
    var anim = el.animate([
      { left: fromPt.x + 'px', top: fromPt.y + 'px', transform: 'translate(-50%,-50%) scale(1)' },
      { left: (fromPt.x + dx * .5) + 'px', top: (fromPt.y + dy * .5 - 42) + 'px', transform: 'translate(-50%,-50%) scale(1.3)', offset: .55 },
      { left: toPt.x + 'px', top: toPt.y + 'px', transform: 'translate(-50%,-50%) scale(.55)' }
    ], { duration: 430, easing: 'cubic-bezier(.5,.05,.6,.95)' });
    anim.onfinish = function () { el.remove(); if (gen === fxGen && done) done(); };
    anim.oncancel = function () { el.remove(); };
  }
  /* 金币直线飞行：卡车 → HUD 金币计数（到达时才更新 HUD 数字） */
  function flyCoin(fromPt, done) {
    var gen = fxGen;
    var el = document.createElement('div');
    el.className = 'fx-fly fx-coin';
    el.style.width = '26px';
    el.style.height = '26px';
    el.innerHTML = AM.animals.coin();
    fxLayer.appendChild(el);
    var toPt = rectCenter(coinEl);
    var anim = el.animate([
      { left: fromPt.x + 'px', top: fromPt.y + 'px', transform: 'translate(-50%,-50%) scale(1)' },
      { left: toPt.x + 'px', top: toPt.y + 'px', transform: 'translate(-50%,-50%) scale(.5)' }
    ], { duration: 520, easing: 'cubic-bezier(.3,0,.4,1)' });
    anim.onfinish = function () {
      el.remove();
      if (gen !== fxGen) { if (done) done(); return; }
      coinsShown = coins;
      renderHUD();
      if (done) done();
    };
    anim.oncancel = function () { el.remove(); };
  }
  /* 卡车落货：载重下沉回弹（挪车游戏载货感） */
  function bumpTruck(slotIdx) {
    var el = parkEl.querySelector('.d-slot[data-slot="' + slotIdx + '"] .d-slot-truck');
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------- V4.1 FX：碰撞粒子 / 飘字 / 屏幕震动 / 通关彩带 ---------- */
  var FX_COLORS = ['#ff6f61', '#ff9d2b', '#ffd24d', '#8ad94f', '#5cb2ea', '#ffffff'];
  /* 碰撞粒子爆开：撞击点向四周飞散的彩色圆点 */
  function spawnBurst(pt, n) {
    for (var i = 0; i < n; i++) {
      (function () {
        var el = document.createElement('div');
        el.className = 'fx-burst';
        var sz = 5 + Math.random() * 6;
        el.style.width = sz + 'px';
        el.style.height = sz + 'px';
        el.style.background = FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)];
        el.style.left = pt.x + 'px';
        el.style.top = pt.y + 'px';
        fxLayer.appendChild(el);
        var ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 38;
        var anim = el.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + (Math.cos(ang) * dist) + 'px,' + (Math.sin(ang) * dist) + 'px) scale(.15)', opacity: 0 }
        ], { duration: 360 + Math.random() * 240, easing: 'cubic-bezier(.2,.7,.4,1)' });
        anim.onfinish = function () { el.remove(); };
        anim.oncancel = function () { el.remove(); };
      })();
    }
  }
  /* 飘字：碰撞 "-1 生命" / 通关 "牧场清空" */
  function floatText(pt, txt, big) {
    var el = document.createElement('div');
    el.className = 'fx-text' + (big ? ' big' : '');
    el.textContent = txt;
    el.style.left = pt.x + 'px';
    el.style.top = pt.y + 'px';
    fxLayer.appendChild(el);
    var anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1.15)', opacity: 1, offset: .22 },
      { transform: 'translate(-50%,-170%) scale(1)', opacity: 0 }
    ], { duration: 950, easing: 'ease-out' });
    anim.onfinish = function () { el.remove(); };
    anim.oncancel = function () { el.remove(); };
  }
  /* 屏幕震动：碰撞时手机壳轻微晃动 */
  function phoneShake() {
    phone.classList.remove('shake-screen');
    void phone.offsetWidth;
    phone.classList.add('shake-screen');
  }
  /* 通关彩带雨：70 个彩纸从天而降（每 6 个混 1 枚金币） */
  var winFxOn = false;
  function spawnConfetti() {
    if (winFxOn) return;
    winFxOn = true;
    var W = window.innerWidth, H = window.innerHeight;
    for (var i = 0; i < 70; i++) {
      (function (i) {
        var el = document.createElement('div');
        el.className = 'fx-confetti';
        if (i % 6 === 0) {
          el.innerHTML = AM.animals.coin();
        } else {
          var w = 6 + Math.random() * 6, h = 8 + Math.random() * 9;
          el.style.width = w + 'px';
          el.style.height = h + 'px';
          el.style.background = FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)];
          el.style.borderRadius = Math.random() < .3 ? '50%' : '2px';
        }
        el.style.left = (Math.random() * W) + 'px';
        el.style.top = '-26px';
        fxLayer.appendChild(el);
        var dur = 1700 + Math.random() * 1400;
        var drift = (Math.random() - .5) * 180;
        var anim = el.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + drift + 'px,' + (H + 80) + 'px) rotate(' + (360 + Math.random() * 720) + 'deg)', opacity: .85 }
        ], { duration: dur, easing: 'cubic-bezier(.3,.2,.6,1)', delay: Math.random() * 350 });
        anim.onfinish = function () { el.remove(); };
        anim.oncancel = function () { el.remove(); };
      })(i);
    }
  }

  /* ---------- utils ---------- */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function randDir() { return DIRS[Math.floor(Math.random() * 4)]; }
  /* 方向偏向：50% 概率朝最近的边（模拟器验证：互锁事件显著减少） */
  function smartDir(x, yu) {
    if (Math.random() < 0.5) {
      var ys = spanY();
      var dl = x, dr = 100 - x, du = yu, dd = ys - yu;
      var m = Math.min(dl, dr, du, dd);
      if (m === dl) return 'left';
      if (m === dr) return 'right';
      if (m === du) return 'up';
      return 'down';
    }
    return randDir();
  }

  function measurePen() {
    var w = penEl.clientWidth, h = penEl.clientHeight;
    if (w > 0 && h > 0) aspect = h / w;
  }
  function spanY() { return 100 * aspect; } /* 牧场高度的宽度单位值 */

  /* 走廊遮挡：b 沿 dir 的射线上存在其它动物/石头即被挡 */
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
  function unlockedSet() {
    var s = [];
    for (var k = 0; k < herd.length; k++) {
      if (!herd[k].obstacle && !isBlocked(herd[k])) s.push(herd[k].uid);
    }
    return s;
  }
  function countUnlocked() { return unlockedSet().length; }
  function herdLeft() {          /* 牧场剩余动物数（不含石头）：清空通关的进度指标 */
    var n = 0;
    for (var k = 0; k < herd.length; k++) if (!herd[k].obstacle) n++;
    return n;
  }
  function countFence() {
    var m = {};
    fence.forEach(function (a) { m[a.type.id] = (m[a.type.id] || 0) + 1; });
    return m;
  }
  function unlockedCountOf(id) {
    var n = 0;
    for (var k = 0; k < herd.length; k++) {
      var a = herd[k];
      if (!a.obstacle && a.type.id === id && !isBlocked(a)) n++;
    }
    return n;
  }

  /* ---------- generation：拒绝采样散点布局 ---------- */
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
          x: pts[m].x, yu: pts[m].yu, rot: Math.random() * 52 - 26,
          rare: Math.random() < LV.rareP, pop: false
        });
      }
      for (var r = 0; r < ROCK_N; r++) {
        herd.push({
          uid: uidSeq++, obstacle: true, dir: 'up',
          x: pts[HERD_N + r].x, yu: pts[HERD_N + r].yu, rot: Math.random() * 40 - 20
        });
      }
      un = countUnlocked();
      tries++;
    } while (un < 6 && tries < 40);
  }

  /* ---------- orders / slots ---------- */
  function activeOrders() {
    return slots.filter(function (s) { return s.state !== 'empty' && s.state !== 'locked' && s.order; });
  }
  function makeOrder() {
    var alive = {};
    herd.forEach(function (a) {
      if (!a.obstacle) alive[a.type.id] = (alive[a.type.id] || 0) + 1;
    });
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
    /* 订单尽量指向当前未被遮挡的动物类型，降低围栏压力 */
    var openIds = ids.filter(function (id3) { return unlockedCountOf(id3) > 0; });
    if (openIds.length && Math.random() < 0.75) ids = openIds;
    /* 偏向围栏已堆积的类型：加速消化、降低挤爆率（模拟器调优） */
    var fenceCnt = countFence();
    ids = ids.slice().sort(function (a, b) { return (fenceCnt[b] || 0) - (fenceCnt[a] || 0); });
    /* 订单种类数受关卡复杂度限制 */
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

  /* 车位永不为空：开放车位一律补车（胜利改为装车即时判定，无超额风险） */
  function tryDispatch() {
    if (phase !== 'play') return;
    for (var i = 0; i < slotsOpen; i++) {
      var s = slots[i];
      if (s.state !== 'empty') continue;
      var o = makeOrder();
      if (!o) return; /* 库存全被在场订单预订：待订单消耗后 reconcile 自动补 */
      s.order = o;
      s.state = 'truck';
      s.fresh = true;
      s.loaded = null;
      setTimeout(function (sl) { sl.fresh = false; renderPark(); }, 420, s);
    }
  }

  /* ---------- render ---------- */
  function renderPark() {
    var cnt = countFence();
    var html = '';
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (s.state === 'locked') {
        html += '<div class="d-slot locked" data-slot="' + i + '">' +
          '<span class="d-slot-lock">' + AM.animals.lock() + '</span>' +
          '<small>看广告<br>解锁车位</small>' +
          '<i class="d-ad-badge">' + AM.animals.video() + '</i>' +
          '</div>';
      } else if (s.state === 'empty') {
        html += '<div class="d-slot empty"><small>空车位</small></div>';
      } else {
        var cc = SLOT_COLORS[i % SLOT_COLORS.length];
        var loading = s.state === 'loading';
        var needs = '';
        for (var id in s.order.items) {
          var have = loading ? s.order.items[id] : Math.min(cnt[id] || 0, s.order.items[id]);
          needs += '<span class="d-need' + (have >= s.order.items[id] ? ' got' : '') + '">' +
            AM.animals.svg(id) + '<b>' + have + '/' + s.order.items[id] + '</b></span>';
        }
        var cargo = '';
        (s.loaded || []).forEach(function (a) {
          cargo += '<span class="d-cargo-a' + (a.rare ? ' rare' : '') + '">' + AM.animals.svg(a.type.id) + '</span>';
        });
        html += '<div class="d-slot truck' + (s.state === 'leaving' ? ' leave' : '') + (s.fresh ? ' arrive' : '') + (loading ? ' loading' : '') + '" data-slot="' + i + '">' +
          '<span class="d-slot-truck">' + AM.animals.truck(cc[0], cc[1]) + '</span>' +
          '<span class="d-cargo">' + cargo + '</span>' +
          '<span class="d-slot-needs">' + needs + '</span>' +
          '</div>';
      }
    }
    parkEl.innerHTML = html;
  }

  function renderFence(hideUid) {
    var need = {};
    activeOrders().forEach(function (s) {
      for (var id in s.order.items) need[id] = true;
    });
    fenceEl.innerHTML = '';
    for (var s = 0; s < FENCE_MAX; s++) {
      var slot = document.createElement('div');
      slot.className = 'd-fence-slot';
      var a = fence[s];
      if (a) {
        slot.classList.add('filled');
        if (need[a.type.id]) slot.classList.add('match');
        if (a.rare) slot.classList.add('rare');
        slot.innerHTML = AM.animals.svg(a.type.id, { rare: a.rare });
        if (a.pop) { slot.classList.add('pop'); a.pop = false; }
        if (a.uid === hideUid) {
          var inner = slot.querySelector('.am-animal');
          if (inner) inner.style.visibility = 'hidden';
        }
      }
      fenceEl.appendChild(slot);
    }
    fenceLabel.innerHTML = '围栏<br><b class="num">' + fence.length + '/' + FENCE_MAX + '</b>';
    fenceBar.classList.toggle('full', fence.length >= FENCE_MAX);
  }

  function renderPen() {
    var ys = spanY();
    var html = '';
    for (var k = 0; k < herd.length; k++) {
      var a = herd[k];
      var top = (a.yu / ys) * 100;
      if (a.obstacle) {
        html += '<div class="p-rock" style="left:' + a.x + '%;top:' + top + '%;transform:translate(-50%,-50%) rotate(' + a.rot.toFixed(1) + 'deg)">' +
          AM.animals.rock() + '</div>';
        continue;
      }
      var blocked = isBlocked(a);
      var cls = 'p-a' + (blocked ? ' blocked' : '') + (a.rare ? ' rare' : '');
      if (craneMode && blocked) cls += ' crane-target';
      if (pendingUnlock && pendingUnlock.has(a.uid)) cls += ' unlock';
      html += '<div class="' + cls + '" data-uid="' + a.uid + '" style="left:' + a.x + '%;top:' + top + '%;transform:translate(-50%,-50%) rotate(' + a.rot.toFixed(1) + 'deg)">' +
        AM.animals.svg(a.type.id, { rare: a.rare }) +
        '<i class="p-ar" style="transform:rotate(' + DIR_DEG[a.dir] + 'deg)">' + AM.animals.arrow() + '</i>' +
        '</div>';
    }
    penEl.innerHTML = html;
  }

  function renderTools() {
    craneBtn.innerHTML = '<span class="d-tool-ic">' + AM.animals.claw() + '</span>吊车<small>' + (craneMode ? '点击被挡动物' : '×' + craneLeft) + '</small>' +
      (craneUsed > 0 ? '<i class="d-ad-badge">' + AM.animals.video() + '</i>' : '');
    craneBtn.classList.toggle('crane-active', craneMode);
    craneBtn.classList.toggle('disabled', craneLeft <= 0 && !craneMode);
    flipBtn.innerHTML = '<span class="d-tool-ic">' + AM.animals.arrow() + '</span>翻转<small>×' + flipLeft + '</small>' +
      '<i class="d-ad-badge">' + AM.animals.video() + '</i>';
    flipBtn.classList.toggle('disabled', flipLeft <= 0);
    shufBtn.innerHTML = '<span class="d-tool-ic d-tool-shuf"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.6-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg></span>洗牌<small>×' + shufLeft + '</small>' +
      '<i class="d-ad-badge">' + AM.animals.video() + '</i>';
    shufBtn.classList.toggle('disabled', shufLeft <= 0);
  }

  var HEART_SVG = '<svg class="am-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-10.8A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 8 3.2C20 15.8 12 21 12 21z"/></svg>';

  function renderHUD() {
    coinEl.innerHTML = AM.animals.coin() + ' ' + coinsShown;
    var hearts = '';
    for (var i = 0; i < HP_MAX; i++) {
      var cls = 'd-heart';
      if (i >= hp) cls += ' lost';
      if (i === lostHeartIdx) cls += ' break'; /* 刚失去的心：碎裂弹跳 */
      hearts += '<span class="' + cls + '">' + HEART_SVG + '</span>';
    }
    lostHeartIdx = -1;
    hpEl.innerHTML = hearts;
    progEl.textContent = '剩 ' + (herdLeft() + fence.length) + ' 只';
  }

  function renderAll(hideUid) { renderPark(); renderFence(hideUid); renderPen(); renderHUD(); renderTools(); }

  /* ---------- modal / toast / ad ---------- */
  function showModal(html, cls) {
    modal.innerHTML = '<div class="d-panel' + (cls ? ' ' + cls : '') + '">' + html + '</div>';
    modal.classList.remove('hidden');
  }
  function hideModal() { modal.classList.add('hidden'); }

  var toastTimer = null;
  function toast(msg) {
    toastEl.innerHTML = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function simulateAd(cb) {
    adOverlay.classList.remove('hidden');
    adOverlay.innerHTML =
      '<span class="ad-tag">SIMULATED REWARDED AD</span>' +
      '<div class="ad-count">3</div>' +
      '<div class="ad-note">广告播放中（演示）…</div>';
    var n = 3;
    var iv = setInterval(function () {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        adOverlay.classList.add('hidden');
        cb();
      } else {
        var c = adOverlay.querySelector('.ad-count');
        if (c) c.textContent = n;
      }
    }, 1000);
  }

  /* ---------- core loop ---------- */
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

  function trackBest(a) {
    var v = a.type.price * (a.rare ? 3 : 1);
    if (!bestSale || v > bestSale.value) {
      bestSale = { id: a.type.id, emoji: a.type.emoji, name: (a.rare ? '闪光' : '') + a.type.name, value: v };
    }
  }

  /* 匹配判定（同步）：返回 { slot, taken } 或 null */
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

  /* 装车动画序列：围栏逐只飞上卡车 → cargo 可视化 → 发车 → 补车 */
  function fulfillSlot(match, done) {
    busy++;
    var gen = fxGen;
    var s = match.slot, idx = match.idx, taken = match.taken;

    /* 记录起飞点（围栏槽位当前 rect，数据移除前） */
    var slotEls = fenceEl.querySelectorAll('.d-fence-slot');
    taken.forEach(function (a) {
      var k = fence.indexOf(a);
      a._from = (k >= 0 && slotEls[k]) ? rectCenter(slotEls[k]) : rectCenter(fenceEl);
    });

    /* 数据先行：移出围栏、结算金币（HUD 数字等金币飞达再更新） */
    var rareBonus = 0;
    taken.forEach(function (a) {
      fence.splice(fence.indexOf(a), 1);
      trackBest(a);
      soldByType[a.type.id].n++;
      if (a.rare) { rareBonus += a.type.price * 2; soldByType[a.type.id].rare++; }
    });
    coins += s.order.value + rareBonus;
    ordersDone++;

    s.state = 'loading';
    s.loaded = [];
    renderAll();

    var truckPt = (function () {
      var el = parkEl.querySelector('.d-slot[data-slot="' + idx + '"]');
      return el ? rectCenter(el) : rectCenter(parkEl);
    })();

    var i = 0;
    (function loadNext() {
      if (gen !== fxGen) return;
      if (i >= taken.length) { setTimeout(afterAll, 160); return; }
      var a = taken[i++];
      flyAnimal(a, a._from, truckPt, 34, function () {
        if (gen !== fxGen) return;
        a._from = null;
        s.loaded.push(a);
        renderPark();
        bumpTruck(idx);
        setTimeout(loadNext, 80);
      });
    })();

    function afterAll() {
      if (gen !== fxGen) return;
      flyCoin(truckPt);
      departSlot(s, idx, '卡车发车 · 营收 +' + s.order.value, function () {
        busy--;
        if (done) done();
      });
    }
  }

  /* 发车：驶离动画 → 空位 → 立即补新车（车位永不为空） */
  function departSlot(s, idx, msg, done) {
    var gen = fxGen;
    s.state = 'leaving';
    s.fresh = false;
    renderPark();
    if (msg) toast(msg);
    setTimeout(function () {
      if (gen !== fxGen) return;
      if (s.state !== 'leaving') { if (done) done(); return; }
      s.state = 'empty';
      s.order = null;
      s.loaded = null;
      renderPark();
      if (phase === 'play') {
        tryDispatch();
        renderPark();
        if (done) done();
      } else if (done) done();
    }, 380, s);
  }

  /* 死局收摊判定：牧场无动物可拿，围栏存货既凑不齐任何在场订单、也无法生成新订单 */
  function isStuck() {
    if (herdLeft() > 0) return false;
    if (fence.length === 0) return false; /* 已清空：交给胜利判定 */
    var cnt = countFence();
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (s.state !== 'truck' || !s.order) continue;
      var ok = true;
      for (var id in s.order.items) {
        if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
      }
      if (ok) return false; /* 围栏能直接装车：交给装车链 */
    }
    return makeOrder() === null; /* 剩货全部被在场订单预订且凑不齐 → 无新单可补 */
  }

  /* 调和：装车链 + 清空胜利判定 + 死单换车 + 兜底补车（动画完成后回调驱动） */
  function reconcile() {
    if (busy > 0) return;
    var guard = 0;
    (function step() {
      if (phase !== 'play' || guard++ > 25) return;
      if (herdLeft() === 0 && fence.length === 0) { win(); return; } /* 清空通关 */
      var match = findMatch();
      if (match) { fulfillSlot(match, function () { reconcile(); }); return; }
      for (var i = 0; i < SLOT_TOTAL; i++) {
        var s = slots[i];
        if (s.state === 'truck' && s.order && !orderSatisfiable(s.order)) {
          departSlot(s, i, null, step); /* 死单空驶换车 */
          return;
        }
      }
      tryDispatch(); /* 兜底：任何错过的空位立即补车 */
      renderPark();
      if (phase === 'play' && isStuck()) noStockEnd();
    })();
  }

  function noStockEnd() {
    phase = 'end';
    showModal(
      '<h4>📦 剩下的动物卖不动了</h4>' +
      '<p>第' + LEVEL_NO + '关 · 牧场已清空但围栏剩 ' + fence.length + ' 只无人要 · 营收 ' + AM.animals.coin() + ' ' + coins + '</p>' +
      '<button class="d-btn green" data-act="restart">重进一批 · 再战本关</button>' +
      '<button class="d-btn ghost" data-act="home">返回农场</button>'
    );
  }

  /* 点击动物：弧线飞入围栏（被挡 = 碰撞扣 1 生命；吊车模式 = 免扣血吊走） */
  function takeAnimal(uid) {
    if (phase !== 'play' || busy > 0) return;
    var a = null;
    for (var k = 0; k < herd.length; k++) if (herd[k].uid === uid) { a = herd[k]; break; }
    if (!a || a.obstacle) return;
    var blocked = isBlocked(a);

    if (blocked && craneMode) {
      craneMode = false;
      craneLeft--;
      clearTimeout(craneTimer);
      renderTools();
      toast('吊车吊走一只被挡动物 · 不扣生命');
      moveTo();
      return;
    }
    if (blocked) {
      /* 碰撞：动物冲向出口撞上前方动物，被弹回原位（不进围栏）· 扣 1 生命 */
      hp--;
      lostHeartIdx = hp;
      var el = penEl.querySelector('.p-a[data-uid="' + uid + '"]');
      if (el) {
        ['bonk-up', 'bonk-down', 'bonk-left', 'bonk-right'].forEach(function (c) { el.classList.remove(c); });
        void el.offsetWidth;
        el.classList.add('bonk-' + a.dir);
        var pt = rectCenter(el);
        spawnBurst(pt, 8);
        floatText(pt, hp > 0 ? '-1 生命' : '生命耗尽');
      }
      phoneShake();
      hpEl.classList.remove('shake'); void hpEl.offsetWidth; hpEl.classList.add('shake');
      renderHUD();
      busy++;
      if (hp <= 0) {
        setTimeout(function () { busy--; if (phase === 'play') failHP(); }, 560);
        return;
      }
      toast('撞到前面的动物了！被弹回原地 · 生命剩 ' + hp + ' 颗');
      setTimeout(function () { busy--; }, 470);
      return;
    }
    moveTo();

    function moveTo() {
      if (phase !== 'play' || busy > 0) return;
      var el = penEl.querySelector('.p-a[data-uid="' + uid + '"]');
      var fromPt = el ? rectCenter(el) : rectCenter(penEl);

      busy++;
      var before = unlockedSet();
      herd.splice(herd.indexOf(a), 1);
      fence.push(a);

      renderAll(a.uid);
      var slotEls = fenceEl.querySelectorAll('.d-fence-slot');
      var slotEl = slotEls[fence.length - 1];
      var toPt = slotEl ? rectCenter(slotEl) : rectCenter(fenceEl);

      flyAnimal(a, fromPt, toPt, 42, function () {
        a.pop = true;
        busy--;
        renderFence();
        renderHUD();
        if (herdLeft() === 0 && fence.length === 0) { win(); return; } /* 最后一支队伍 */
        reconcile();
        if (phase !== 'play') return;
        var after = unlockedSet();
        var news = after.filter(function (u) { return before.indexOf(u) < 0; });
        if (news.length) {
          pendingUnlock = new Set(news);
          renderPen();
          pendingUnlock = null;
        }
        if (fence.length >= FENCE_MAX) {
          phase = 'failwait';
          clearTimeout(failTimer);
          failTimer = setTimeout(failFence, 500);
          return;
        }
        if (allLocked()) toast('⚠️ 全场互相挡住了！点被挡动物会扣生命，或用吊车吊走');
      });
    }
  }

  /* ---------- crane / tools ---------- */
  function allLocked() {
    return countUnlocked() === 0 && herd.some(function (x) { return !x.obstacle; });
  }
  function armCrane(silent) {
    craneMode = true;
    renderTools();
    renderPen();
    if (!silent) toast('吊车模式：点击任意被挡动物');
    clearTimeout(craneTimer);
    craneTimer = setTimeout(function () {
      if (phase === 'play' && allLocked()) {
        armCrane(true);
        return;
      }
      craneMode = false;
      renderTools();
      renderPen();
    }, 8000);
  }
  function enterCraneMode() {
    if (phase !== 'play' || craneMode || busy > 0) return;
    if (craneLeft <= 0) { toast('本局吊车次数已用完'); return; }
    if (craneUsed === 0) {
      craneUsed++;
      armCrane();
      return;
    }
    simulateAd(function () { craneUsed++; armCrane(); });
  }

  function useFlip() {
    if (phase !== 'play' || busy > 0) return;
    if (flipLeft <= 0) { toast('翻转次数已用完'); return; }
    simulateAd(function () {
      flipLeft--;
      herd.forEach(function (a) { if (!a.obstacle) a.dir = randDir(); });
      renderAll();
      toast('全体转向完成！');
      reconcile();
    });
  }
  function useShuffle() {
    if (phase !== 'play' || busy > 0) return;
    if (shufLeft <= 0) { toast('洗牌次数已用完'); return; }
    simulateAd(function () {
      shufLeft--;
      var pts = scatter(herd.length, MIN_D);
      for (var k = 0; k < herd.length; k++) {
        herd[k].x = pts[k].x;
        herd[k].yu = pts[k].yu;
      }
      renderAll();
      toast('位置已重排！');
      reconcile();
    });
  }

  /* ---------- fail / win / pause ---------- */
  function failFence() {
    phase = 'fail';
    showModal(
      '<h4>💥 围栏挤爆了！</h4>' +
      '<p>7 格围栏已满，且当前订单无法完成。</p>' +
      '<button class="d-btn blue" data-act="release">吊车放生 3 只 · 看广告<br><span class="d-ad-note">返还基础价 50% 金币 · 继续本局</span></button>' +
      '<button class="d-btn blue" data-act="sellall">💰 清仓大甩卖 · 看广告<br><span class="d-ad-note">全部围栏动物按 70% 卖给收购商人</span></button>' +
      '<button class="d-btn ghost" data-act="help">📣 发好友求救 · 免费<br><span class="d-ad-note">好友点击后获赠 1 次吊车</span></button>' +
      '<button class="d-btn ghost" data-act="restart">放弃重开（免费）</button>'
    );
  }

  function failHP() {
    phase = 'fail';
    showModal(
      '<h4>💔 生命值耗尽！</h4>' +
      '<p>小动物们撞来撞去，牧场围栏被撞坏了 · 牧场还剩 ' + (herdLeft() + fence.length) + ' 只没卖掉</p>' +
      '<button class="d-btn blue" data-act="revive">❤️ 生命回满 3 颗 · 看广告<br><span class="d-ad-note">原地继续本局 · 已卖营收保留</span></button>' +
      '<button class="d-btn ghost" data-act="restart">放弃重开（免费）</button>'
    );
  }

  function buildResult() {
    var stats = {}, rare = 0;
    TYPES.forEach(function (t) {
      var s = soldByType[t.id];
      stats[t.id] = s.n;
      rare += s.rare;
    });
    return {
      level: LEVEL_NO, coins: coins, ordersDone: ordersDone, hpLeft: hp,
      fenceLeft: FENCE_MAX - fence.length, doubled: doubled,
      best: bestSale || { id: 'chicken', emoji: '🐔', name: '鸡', value: 8 },
      stats: Object.assign(stats, { rare: rare })
    };
  }
  function saveResult(r) {
    try { localStorage.setItem('am_last_result', JSON.stringify(r)); } catch (e) { }
  }
  function saveProgress() {
    try {
      var max = parseInt(localStorage.getItem('am_level'), 10) || 1;
      if (LEVEL_NO + 1 > max) localStorage.setItem('am_level', LEVEL_NO + 1);
    } catch (e) { }
  }

  function win() {
    phase = 'win';
    saveProgress();
    var r = buildResult();
    saveResult(r);
    if (window.AM && AM.wallet) AM.wallet.add(coins); /* TODO: 替换真实入账接口 */
    /* 通关特效：彩带雨 + 大飘字 + 面板弹性弹出 */
    spawnConfetti();
    floatText({ x: window.innerWidth / 2, y: window.innerHeight * .32 }, '🎉 牧场清空！', true);
    var stats = [];
    TYPES.forEach(function (t) {
      var s = soldByType[t.id];
      if (s.n > 0) {
        stats.push(AM.animals.svg(t.id) + '×' + s.n + (s.rare > 0 ? ' <span style="color:var(--rare)">✨' + s.rare + '</span>' : ''));
      }
    });
    var hasNext = LEVEL_NO < 30;
    showModal(
      '<h4>🎉 牧场清空 · 收市！</h4>' +
      '<p>第' + LEVEL_NO + '关通过 · 售出 ' + ordersDone + ' 车 · 牧场动物全部卖光</p>' +
      '<div style="font-family:var(--font-num);font-size:2rem;color:var(--gold);margin:6px 0 10px">' + AM.animals.coin() + ' ' + coins + '</div>' +
      '<p style="font-size:.92rem">' + (stats.join(' &nbsp; ') || '——') + '</p>' +
      (doubled
        ? '<button class="d-btn disabled">✓ 营收已翻倍</button>'
        : '<button class="d-btn blue" data-act="double">📺 双倍营收 · 看广告</button>') +
      (hasNext
        ? '<button class="d-btn green" data-act="nextlv">下一关 · 第' + (LEVEL_NO + 1) + '关</button>'
        : '<button class="d-btn green" data-act="home">全部通关 · 返回农场</button>') +
      '<button class="d-btn" data-act="tosettle">查看结算页 →</button>' +
      '<button class="d-btn ghost" data-act="restart">再玩本关</button>',
      'win-pop'
    );
  }

  function showPause() {
    if (phase !== 'play') return;
    showModal(
      '<h4>⏸ 暂停营业</h4>' +
      '<p>第' + LEVEL_NO + '关 · 还剩 ' + (herdLeft() + fence.length) + ' 只动物 · 生命 ' + hp + '/' + HP_MAX + ' 颗</p>' +
      '<button class="d-btn" data-act="resume">继续营业</button>' +
      '<button class="d-btn ghost" data-act="restart">重新开局</button>' +
      '<button class="d-btn ghost" data-act="home">返回农场</button>'
    );
  }

  /* ---------- modal actions ---------- */
  modal.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'start') { phase = 'play'; hideModal(); return; }
    if (act === 'restart') { resetGame(); return; }
    if (act === 'resume') { hideModal(); return; }
    if (act === 'home') { location.href = 'index.html'; return; }
    if (act === 'tosettle') { location.href = 'settlement.html'; return; }
    if (act === 'nextlv') { location.href = 'game.html?lv=' + (LEVEL_NO + 1); return; }
    if (phase === 'fail') {
      if (act === 'revive') {
        simulateAd(function () {
          hp = HP_MAX;
          phase = 'play';
          hideModal();
          renderHUD();
          reconcile();
          toast('❤️ 生命回满！继续营业');
        });
      } else if (act === 'release') {
        simulateAd(function () {
          var refund = 0, n = Math.min(3, fence.length);
          for (var k = 0; k < n; k++) {
            var idx = Math.floor(Math.random() * fence.length);
            var a = fence.splice(idx, 1)[0];
            refund += Math.floor(a.type.price * (a.rare ? 3 : 1) * 0.5);
          }
          coins += refund;
          coinsShown = coins;
          phase = 'play';
          hideModal();
          renderAll();
          reconcile();
          toast('放生 ' + n + ' 只 · 回收 ' + AM.animals.coin() + ' ' + refund);
        });
      } else if (act === 'sellall') {
        simulateAd(function () {
          var refund = 0;
          fence.forEach(function (a) { refund += Math.floor(a.type.price * (a.rare ? 3 : 1) * 0.7); });
          fence = [];
          coins += refund;
          coinsShown = coins;
          phase = 'play';
          hideModal();
          renderAll();
          reconcile();
          toast('清仓完成 · 回收 ' + AM.animals.coin() + ' ' + refund);
        });
      } else if (act === 'help') {
        craneLeft++;
        phase = 'play';
        hideModal();
        renderTools();
        toast('求救卡已发送（演示）· 获赠 1 次吊车');
      }
      return;
    }
    if (phase === 'win') {
      if (act === 'double' && !doubled) {
        simulateAd(function () {
          coins *= 2;
          doubled = true;
          coinsShown = coins;
          var r = buildResult();
          saveResult(r);
          if (window.AM && AM.wallet) AM.wallet.add(coins / 2); /* 翻倍部分入账 */
          win();
          toast('营收翻倍！');
        });
      }
    }
  });

  /* ---------- input ---------- */
  penEl.addEventListener('click', function (e) {
    var el = e.target.closest('.p-a');
    if (!el) return;
    takeAnimal(parseInt(el.dataset.uid, 10));
  });
  parkEl.addEventListener('click', function (e) {
    var el = e.target.closest('.d-slot.locked');
    if (!el || phase !== 'play' || busy > 0) return;
    var i = parseInt(el.dataset.slot, 10);
    simulateAd(function () {
      if (slots[i].state !== 'locked') return;
      slotsOpen = Math.max(slotsOpen, i + 1);
      slots[i].state = 'empty';
      tryDispatch();
      renderAll();
      toast('新车位解锁！卡车已入场');
    });
  });
  craneBtn.addEventListener('click', enterCraneMode);
  flipBtn.addEventListener('click', useFlip);
  shufBtn.addEventListener('click', useShuffle);
  restartBtn.addEventListener('click', function () {
    if (phase === 'play' || phase === 'failwait') resetGame();
  });
  pauseBtn.addEventListener('click', showPause);

  /* ---------- reset / init ---------- */
  function resetGame() {
    clearTimeout(craneTimer);
    clearTimeout(failTimer);
    fxGen++;                     /* 旧代飞行动画回调全部作废 */
    fxLayer.innerHTML = '';
    winFxOn = false;
    busy = 0;
    craneMode = false;
    coins = 0; coinsShown = 0; ordersDone = 0;
    hp = HP_MAX;
    craneLeft = CRANE_MAX; craneUsed = 0; doubled = false; bestSale = null;
    flipLeft = 2; shufLeft = 2;
    fence = [];
    soldByType = {};
    TYPES.forEach(function (t) { soldByType[t.id] = { n: 0, rare: 0 }; });
    slots = [];
    slotsOpen = SLOT_OPEN;
    for (var i = 0; i < SLOT_TOTAL; i++) {
      slots.push({ state: i < SLOT_OPEN ? 'empty' : 'locked', order: null, fresh: false, loaded: null });
    }
    measurePen();
    generate();
    phase = 'play';
    tryDispatch();
    hideModal();
    adOverlay.classList.add('hidden');
    renderAll();
    if (firstRun) {
      firstRun = false;
      phase = 'intro';
      showModal(
        '<h4>🚜 动物集市 · 开局须知</h4>' +
        '<p style="text-align:left">1. 点击动物送进围栏。<b>被挡住的也能点，但会撞到前面的动物，<span style="color:var(--danger)">扣 1 颗生命</span>（共 ' + HP_MAX + ' 颗，扣完失败）</b><br>' +
        '2. 上方<b>停车位</b>里的卡车各收不同动物，围栏凑齐订单就自动装车收钱<br>' +
        '3. 围栏只有 <b>' + FENCE_MAX + ' 格</b>，装不下会挤爆；后两个车位可看广告解锁<br>' +
        '4. <b>把牧场和围栏的动物全部卖空即通关</b> · 被挡的宝贝用吊车吊走不扣生命</p>' +
        '<button class="d-btn" data-act="start">开始营业</button>'
      );
    }
  }

  resetGame();
})();
