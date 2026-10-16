/* ============================================================
 * 《动物集市》原型 · 接口桩层（api.js）
 * 形状即未来真实接口；当前全部走 mock + localStorage。
 * 上线时逐个替换为 wx.request / 云函数调用，签名保持不变。
 * ============================================================ */
(function () {
  'use strict';

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var API = {
    /* GET /api/settlement/last —— 读取对局结果；无真实对局时回落演示数据 */
    fetchSettlement: async function () {
      await delay(350);
      var r = null;
      try { r = JSON.parse(localStorage.getItem('am_last_result') || 'null'); } catch (e) { r = null; }
      if (!r) {
        r = {
          level: 5, coins: 412, ordersDone: 5, fenceLeft: 5, doubled: false,
          best: { id: 'cow', emoji: '🐮', name: '闪光牛', value: 150 },
          stats: { chicken: 4, duck: 3, rabbit: 3, sheep: 2, pig: 2, cow: 1, rare: 1 }
        };
      }
      return r;
    },

    /* GET /api/decorations —— 装饰列表 + 已购状态 */
    fetchDecorations: async function () {
      await delay(300);
      return AM.DB.decorations.map(function (d) {
        var owned = AM.wallet.data.owned.indexOf(d.id) >= 0;
        return { id: d.id, name: d.name, emoji: d.emoji, price: d.price, desc: d.desc, owned: owned };
      });
    },

    /* POST /api/decorations/:id/buy —— 购买装饰（金币扣减） */
    buyDecoration: async function (id) {
      await delay(450);
      var d = AM.DB.decorations.find(function (x) { return x.id === id; });
      if (!d) return { ok: false, msg: '装饰不存在' };
      if (AM.wallet.data.owned.indexOf(id) >= 0) return { ok: false, msg: '已经买过啦' };
      if (!AM.wallet.spend(d.price)) return { ok: false, msg: '金币不够，先去卖点动物吧' };
      AM.wallet.data.owned.push(id);
      try { localStorage.setItem('am_wallet', JSON.stringify(AM.wallet.data)); } catch (e) { }
      return { ok: true, msg: d.name + '建成啦！解锁概率 +2%' };
    },

    /* GET /api/daily —— 今日挑战与榜单 */
    fetchDaily: async function () {
      await delay(300);
      return AM.DB.daily;
    },

    /* GET /api/signin —— 签到状态 */
    fetchSignin: async function () {
      await delay(250);
      var w = AM.wallet.data;
      return {
        streak: AM.DB.signin.streak,
        days: AM.DB.signin.days,
        today: w.signinDay,
        signedToday: !!w.signinDone[w.signinDay]
      };
    },

    /* POST /api/signin —— 今日签到（领取奖励） */
    doSignin: async function () {
      await delay(400);
      var w = AM.wallet.data;
      if (w.signinDone[w.signinDay]) return { ok: false, msg: '今天已经领过啦' };
      var reward = AM.DB.signin.days[w.signinDay].coins;
      w.signinDone[w.signinDay] = true;
      w.signinDay = Math.min(w.signinDay + 1, 6);
      AM.wallet.add(reward);
      try { localStorage.setItem('am_wallet', JSON.stringify(w)); } catch (e) { }
      return { ok: true, coins: reward, msg: '签到成功' };
    },

    /* POST /api/signin/double —— 签到翻倍（激励视频） */
    doubleSignin: async function (coins) {
      await delay(300);
      AM.wallet.add(coins);
      return { ok: true, msg: '奖励已翻倍' };
    }
  };

  window.AM = window.AM || {};
  window.AM.api = API;
})();
