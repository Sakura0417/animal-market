# 《动物集市》· Cocos 移植工程（核心玩法版）

> 修改时间：2026-09-06 01:35:00（行动项 A2 新增本文件；01:35 更新状态区）
>
> 微信小游戏 · Cocos Creator **3.8.8** + TypeScript 四层架构。
> 本轮范围：**核心玩法闭环，进入页面即进入对局**（首页/图鉴/签到/农场/每日挑战延后至 P6）。
> 数值与规则唯一来源 = `assets/scripts/core/`（与原型 game.js V4.1 同种子对拍 12/12 关一致）。

## 快速开始（3 步进对局）

1. **打开工程**：Cocos Creator Dashboard → 导入 → 选择本目录（`animal-market-cocos/`）。
   版本必须为 **3.8.8**（与 `package.json` 的 `creator.version` 一致，勿用其他版本打开，避免 meta 漂移）。
   首次打开会重建 `temp/`、`library/`（已存在则秒开）。
2. **打开场景**：资源管理器双击 `assets/scenes/Game.scene`（Canvas + GameRoot 挂 GameView，场景本身无其他内容——全部 UI 由代码构建）。
3. **预览**：点编辑器顶部 ▶ 预览按钮（浏览器打开）。进入即弹「开局须知」，点「开始营业」进对局。

构建微信小游戏：菜单 → 项目 → 构建发布 → 平台选 **微信小游戏** → 填 AppID（待申请，当前 mock 广告可全程自测）→ 构建 → 微信开发者工具打开 `build/wechatgame/`。
