/* 广告服务（SERVICES）：激励视频统一入口。
 *
 * 修改时间：2026-09-19（二次）—— 新增 `AD_ENABLED` 总开关分支：**关闭时（默认）点位直接发放奖励**，
 *   无广告环境也不缺失任何玩法（详见 showRewarded 内注释）；开关打开才启用下列真实广告链路。
 *   2026-09-19 —— 接入真实广告，四处收紧：
 *   ① 入口必须传点位标识（见 services/AdPoints.ts）。埋点从"只有一个 ad_show"
 *      扩为「拉起 / 成交 / 未成交」三事件，广告转化漏斗从此可归因
 *      （旧实现 point 恒为 undefined，等于商业化的唯一迭代依据缺失）。
 *   ② 防重入锁：广告展示中忽略重复触发。旧实现连点两次会并发调起，
 *      真机第二次必然失败 → 走 onError → 旧兜底直接发奖。
 *   ③ 超时兜底：回调若始终不来（极端机型 / 组件异常）按**未成交**结算并释放锁——
 *      锁泄漏会让广告功能整体失效（项目已有 busy 泄漏血案）。
 *   ④ 发奖口径收紧：**只有完整看完**才回调 onReward。
 *      旧实现 `showRewardedAd(onDone, onSkip || onDone)` 而 7 个调用点全不传 onSkip
 *      ⇒ 中途关闭 / 无填充 / 未配置 ID 全部白送奖励（刷奖励漏洞）。
 *
 * 频控策略（微信合规：激励视频须用户主动触发）由调用方保证——全部点位挂在按钮点击上；
 * 平台侧的重试冷却与实例池见 platform/PlatformAdapter.ts + platform/AdConfig.ts。 */
import { AD_ENABLED, AD_WATCHDOG_MS } from '../platform/AdConfig';
import type { AdErrorDetail, AdOutcome } from '../platform/PlatformAdapter';
import { DevAdapter, PlatformAdapter, pickAdapter } from '../platform/PlatformAdapter';
import type { RewardedPoint } from './AdPoints';
import { track } from './TrackService';

export class AdService {
  readonly adapter: PlatformAdapter = pickAdapter();
  private shownCount = 0;
  /** 在途点位（null = 空闲）。既做防重入锁，也做"回调是否属于本次请求"的令牌 */
  private inFlight: RewardedPoint | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  /** dev/浏览器环境：view 注入的 Mock 广告层（3 秒倒计时 + 跳过钮） */
  registerDevDisplay(display: (done: (watched: boolean) => void) => void): void {
    if (this.adapter instanceof DevAdapter) {
      (this.adapter as DevAdapter).display = display;
    }
  }

  get shown(): number {
    return this.shownCount;
  }

  /** 是否有广告正在展示（in-flight） */
  get busy(): boolean {
    return this.inFlight !== null;
  }

  /** 拉起激励视频。point 必传（AdPoints 里的联合类型，拼错在编译期即报错）。
   *  - onReward：**仅完整看完**时回调，调用方在此发放奖励；
   *  - onCancel(outcome)：未成交（中途关闭 / 无填充 / 未配置 ID / 超时）时回调，
   *    调用方**只做 UI 提示，不得修改游戏状态**——这是失败兜底的核心不变量。 */
  showRewarded(point: RewardedPoint, onReward: () => void, onCancel?: (o: AdOutcome) => void): void {
    // 🔴 开关关闭（默认）：无广告环境 —— **直接发放奖励**。
    //   这是"看广告所需的功能不因开关关闭而缺失"的落点：7 个点位全部照常生效，
    //   但不创建任何 wx 实例、不走演示层，页面也无任何广告元素（文案/角标见 view 层）。
    //   刻意不记 ad_show / ad_reward —— 此时并没有广告发生，记录会污染转化数据。
    if (!AD_ENABLED) { onReward(); return; }
    if (this.inFlight !== null) return;   // 防重入：广告已在展示，忽略重复触发
    this.inFlight = point;
    this.shownCount++;
    const t0 = Date.now();
    track({ event: 'ad_show', point: point });
    this.watchdog = setTimeout(
      () => this.settle(point, 'unavailable', onReward, onCancel, t0, undefined, '超时未回调'),
      AD_WATCHDOG_MS,
    );
    this.adapter.showRewardedAd(point, (o, d) => this.settle(point, o, onReward, onCancel, t0, d));
  }

  /** 重开局清理：丢弃在途广告簿记，避免旧回调污染新局。
   *  旧回调到达时 `inFlight` 已不是它 ⇒ settle 直接返回（既不发奖也不误解锁）。
   *  ⚠️ 刻意不调用 adapter.destroy()：实例池与冷却状态应跨局复用。 */
  reset(): void {
    if (this.watchdog !== null) { clearTimeout(this.watchdog); this.watchdog = null; }
    this.inFlight = null;
  }

  /** 终局唯一出口：释放锁 → 埋点 → 分流到「发奖 / 仅提示」。 */
  private settle(
    point: RewardedPoint,
    o: AdOutcome,
    onReward: () => void,
    onCancel: ((o: AdOutcome) => void) | undefined,
    t0: number,
    d?: AdErrorDetail,
    note?: string,
  ): void {
    if (this.inFlight !== point) return;   // 已被其它路径结算（重复 / 超时 / 重开局竞赛）
    this.inFlight = null;
    if (this.watchdog !== null) { clearTimeout(this.watchdog); this.watchdog = null; }
    const ms = Date.now() - t0;
    if (o === 'rewarded') {
      track({ event: 'ad_reward', point: point, ms: ms });
      onReward();
      return;
    }
    track({ event: 'ad_cancel', point: point, ms: ms, outcome: note || o, code: d && d.code });
    if (onCancel) onCancel(o);
  }
}
