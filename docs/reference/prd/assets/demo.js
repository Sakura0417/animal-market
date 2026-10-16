/* ============================================================
 * 《动物集市》PRD 交互原型 V2（停车位 + 牧场散落版）
 * 布局：上=停车位公路带（5 车位 · 3 默认 + 2 广告解锁，卡车即订单，多车位独立收单）
 *       下=牧场散落动物（非网格散点 · 箭头朝向 · 走廊式遮挡判定）
 * 规则：点未被挡动物进围栏(7格) → 任一卡车订单凑齐自动发车
 *       完成 5 张订单收市；围栏挤爆 = 失败（黄金 30 秒面板）
 * V2：装车链调和（死单换车）· 全场互锁自动救援 · 订单 75% 偏向未被遮挡类型
 *     道具：吊车 / 翻转 / 洗牌 · 方向偏向 40% 朝最近边
 *     经 1600 局自动化模拟验证：一审胜率 24%，广告恢复后 99.9%，无死锁
 * ============================================================ */
(function () {
  'use strict';

  var FENCE_MAX = 7, TARGET_ORDERS = 5, CRANE_MAX = 3;
  var SLOT_TOTAL = 5, SLOT_OPEN = 3;
  var HERD_N = 22, ROCK_N = 2;
  var R = 7.6;                 /* 动物半径（单位 = 牧场宽度的 1%） */
  var PAD = R + 2, MIN_D = R * 1.58, TOL = R * 1.3, AHEAD = R * 0.55;
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
  var DEMO_TYPE_COUNT = 5;
  var DIRS = ['up', 'down', 'left', 'right'];
  var SLOT_COLORS = ['#f5b455', '#7cc46a', '#4da3ff', '#ff9ec7', '#b48cf5'];

  var phone = document.getElementById('demoPhone');
  if (!phone) return;

  /* ---------- state ---------- */
  var herd, fence, slots, slotsOpen, coins, ordersDone, craneLeft, craneUsed, doubled;
  var flipLeft, shufLeft, craneMode, craneTimer, phase, soldByType, pendingUnlock, lastHintAt;
  var firstRun = true, failTimer = null, uidSeq = 1, aspect = 1;

  /* ---------- DOM scaffold ---------- */
  var hud = document.createElement('div'); hud.className = 'd-hud';
  hud.style.marginBottom = '10px';
  var restartBtn = document.createElement('button'); restartBtn.className = 'd-btn ghost'; restartBtn.textContent = '重新开局';
  var progEl = document.createElement('span'); progEl.className = 'd-progress';
  var coinEl = document.createElement('span'); coinEl.className = 'd-coin';
  hud.appendChild(restartBtn); hud.appendChild(progEl); hud.appendChild(coinEl);

  var parkEl = document.createElement('div'); parkEl.className = 'd-park';

  var fenceBar = document.createElement('div'); fenceBar.className = 'd-fencebar';
  var fenceEl = document.createElement('div'); fenceEl.className = 'd-fence';
  fenceBar.appendChild(fenceEl);

  var penEl = document.createElement('div'); penEl.className = 'd-pen';

  var toolsEl = document.createElement('div'); toolsEl.className = 'd-tools';
  var craneBtn = document.createElement('button'); craneBtn.className = 'd-tool';
  var flipBtn = document.createElement('button'); flipBtn.className = 'd-tool';
  var shufBtn = document.createElement('button'); shufBtn.className = 'd-tool';
  toolsEl.appendChild(craneBtn); toolsEl.appendChild(flipBtn); toolsEl.appendChild(shufBtn);

  var modal = document.createElement('div'); modal.className = 'd-modal hidden';
  var adOverlay = document.createElement('div'); adOverlay.className = 'd-adoverlay hidden';
  var toastEl = document.createElement('div'); toastEl.className = 'd-toast';

  [hud, parkEl, fenceBar, penEl, toolsEl, modal, adOverlay, toastEl].forEach(function (el) { phone.appendChild(el); });

  /* ---------- utils ---------- */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function randDir() { return DIRS[Math.floor(Math.random() * 4)]; }
  function measurePen() {
    var w = penEl.clientWidth, h = penEl.clientHeight;
    if (w > 0 && h > 0) aspect = h / w;
  }
  function spanY() { return 100 * aspect; }
  /* 方向偏向：40% 概率朝最近的边（模拟器验证：互锁救援次数减半） */
  function smartDir(x, yu) {
    if (Math.random() < 0.4) {
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
          uid: uidSeq++, type: TYPES[m % DEMO_TYPE_COUNT], dir: smartDir(pts[m].x, pts[m].yu),
          x: pts[m].x, yu: pts[m].yu,
          rare: Math.random() < 0.06, pop: false
        });
      }
      for (var r = 0; r < ROCK_N; r++) {
        herd.push({ uid: uidSeq++, obstacle: true, dir: 'up', x: pts[HERD_N + r].x, yu: pts[HERD_N + r].yu });
      }
      un = countUnlocked();
      tries++;
    } while (un < 6 && tries < 40);
  }

  /* ---------- orders / slots ---------- */
  function activeOrders() {
    return slots.filter(function (s) { return s.state === 'truck' && s.order; });
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
    var n = (ids.length >= 2 && Math.random() < 0.6) ? 2 : 1;
    var chosen = shuffle(ids.slice()).slice(0, n);
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
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (i >= slotsOpen) break;
      if (s.state !== 'empty') continue;
      if (ordersDone + activeOrders().length >= TARGET_ORDERS) return;
      var o = makeOrder();
      if (!o) return;
      s.order = o;
      s.state = 'truck';
      s.fresh = true;
      setTimeout(function (sl) { sl.fresh = false; }, 500, s);
    }
  }

  /* ---------- render ---------- */
  function renderPark() {
    var cnt = countFence();
    var html = '';
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (s.state === 'locked') {
        html += '<div class="d-slot locked" data-slot="' + i + '" title="看广告解锁车位">' +
          '<span style="font-size:.95rem">🔒</span><small>看广告<br>解锁车位</small></div>';
      } else if (s.state === 'empty') {
        html += '<div class="d-slot empty"><small>空车位</small></div>';
      } else {
        var needs = [];
        for (var id in s.order.items) {
          var have = Math.min(cnt[id] || 0, s.order.items[id]);
          needs.push(TYPE_MAP[id].emoji + '<span class="' + (have >= s.order.items[id] ? 'got' : '') + '">' + have + '/' + s.order.items[id] + '</span>');
        }
        html += '<div class="d-slot truck' + (s.fresh ? ' arrive' : '') + '" style="border-color:' + SLOT_COLORS[i % SLOT_COLORS.length] + '">' +
          '<span class="d-slot-truck">🚚</span>' +
          '<span class="d-slot-needs">' + needs.join(' ') + '</span>' +
          '</div>';
      }
    }
    parkEl.innerHTML = html;
  }

  function renderFence() {
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
        slot.textContent = a.type.emoji;
        if (a.rare) slot.style.textShadow = '0 0 7px rgba(245,180,85,.95)';
        if (a.pop) { slot.classList.add('pop'); a.pop = false; }
      }
      fenceEl.appendChild(slot);
    }
    fenceBar.classList.toggle('full', fence.length >= FENCE_MAX);
  }

  function renderPen() {
    var ys = spanY();
    var html = '';
    for (var k = 0; k < herd.length; k++) {
      var a = herd[k];
      var top = (a.yu / ys) * 100;
      if (a.obstacle) {
        html += '<div class="p-rock" style="left:' + a.x + '%;top:' + top + '%;transform:translate(-50%,-50%)">🪨</div>';
        continue;
      }
      var blocked = isBlocked(a);
      var cls = 'p-a' + (blocked ? ' blocked' : '') + (a.rare ? ' rare' : '');
      if (craneMode && blocked) cls += ' crane-target';
      var inCls = 'p-in' + (a.pop ? ' pop' : '') + ((pendingUnlock && pendingUnlock.has(a.uid)) ? ' unlock' : '');
      a.pop = false;
      html += '<div class="' + cls + '" data-uid="' + a.uid + '" style="left:' + a.x + '%;top:' + top + '%;transform:translate(-50%,-50%)">' +
        '<i class="' + inCls + '">' + a.type.emoji + '</i><span class="p-ar ' + a.dir + '"></span></div>';
    }
    penEl.innerHTML = html;
  }

  function renderTools() {
    craneBtn.textContent = craneMode ? '🏗️ 点被挡动物' : '🏗️ 吊车 ×' + craneLeft;
    craneBtn.classList.toggle('crane-active', !!craneMode);
    craneBtn.classList.toggle('disabled', craneLeft <= 0 && !craneMode);
    flipBtn.textContent = '🔄 翻转 ×' + flipLeft;
    flipBtn.classList.toggle('disabled', flipLeft <= 0);
    shufBtn.textContent = '🔀 洗牌 ×' + shufLeft;
    shufBtn.classList.toggle('disabled', shufLeft <= 0);
  }

  function renderHUD() {
    coinEl.textContent = '🪙 ' + coins;
    progEl.textContent = '订单 ' + ordersDone + '/' + TARGET_ORDERS;
  }

  function renderAll() { renderPark(); renderFence(); renderPen(); renderHUD(); renderTools(); }

  /* ---------- modal / toast / ad ---------- */
  function showModal(html) {
    modal.innerHTML = '<div class="panel">' + html + '</div>';
    modal.classList.remove('hidden');
  }
  function hideModal() { modal.classList.add('hidden'); }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }
  function hint(msg) {
    var now = Date.now();
    if (now - lastHintAt < 1500) return;
    lastHintAt = now;
    toast(msg);
  }

  function simulateAd(cb) {
    adOverlay.classList.remove('hidden');
    adOverlay.innerHTML =
      '<div class="ad-tag">SIMULATED REWARDED AD</div>' +
      '<div class="ad-count">2</div>' +
      '<div style="font-size:.78rem;color:var(--muted)">广告播放中（演示）…</div>';
    var n = 2;
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

  /* 任一卡车订单凑齐 → 发车（多车位各自独立结算） */
  function tryFulfillOnce() {
    var cnt = countFence();
    for (var i = 0; i < SLOT_TOTAL; i++) {
      var s = slots[i];
      if (s.state !== 'truck' || !s.order) continue;
      var ok = true;
      for (var id in s.order.items) {
        if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
      }
      if (!ok) continue;
      var rareBonus = 0;
      for (var id1 in s.order.items) {
        var need = s.order.items[id1], k;
        for (k = 0; k < fence.length && need > 0;) {
          var a = fence[k];
          if (a.type.id === id1 && !a.rare) { fence.splice(k, 1); need--; soldByType[id1].n++; }
          else k++;
        }
        for (k = 0; k < fence.length && need > 0;) {
          var b = fence[k];
          if (b.type.id === id1) { rareBonus += b.type.price * 2; fence.splice(k, 1); need--; soldByType[id1].n++; soldByType[id1].rare++; }
          else k++;
        }
      }
      coins += s.order.value + rareBonus;
      ordersDone++;
      s.state = 'empty'; s.order = null; s.fresh = false;
      if (ordersDone >= TARGET_ORDERS) { win(); return true; }
      tryDispatch();
      renderAll();
      return true;
    }
    return false;
  }

  /* 调和：装车链 + 死单换车（订单动物已不存在时空驶换新车） */
  function reconcile() {
    var guard = 0;
    while (guard++ < 25 && phase === 'play') {
      if (tryFulfillOnce()) continue;
      var dead = null;
      for (var i = 0; i < SLOT_TOTAL; i++) {
        var s = slots[i];
        if (s.state === 'truck' && s.order && !orderSatisfiable(s.order)) { dead = s; break; }
      }
      if (dead) {
        dead.state = 'empty'; dead.order = null;
        tryDispatch();
        renderAll();
        continue;
      }
      break;
    }
    if (phase === 'play' && herd.length === 0 && fence.length === 0 && activeOrders().length === 0) noStockEnd();
  }

  function noStockEnd() {
    phase = 'end';
    showModal(
      '<h4>📦 今天的动物卖完了</h4>' +
      '<p>完成 ' + ordersDone + '/' + TARGET_ORDERS + ' 张订单 · 营收 🪙' + coins + '</p>' +
      '<button class="d-btn blue" data-act="restart">再玩一局</button>'
    );
  }

  function takeAnimal(uid) {
    if (phase !== 'play') return;
    var a = null;
    for (var k = 0; k < herd.length; k++) if (herd[k].uid === uid) { a = herd[k]; break; }
    if (!a || a.obstacle) return;
    var blocked = isBlocked(a);
    if (blocked && !craneMode) {
      hint('这只被挡住了 · 先移走它前方的动物，或用 🏗️ 吊车');
      return;
    }
    if (blocked && craneMode) {
      craneMode = false;
      craneLeft--;
      clearTimeout(craneTimer);
      renderTools();
      toast('🏗️ 吊起一只被挡动物！');
    }
    var before = unlockedSet();
    herd.splice(herd.indexOf(a), 1);
    a.pop = true;
    fence.push(a);
    renderAll();
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
      failTimer = setTimeout(fail, 450);
      if (allLocked()) rescueLock(); /* 挤爆的同时若全场互锁，先备好吊车 */
      return;
    }
    if (allLocked()) rescueLock();
  }

  /* ---------- crane / tools ---------- */
  function allLocked() {
    return countUnlocked() === 0 && herd.some(function (x) { return !x.obstacle; });
  }
  function rescueLock() {
    craneLeft++;
    renderTools();
    toast('⚠️ 全场互锁！赠送一次免费吊车');
    armCrane();
  }
  function armCrane(silent) {
    craneMode = true;
    renderTools();
    renderPen();
    if (!silent) toast('吊车模式：点击任意被挡动物');
    clearTimeout(craneTimer);
    craneTimer = setTimeout(function () {
      if (phase === 'play' && allLocked()) {
        armCrane(true); /* 仍互锁：吊车继续待命（不额外赠送次数） */
        return;
      }
      craneMode = false;
      renderTools();
      renderPen();
    }, 8000);
  }
  function enterCraneMode() {
    if (phase !== 'play' || craneMode) return;
    if (craneLeft <= 0) { toast('本局吊车次数已用完'); return; }
    if (craneUsed === 0) {
      craneUsed++;
      armCrane();
      return;
    }
    simulateAd(function () { craneUsed++; armCrane(); });
  }

  function useFlip() {
    if (phase !== 'play') return;
    if (flipLeft <= 0) { toast('翻转次数已用完'); return; }
    simulateAd(function () {
      flipLeft--;
      herd.forEach(function (a) { if (!a.obstacle) a.dir = randDir(); });
      renderAll();
      toast('全体转向完成！');
      if (allLocked()) rescueLock();
    });
  }
  function useShuffle() {
    if (phase !== 'play') return;
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
      if (allLocked()) rescueLock();
    });
  }

  /* ---------- fail / win ---------- */
  function fail() {
    phase = 'fail';
    showModal(
      '<h4>💥 围栏挤爆了！</h4>' +
      '<p>7 格围栏已满，且当前订单无法完成。</p>' +
      '<button class="d-btn blue" data-act="release">🏗️ 吊车放生 3 只 · 看广告<br><span class="ad-note">返还基础价 50% 金币 · 继续本局</span></button>' +
      '<button class="d-btn blue" data-act="sellall">💰 清仓大甩卖 · 看广告<br><span class="ad-note">全部围栏动物按 70% 卖给收购商人</span></button>' +
      '<button class="d-btn ghost" data-act="help">📣 发好友求救 · 免费<br><span class="ad-note">好友点击后获赠 1 次吊车</span></button>' +
      '<button class="d-btn ghost" data-act="restart">放弃重开（免费）</button>'
    );
  }

  function win() {
    phase = 'win';
    var stats = [];
    TYPES.forEach(function (t) {
      var s = soldByType[t.id];
      if (s.n > 0) {
        stats.push(t.emoji + '×' + s.n + (s.rare > 0 ? ' <span style="color:var(--accent2)">✨' + s.rare + '</span>' : ''));
      }
    });
    showModal(
      '<h4>🎉 今日收市！</h4>' +
      '<p>完成 ' + TARGET_ORDERS + ' 张订单 · 农场营收</p>' +
      '<div style="font-family:var(--font-mono);font-size:2rem;color:var(--accent2);margin:6px 0 10px">🪙 ' + coins + '</div>' +
      '<p style="font-size:.92rem">' + (stats.join(' &nbsp; ') || '——') + '</p>' +
      (doubled
        ? '<button class="d-btn disabled">✓ 营收已翻倍</button>'
        : '<button class="d-btn blue" data-act="double">📺 双倍营收 · 看广告</button>') +
      '<button class="d-btn" data-act="share">📤 生成营收分享卡</button>' +
      '<button class="d-btn ghost" data-act="restart">再玩一局</button>'
    );
  }

  function sharePreview() {
    var anim = TYPES.map(function (t) { return t.emoji; }).join(' ');
    showModal(
      '<h4>分享卡预览</h4>' +
      '<div style="background:var(--bg3);border:1px solid var(--rule);border-radius:10px;padding:16px;margin-bottom:12px;text-align:center">' +
      '<div style="font-size:.72rem;color:var(--muted);font-family:var(--font-mono)">今日农场营收</div>' +
      '<div style="font-size:1.6rem;color:var(--accent2);font-family:var(--font-mono);margin:4px 0">🪙 ' + coins + '</div>' +
      '<div style="font-size:1.25rem">' + anim + '</div>' +
      '<div style="font-size:.7rem;color:var(--muted);margin-top:8px">动物集市 · 完成 ' + TARGET_ORDERS + ' 单收市</div>' +
      '</div>' +
      '<button class="d-btn blue" data-act="restart">保存并再来一局</button>'
    );
  }

  /* ---------- modal actions ---------- */
  modal.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'start') { phase = 'play'; hideModal(); return; }
    if (act === 'restart') { resetGame(); return; }
    if (phase === 'fail') {
      if (act === 'release') {
        simulateAd(function () {
          var refund = 0, n = Math.min(3, fence.length);
          for (var k = 0; k < n; k++) {
            var idx = Math.floor(Math.random() * fence.length);
            var a = fence.splice(idx, 1)[0];
            refund += Math.floor(a.type.price * (a.rare ? 3 : 1) * 0.5);
          }
          coins += refund;
          phase = 'play';
          hideModal();
          renderAll();
          reconcile();
          if (allLocked()) rescueLock();
          toast('放生 ' + n + ' 只 · 回收 🪙' + refund);
        });
      } else if (act === 'sellall') {
        simulateAd(function () {
          var refund = 0;
          fence.forEach(function (a) { refund += Math.floor(a.type.price * (a.rare ? 3 : 1) * 0.7); });
          fence = [];
          coins += refund;
          phase = 'play';
          hideModal();
          renderAll();
          reconcile();
          if (allLocked()) rescueLock();
          toast('清仓完成 · 回收 🪙' + refund);
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
          win();
          toast('营收翻倍！');
        });
      } else if (act === 'share') {
        sharePreview();
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
    if (!el || phase !== 'play') return;
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

  /* ---------- reset / init ---------- */
  function resetGame() {
    clearTimeout(craneTimer);
    clearTimeout(failTimer);
    craneMode = false;
    coins = 0; ordersDone = 0;
    craneLeft = CRANE_MAX; craneUsed = 0; doubled = false;
    flipLeft = 2; shufLeft = 2;
    fence = [];
    soldByType = {};
    TYPES.forEach(function (t) { soldByType[t.id] = { n: 0, rare: 0 }; });
    slots = [];
    slotsOpen = SLOT_OPEN;
    for (var i = 0; i < SLOT_TOTAL; i++) {
      slots.push({ state: i < SLOT_OPEN ? 'empty' : 'locked', order: null, fresh: false });
    }
    measurePen();
    generate();
    tryDispatch();
    phase = 'play';
    hideModal();
    adOverlay.classList.add('hidden');
    renderAll();
    if (firstRun) {
      firstRun = false;
      phase = 'intro';
      showModal(
        '<h4>🚜 动物集市 · 开局须知</h4>' +
        '<p style="text-align:left">1. 上方<b>停车位</b>的卡车各收不同动物，凑齐自动发车收钱（后 2 个车位看广告解锁）<br>' +
        '2. 点击牧场里<b>前方无遮挡</b>的动物（变灰带🔒 = 被挡住）送进围栏<br>' +
        '3. 围栏只有 <b>' + FENCE_MAX + ' 格</b>，装满会挤爆；🔄 翻转 / 🔀 洗牌可解围，被挡住的用 🏗️ 吊车直接吊走<br>' +
        '4. 完成 <b>' + TARGET_ORDERS + ' 张订单</b>收市</p>' +
        '<button class="d-btn blue" data-act="start">开始经营</button>'
      );
    }
  }

  resetGame();
})();
