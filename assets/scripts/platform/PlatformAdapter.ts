/* 平台适配层（PLATFORM）：全工程唯一允许出现 wx.* 的文件。
 *
 * 修改时间：2026-09-19（Mock 留桩 → 真实激励视频接入）：
 *   ① 入口三态化。旧接口 `showRewardedAd(onDone, onSkip)` 只有"成功"语义，
 *      而 7 个调用点为了自测都把 onSkip 也接到 onDone（`onSkip || onDone`），
 *      于是**用户看 2 秒关掉也发奖、无填充也发奖、未配置 ID 更是直接 onDone 放行**
 *      —— 刷奖励漏洞 + 商业化归零。现改为 `AdOutcome` 单一出口：
 *      rewarded / skipped / unavailable，**只有 rewarded 允许调用方发放奖励**。
 *   ② 实例池 + 失效重建。旧实现把 videoAd 单例缓存到底，一旦 onError（尤其 1004）
 *      整局再也拉不起广告——官方实测：1004 后反复 load() 永远拉不到，必须
 *      destroy() 后重新 createRewardedVideoAd。现按 REWARDED_AD_UNITS 轮换，
 *      失败即销毁，下次换 ID / 重建实例。
 *   ③ 错误码分流（官方口径）：
 *      1000 后端错误 / 1003 内部错误 / 1004 无合适广告 → 瞬时或正常无填充，冷却后可重试；
 *      1001 参数错误 / 1002 广告单元无效 / 1005 审核中 / 1006 被驳回 / 1007 能力被封禁 /
 *      1008 广告位已关闭 → **配置态**，该 ID 永久停用，不再让玩家白点。
 *      未知码按配置态处理（保守：避免在不会恢复的 ID 上空转）。
 *   ④ 回调解绑 + 实例回收。旧实现走异常路径时会残留 onClose/onError 监听且从不 destroy；
 *      现在终局唯一出口负责 off* + 回收。
 *
 * ⚠️ 微信激励视频的两个反直觉行为（本次实现的关键依据）：
 *   a. `createRewardedVideoAd` 的**自动拉取不触发 onError**，只触发 onLoad；
 *      拉取失败（1004）静默无回调 ⇒ 只有 `show().catch()` → 手动 `load()` 才拿得到错误码。
 *   b. 基础库 < 2.1.0 时 onClose 的 res 为 undefined，按官方口径视为**完整观看**。
 *
 * 保留：DevAdapter（浏览器 / 编辑器预览）走 view 注入的 Mock 演示层，行为不变。
 *
 * 修改时间：2026-10-07 23:34（**多渠道分发地基**）—— `WxAdapter` 泛化为
 *   `MiniGameAdAdapter(host)` + 平台宿主注册表。为什么这么做（第一性原理）：
 *     ① 各小游戏平台的激励视频 API 是**同构**的——微信 `wx.createRewardedVideoAd` 与
 *        抖音 `tt.createRewardedVideoAd` 的入参、`.load()/.show()/.onClose(res.isEnded)/`
 *        `.onError(err.errCode)/.offClose/.offError` 逐条对齐（连 1001~1008 错误码语义都一致），
 *        支付宝 `my.createRewardedAd` 结构相同、仅**方法名与错误码段**不同（6xxxx）。
 *        既然如此，"每加一个渠道就复制一份适配器"是纯重复劳动；把**宿主差异**收敛进
 *        `MiniGameHost`（建实例 / 错误码分类 / 平台键）三件事，换渠道只换宿主。
 *     ② 广告位 ID 必须按平台寻址（见 AdConfig.AD_UNITS），故适配器构造时即绑定平台键。
 *   微信行为**逐行不变**：`wechatHost` 就是原 `WxAdapter` 的全部平台相关逻辑。
 *
 * 🔧 新增渠道的标准动作（两步，**无需改 AdService / view / core**）：
 *   ① `platform/AdConfig.ts` 的 `AD_UNITS` 填该平台广告位 ID；
 *   ② 在下方注册一个 `MiniGameHost` 并接进 `detectMiniGameHost()`。
 *
 * banner / 插屏扩展位：在本文件新增 showBanner / showInterstitial，复用 `AdOutcome`
 *   与错误码分流（destroy 重建逻辑与 rewarded 逐行同构），点位配置见 platform/AdConfig.ts。
 */
import { AD_RETRY_COOLDOWN_MS, AD_UNITS } from './AdConfig';
import type { PlatformKey } from './AdConfig';

/** 激励视频的终局三态（**唯一真相源**，调用方据此决定发不发奖） */
export type AdOutcome =
  | 'rewarded'     // 完整看完 → 发奖
  | 'skipped'      // 中途关闭 → 不发奖，可立即重试
  | 'unavailable'; // 无填充 / 配置态错误 / 未配置 ID / 超时 → 不发奖，提示稍后重试

export type AdErrorState = 'transient' | 'fatal' | 'unconfigured';

