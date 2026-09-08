/* 广告服务（SERVICES）：激励视频统一入口（Mock / wx 双实现由 PlatformAdapter 承担）。
 * 点位：吊车续用 · 翻转 · 洗牌 · 车位解锁 · 围栏救援(放生/清仓) · 生命复活 · 营收翻倍。
 * 频控策略（微信合规：激励视频须用户主动触发）由调用方保证——全部点位都挂在按钮点击上。
 * P6 接真实广告后：加每日上限与失败兜底文案。 */

import { DevAdapter, PlatformAdapter, pickAdapter } from '../platform/PlatformAdapter';
import { track } from './TrackService';

export class AdService {
  readonly adapter: PlatformAdapter = pickAdapter();
  private shownCount = 0;

  /** dev/浏览器环境：view 注入的 Mock 广告层（3 秒倒计时） */
  registerDevDisplay(display: (onDone: () => void) => void): void {
    if (this.adapter instanceof DevAdapter) {
      (this.adapter as DevAdapter).display = display;
    }
  }

  get shown(): number {
    return this.shownCount;
  }

  /** point：点位标签（v1.0 不强制传，T8 埋点统一在入口记一次 ad_show） */
  show(onDone: () => void, onSkip?: () => void, point?: string): void {
    this.shownCount++;
    track({ event: 'ad_show', point: point });   // T8 埋点（2026-09-07）：入口统一覆盖全部点位
    this.adapter.showRewardedAd(onDone, onSkip || onDone);
  }
}
