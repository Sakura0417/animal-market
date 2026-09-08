/* 埋点服务（SERVICES）：v1.0 最小 5 事件集（T8/D7 决策，2026-09-07 受托拍板）。
 * 决策依据：上线后无数据归因能力会导致调参/商业化双盲（计划文档 R4）；
 *   最小集只覆盖"难度曲线验证 + 广告转化漏斗"两条主线的归因需求。
 * 设计纪律：
 *   - 只在 view/services 层调用，core 零 import（不污染可复现对拍链路）；
 *   - 上报通道留桩：dev 走结构化 console，wx 真机 TODO 接 wx.reportEvent 或自建上报；
 *   - TRACK_ENABLED 开关一键关停（提审被拒时快速摘除）。
 * 事件集（v1.0 冻结，不加码）：
 *   level_start  关卡开始        { level }
 *   level_fail   对局失败        { level, reason: 'fence'|'hp'|'deadlock' }
 *   level_win    通关            { level, stars, revivesUsed }
 *   revive       广告复活成功    { level, revivesUsed }
 *   ad_show      广告点位拉起    { point? }（v1.0 不分点位标签，v1.1 再细分） */
export type TrackEvent =
  | { event: 'level_start'; level: number }
  | { event: 'level_fail'; level: number; reason: 'fence' | 'hp' | 'deadlock' }
  | { event: 'level_win'; level: number; stars: number; revivesUsed: number }
  | { event: 'revive'; level: number; revivesUsed: number }
  | { event: 'ad_show'; point?: string };

export const TRACK_ENABLED = true;

export function track(e: TrackEvent): void {
  if (!TRACK_ENABLED) return;
  /* dev 通道：结构化输出（真机上报通道接入后此分支改为缓冲上报） */
  console.log('[track]', JSON.stringify(e));
  /* TODO(P6/A7 后)：wx 环境接上报 SDK——
   * wx.reportEvent 或自建 HTTPS 上报；批量缓冲 + 失败重试由接入方决定 */
}
