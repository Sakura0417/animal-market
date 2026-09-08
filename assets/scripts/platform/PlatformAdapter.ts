/* 平台适配层（PLATFORM）：全工程唯一允许出现 wx.* 的文件。
 * 真实激励视频接入为 P6 任务；当前 WxAdapter 为留桩 —— 广告位 ID 为空时直接放行，
 * 保证微信开发者工具里广告链路（复活/解锁/翻倍/道具）可完整自测。 */

export interface PlatformAdapter {
  readonly name: string;
  showRewardedAd(onDone: () => void, onSkip: () => void): void;
}

declare const wx: any;

export class WxAdapter implements PlatformAdapter {
  readonly name = 'wx';
  /** TODO(P6)：填入微信广告位 ID 后自动启用真实激励视频 */
  adUnitId = '';
  private videoAd: any = null;

  showRewardedAd(onDone: () => void, onSkip: () => void): void {
    if (!this.adUnitId) {
      onDone();
      return;
    }
    try {
      if (!this.videoAd) {
        this.videoAd = wx.createRewardedVideoAd({ adUnitId: this.adUnitId });
      }
      const ad = this.videoAd;
      const onClose = (res: any) => {
        ad.offClose(onClose);
        ad.offError(onError);
        if (res && res.isEnded !== false) onDone();
        else onSkip();
      };
      const onError = () => {
        ad.offClose(onClose);
        ad.offError(onError);
        onSkip();
      };
      ad.onClose(onClose);
      ad.onError(onError);
      ad.show().catch(function () { ad.load().then(function () { ad.show(); }).catch(onError); });
    } catch (e) {
      onSkip();
    }
  }
}

/** 浏览器/编辑器预览适配：由 view 注入 Mock 广告展示层（3 秒倒计时） */
export class DevAdapter implements PlatformAdapter {
  readonly name = 'dev';
  display: ((onDone: () => void) => void) | null = null;

  showRewardedAd(onDone: () => void, _onSkip: () => void): void {
    if (this.display) this.display(onDone);
    else onDone();
  }
}

export function pickAdapter(): PlatformAdapter {
  try {
    if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) return new WxAdapter();
  } catch (e) { /* 非 wx 环境走 dev */ }
  return new DevAdapter();
}