export interface AdErrorDetail {
  /** 微信 errCode（1000-1008） */
  code?: number;
  msg?: string;
  /** 分流依据：transient 可重试 / fatal 该 ID 停用 / unconfigured 未配置 */
  state: AdErrorState;
}

export type AdCallback = (outcome: AdOutcome, detail?: AdErrorDetail) => void;

export interface PlatformAdapter {
  readonly name: string;
  showRewardedAd(point: string, cb: AdCallback): void;
  /** 释放平台资源（广告实例）；重开局不调用——实例池与冷却状态跨局复用 */
  destroy(): void;
}

declare const wx: any;

/** 瞬时 / 正常无填充的错误码：冷却后可重试。其余（含未知码）按配置态停用该 ID。
 *  ⚠️ 微信与抖音**共用此段** —— 两家官方文档的 1001~1008 语义逐条对齐：
 *     瞬时 = 1000 后端错误 / 1003 内部错误 / 1004 无合适广告；
 *     配置态 = 1001 参数错误 / 1002 单元无效 / 1005 审核中 / 1006 场景不支持 /
 *              1007 被禁封 / 1008 已关闭。 */
const MINI_GAME_TRANSIENT_CODES = [1000, 1003, 1004];

/** 宿主小游戏运行时的**平台差异**收敛点：换平台只换这三件事。
 *  刻意只抽必要部分——广告位池、实例池、冷却、看门狗、三态契约都是跨平台共用的，
 *  留在适配器内，避免把"平台差异"和"通用策略"混在一起。 */
interface MiniGameHost {
  /** 平台键：用于在 `AdConfig.AD_UNITS` 里寻址本平台的广告位池 */
  readonly key: PlatformKey;
  /** 适配器名（日志 / 排查用），如 'wx' */
  readonly name: string;
  /** 创建激励视频实例（微信 / 抖音为 createRewardedVideoAd，支付宝为 createRewardedAd） */
  createRewarded(opts: { adUnitId: string }): any;
  /** 该错误码是否属于「瞬时 / 无填充」（可冷却后重试）；其余（含未知码）按配置态停用。
   *  ⚠️ 未知码归配置态是**保守**选择：避免在一个不会恢复的 ID 上空转玩家的点击。 */
  isTransient(code: number | undefined): boolean;
}

/** 微信宿主（= 原 WxAdapter 的平台相关逻辑，行为逐行不变） */
const wechatHost: MiniGameHost = {
  key: 'wechat',
  name: 'wx',
  createRewarded: function (o) { return wx.createRewardedVideoAd(o); },
  isTransient: function (c) {
    // ⚠️ 刻意保留原 `isFatalCode` 的边界语义：**errCode 缺失时按瞬时处理**。
    //    不得改成"缺码即配置态"——那会把一次没带错误码的失败，永久停用一个好 ID。
    return c === undefined || MINI_GAME_TRANSIENT_CODES.indexOf(c) >= 0;
  },
};

/** 宿主探测（平台注册表）。新增渠道在此加一个分支即可，`pickAdapter` 无需改动。
 *  ⚠️ 抖音（tt）/ 支付宝（my）**待各自广告位开通后再登记**：宿主一旦被选中，全部点位
 *     就会走真机链路并返回 'unavailable'，反而让 dev 演示层失效——
 *     未配置广告位的渠道不注册（与 AdService 的"未配置绝不静默发奖"同一纪律）。 */
function detectMiniGameHost(): MiniGameHost | null {
  try {
    if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) return wechatHost;
  } catch (e) { /* 非 wx 环境走 dev */ }
  return null;
}

function logAd(point: string, msg: string): void {
  console.warn('[ad]', point, msg);
}

/** 池内单个广告位 ID 的运行状态 */
interface AdSlot {
  readonly id: string;
  fails: number;
  lastUsed: number;
  cooldownUntil: number;
  /** 配置态错误 ⇒ 永久停用（ID 写错 / 审核中 / 被封禁 / 已关闭） */
  dead: boolean;
}

export class MiniGameAdAdapter implements PlatformAdapter {
  readonly name: string;
  private readonly host: MiniGameHost;
  private readonly pool: AdSlot[];
  /** 当前存活的平台广告实例（任意时刻至多 1 个 ⇒ 不需要 multiton 多例模式） */
  private cur: { id: string; inst: any } | null = null;

  constructor(host: MiniGameHost) {
    this.host = host;
    this.name = host.name;
    this.pool = AD_UNITS[host.key].map(function (id) {
      return { id: id, fails: 0, lastUsed: 0, cooldownUntil: 0, dead: false };
    });
  }

