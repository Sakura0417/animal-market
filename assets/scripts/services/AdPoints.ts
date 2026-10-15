/* 广告点位注册表（SERVICES · 2026-09-19 新增）：全工程唯一的广告点位标识真相源。
 *
 * 为什么需要它（第一性原理）：
 *   接入真实广告之前，7 个广告位只是 GameView 里 7 处匿名的 `ad.show(() => …)`——
 *   既没有标识（埋点 point 恒为 undefined ⇒ "拉起→成交"漏斗无法归因），也没有集中配置
 *   （广告位 ID 硬编码在适配层）。**点位一旦匿名，就无法回答"哪个点位值得做"**，
 *   而这正是商业化唯一的迭代依据。
 *
 * 与 AdConfig.ts 的分工：
 *   本文件 = 业务概念（哪个点位、叫什么、是否关键位）；
 *   `platform/AdConfig.ts` = 平台配置（广告位 ID 池、重试策略）。
 *   依赖方向单向：services → platform。
 *
 * banner / 插屏扩展预留（本次只落地激励视频，按同一形状扩展）：
 *   ① 类型：`AdKind`（AdConfig.ts）已登记三种；
 *   ② 点位：新增同级表 `BANNER_POINTS` / `INTERSTITIAL_POINTS`，点位 id 追加不复用；
 *   ③ 适配：PlatformAdapter 新增 `showBanner` / `showInterstitial`，复用同一套
 *      `AdOutcome` 三态与错误码分流（destroy 重建逻辑与 rewarded 逐行同构，可直接抽公用）；
 *   ④ 服务：AdService 加对应入口，`inFlight` 防重入锁与埋点直接复用。
 *   ⇒ 刻意**不**预置空的 banner 方法：没有调用方的空实现是死代码，只增加维护面。
 *
 * 纪律：
 *   - 本文件禁止 import 'cc'（services 层约束，模拟器要 Node 直跑）；
 *   - 点位标识上线后禁改（埋点数据从此不可对齐），新增只追加、不复用旧 id。
 */
import { AD_ENABLED } from '../platform/AdConfig';
import type { AdKind } from '../platform/AdConfig';

/** 激励视频点位标识（联合类型 ⇒ 传错 / 漏传在编译期报错，工程内不再存在匿名广告位） */
export type RewardedPoint =
  | 'crane'          // 底部道具栏 · 吊车
  | 'flip'           // 底部道具栏 · 转身
  | 'shuffle'        // 底部道具栏 · 挪窝
  | 'slot_unlock'    // 停车位公路带 · 锁定车位解锁
  | 'fence_release'  // 围栏挤爆面板 · 吊车放生 3 只续局
  | 'hp_revive'      // 生命耗尽面板 · 恢复 1 颗心
  | 'win_double';    // 通关面板 · 双倍营收

export interface AdPointMeta {
  readonly kind: AdKind;
  /** 可读名（埋点 / 日志用，不进 UI） */
  readonly label: string;
  /** 是否为**失败转化位**（面板已弹出的救援出口）：
   *  这类点位失败时 UI 必须保持可再点，不得锁死（纪律见 GameView.adClosedHint）。 */
  readonly critical: boolean;
}

export const REWARDED_POINTS: Record<RewardedPoint, AdPointMeta> = {
  crane:         { kind: 'rewarded', label: '吊车',     critical: false },
  flip:          { kind: 'rewarded', label: '转身',     critical: false },
  shuffle:       { kind: 'rewarded', label: '挪窝',     critical: false },
  slot_unlock:   { kind: 'rewarded', label: '车位解锁', critical: false },
  fence_release: { kind: 'rewarded', label: '围栏放生', critical: true },
  hp_revive:     { kind: 'rewarded', label: '原地续局', critical: true },
  win_double:    { kind: 'rewarded', label: '营收翻倍', critical: false },
};

/** 按钮标题的广告后缀（2026-09-19）。
 *  开关关闭时**必须返回空串** —— 页面不得出现任何广告元素，否则玩家会以为要先看广告；
 *  此时点位是"直接可用"的免费功能（奖励照发，见 AdService.showRewarded 的开关分支）。 */
export function adSuffix(): string {
  return AD_ENABLED ? ' · 看广告' : '';
}
