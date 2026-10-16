/* ============================================================
 * 《动物集市》原型 · 数据与状态层（单一数据源）
 * 状态经 localStorage 持久化；页面只读本文件，禁止散落数据
 * ============================================================ */
(function () {
  'use strict';

  var DB = {
    level: 5, // 当前关卡进度
    animals: [
      { id: 'chicken', emoji: '🐔', name: '鸡', price: 8 },
      { id: 'duck', emoji: '🦆', name: '鸭', price: 10 },
      { id: 'rabbit', emoji: '🐰', name: '兔', price: 12 },
      { id: 'sheep', emoji: '🐑', name: '羊', price: 15 },
      { id: 'pig', emoji: '🐖', name: '猪', price: 18 },
      { id: 'cow', emoji: '🐮', name: '牛', price: 25 }
    ],
    /* 图鉴：卖出累计 { n: 普通累计, rare: 闪光累计 } */
    collection: {
      chicken: { n: 42, rare: 2 }, duck: { n: 31, rare: 1 }, rabbit: { n: 28, rare: 3 },
      sheep: { n: 19, rare: 1 }, pig: { n: 12, rare: 0 }, cow: { n: 7, rare: 1 }
    },
    hidden: [
      { id: 'alpaca', emoji: '🦙', name: '羊驼', price: 40 },
      { id: 'peacock', emoji: '🦚', name: '孔雀', price: 45 },
      { id: 'deer', emoji: '🦌', name: '梅花鹿', price: 50 }
    ],
    /* 农场装饰 8 件：金币 sink，每件 +2% 初始解锁概率 */
    decorations: [
      { id: 'coop', name: '鸡舍', emoji: '🏚️', price: 200, desc: '母鸡们的新家，下蛋更勤快' },
      { id: 'pond', name: '池塘', emoji: '🏞️', price: 350, desc: '鸭子有了戏水的地方' },
      { id: 'pen', name: '羊圈', emoji: '🧱', price: 500, desc: '羊群晚上睡得安稳' },
      { id: 'barn', name: '谷仓', emoji: '🛖', price: 800, desc: '屯草料，冬天不慌' },
      { id: 'mill', name: '风车', emoji: '🎡', price: 1200, desc: '磨面发电两不误' },
      { id: 'scare', name: '稻草人', emoji: '🎃', price: 1600, desc: '乌鸦不敢来捣乱' },
      { id: 'orchard', name: '果园', emoji: '🌳', price: 2200, desc: '苹果熟了掉一地' },
      { id: 'green', name: '温室', emoji: '🏡', price: 3000, desc: '冬天也能种西瓜' }
    ],
    daily: {
      seed: '#20260905',
      theme: '今日双倍订单日',
      joined: 12864,
      score: 0,
      beat: 78,
      deadlineHours: 6,
      friends: [
        { name: '王秀兰', score: 1180, avatar: 'sheep' },
        { name: '老姐妹', score: 960, avatar: 'chicken' },
        { name: '广场舞李姐', score: 870, avatar: 'duck' },
        { name: '亲家母', score: 720, avatar: 'rabbit' },
        { name: '我', score: 0, avatar: '👩‍🌾' },
        { name: '二舅妈', score: 430, avatar: 'pig' },
        { name: '小区张阿姨', score: 260, avatar: 'cow' }
      ],
      province: [
        { name: '追风赶海人', score: 2360, avatar: 'cow' },
        { name: '青山绿水', score: 2110, avatar: 'deer' },
        { name: '牧羊的星星', score: 1940, avatar: 'sheep' },
        { name: '农场主老刘', score: 1750, avatar: '🧑‍🌾' },
        { name: '田园牧歌', score: 1530, avatar: 'pig' },
        { name: '花开半夏', score: 1320, avatar: 'peacock' },
        { name: '山水之间', score: 1105, avatar: 'chicken' }
      ]
    },
    signin: {
      streak: 3,
      days: [
        { coins: 30 }, { coins: 50 }, { coins: 80 }, { coins: 120 },
        { coins: 200, double: true }, { coins: 300 }, { coins: 500, double: true }
      ]
    }
  };

  /* ---------- 持久化存储 ---------- */
  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式忽略 */ } }
  };

  var walletData = LS.get('am_wallet', { coins: 1280, owned: ['coop', 'pond'], signinDay: 3, signinDone: [true, true, true, false, false, false, false] });
  function save() { LS.set('am_wallet', walletData); }

  var toastTimer = null;

  window.AM = {
    DB: DB,

    wallet: {
      get coins() { return walletData.coins; },
      add: function (n) { walletData.coins += n; save(); window.AM.syncCoins(); },
      spend: function (n) {
        if (walletData.coins < n) return false;
        walletData.coins -= n; save(); window.AM.syncCoins();
        return true;
      },
      data: walletData
    },

    progress: {
      get: function (k, d) { return LS.get('am_p_' + k, d); },
      set: function (k, v) { LS.set('am_p_' + k, v); }
    },

    /* 同步所有金币显示位 */
    syncCoins: function () {
      var els = document.querySelectorAll('[data-am-coins]');
      for (var i = 0; i < els.length; i++) els[i].textContent = window.AM.wallet.coins;
    },

    /* 页内 toast */
    toast: function (msg) {
      var phone = document.querySelector('.phone');
      if (!phone) return;
      var t = phone.querySelector('.toast');
      if (!t) {
        t = document.createElement('div');
        t.className = 'toast';
        phone.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
    },

    /* 模拟激励视频：全屏遮罩 + 倒计时 + 完成回调 */
    simulateAd: function (phone, title, cb) {
      var root = phone || document.querySelector('.phone');
      if (!root) { cb(); return; }
      var ov = document.createElement('div');
      ov.className = 'adoverlay';
      ov.innerHTML =
        '<span class="ad-tag">SIMULATED REWARDED AD</span>' +
        '<div class="ad-count">3</div>' +
        '<div class="ad-note">' + (title || '广告播放中（演示）…') + '</div>';
      root.appendChild(ov);
      var n = 3;
      var iv = setInterval(function () {
        n--;
        if (n <= 0) {
          clearInterval(iv);
          ov.remove();
          cb();
        } else {
          var c = ov.querySelector('.ad-count');
          if (c) c.textContent = n;
        }
      }, 1000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.AM.syncCoins);
  } else {
    window.AM.syncCoins();
  }
})();