  showRewardedAd(point: string, cb: AdCallback): void {
    if (!this.pool.length) {
      // 未配置广告位：**绝不**静默放行（旧留桩行为），走未成交兜底
      cb('unavailable', { state: 'unconfigured', msg: '未配置广告位 ID（AD_UNITS.' + this.host.key + ' 为空）' });
      return;
    }
    const slot = this.pick();
    if (!slot) {
      cb('unavailable', { state: 'transient', msg: '广告位冷却中，请稍后再试' });
      return;
    }

    let inst: any;
    try {
      inst = this.acquire(slot.id);
    } catch (e) {
      slot.dead = true;
      logAd(point, 'createRewardedVideoAd 抛出：' + String(e));
      cb('unavailable', { state: 'fatal', msg: '广告组件创建失败' });
      return;
    }

    const host = this.host;   // 供下方 function 声明式回调捕获（它们没有 this）
    let settled = false;
    const finish = (o: AdOutcome, d?: AdErrorDetail): void => {
      if (settled) return;
      settled = true;
      try { inst.offClose(onClose); inst.offError(onError); } catch (e) { /* 组件异常，忽略 */ }
      slot.lastUsed = Date.now();
      if (o === 'rewarded') {
        slot.fails = 0;
      } else {
        slot.fails++;
        slot.cooldownUntil = Date.now() + AD_RETRY_COOLDOWN_MS;
        if (d && d.state === 'fatal') slot.dead = true;
        this.dropCurrent();   // 官方实测：onError 后必须销毁重建才能恢复
      }
      cb(o, d);
    };
    function onClose(res: any): void {
      // 基础库 < 2.1.0 的 res 为 undefined ⇒ 按官方口径视为完整观看
      const ok = res === undefined || res.isEnded === true;
      if (!ok) logAd(point, '用户中途关闭，不发奖');
      finish(ok ? 'rewarded' : 'skipped', { state: 'transient', msg: ok ? '完整观看' : '中途关闭' });
    }
    function onError(err: any): void {
      const code = err ? Number(err.errCode) : undefined;
      const fatal = !host.isTransient(code);
      logAd(point, 'onError errCode=' + code + ' state=' + (fatal ? 'fatal' : 'transient'));
      finish('unavailable', {
        code: code,
        msg: err && err.errMsg,
        state: fatal ? 'fatal' : 'transient',
      });
    }

    inst.onClose(onClose);
    inst.onError(onError);
    inst.show().catch(() => {
      // 官方行为：自动拉取失败不触发 onError，只有手动 load() 才拿得到错误码（如 1004）
      inst.load().then(() => inst.show()).catch(() => {
        logAd(point, '拉取失败（show / load 双失败）');
        finish('unavailable', { state: 'transient', msg: '广告拉取失败' });
      });
    });
  }

  destroy(): void {
    this.dropCurrent();
  }

  /** 池状态快照（排查 / 单测用，不含平台实例本身） */
  slots(): { id: string; fails: number; dead: boolean; cooling: boolean }[] {
    const now = Date.now();
    return this.pool.map(function (s) {
      return { id: s.id, fails: s.fails, dead: s.dead, cooling: s.cooldownUntil > now };
    });
  }

  /** 选槽：剔除已停用与冷却中的；失败次数少者优先，同则最久未使用者优先（轮换摊薄） */
  private pick(): AdSlot | null {
    const now = Date.now();
    const alive = this.pool.filter(function (s) { return !s.dead && s.cooldownUntil <= now; });
    if (!alive.length) return null;
    alive.sort(function (a, b) { return (a.fails - b.fails) || (a.lastUsed - b.lastUsed); });
    return alive[0];
  }

  /** 取实例：同 ID 复用；换 ID 则先销毁旧实例 */
  private acquire(id: string): any {
    if (this.cur && this.cur.id === id) return this.cur.inst;
    this.dropCurrent();
    const inst = this.host.createRewarded({ adUnitId: id });
    this.cur = { id: id, inst: inst };
    return inst;
  }

  private dropCurrent(): void {
    if (!this.cur) return;
    try { this.cur.inst.destroy(); } catch (e) { /* 已销毁或组件异常 */ }
    this.cur = null;
  }
}

/** 浏览器 / 编辑器预览适配：由 view 注入 Mock 广告展示层（3 秒倒计时 + 跳过钮）。
 *  演示层回调 true = 看完（发奖），false = 中途退出（不发奖）。
 *  未注入演示层时返回 'unavailable' —— 不再静默发奖（旧 DevAdapter 的 `else onDone()`
 *  与 MiniGameAdAdapter 的空 ID 放行是同一类漏洞）。 */
export class DevAdapter implements PlatformAdapter {
  readonly name = 'dev';
  display: ((done: (watched: boolean) => void) => void) | null = null;

  showRewardedAd(_point: string, cb: AdCallback): void {
    if (!this.display) {
      cb('unavailable', { state: 'unconfigured', msg: '未注入演示广告层' });
      return;
    }
    this.display(function (watched) {
      cb(watched ? 'rewarded' : 'skipped', { state: 'transient', msg: watched ? '演示看完' : '演示跳过' });
    });
  }

  destroy(): void { /* 无平台资源 */ }
}

export function pickAdapter(): PlatformAdapter {
  const host = detectMiniGameHost();
  return host ? new MiniGameAdAdapter(host) : new DevAdapter();
}
