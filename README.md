# 《动物集市》· Cocos 移植工程（核心玩法版）

> 修改时间：2026-10-16 16:40（结构重整：外围资料并入仓库，**仓库根 = Cocos 工程根**）
>
> 微信小游戏 · Cocos Creator **3.8.8** + TypeScript 四层架构。
> 数值与规则唯一来源 = `assets/scripts/core/`（core 自身跨版本种子对拍：`npm run sim:verify` 须 12/12）。
> 接手指南 = `HANDOVER.md`；变更日志 = `DEVLOG.md`；上游资料索引 = `docs/reference/README.md`。

## 快速开始（3 步进对局）

1. **打开工程**：Cocos Creator Dashboard → 导入 → 选择**本仓库根目录**（即本 README 所在目录）。
   版本必须为 **3.8.8**（与 `package.json` 的 `creator.version` 一致，勿用其他版本打开，避免 meta 漂移）。
   首次打开会重建 `temp/`、`library/`（已存在则秒开）。
2. **打开场景**：资源管理器双击 `assets/scenes/Game.scene`（Canvas + GameRoot 挂 GameView，场景本身无其他内容——全部 UI 由代码构建）。
3. **预览**：点编辑器顶部 ▶ 预览按钮（浏览器打开）。进入即弹「开局须知」，点「开始营业」进对局。

## 仓库结构（2026-10-16 起：仓库根 = Cocos 工程根）

| 目录 | 内容 | 进包？ |
|---|---|---|
| `assets/` | Cocos 工程资源（编辑器**只**扫描这里） | 仅 `resources/` 下会进包 |
| `assets/resources/` | 运行时资源（`resources.load()` 唯一可加载目录） | ✅ 进包（主包红线 4MB） |
| `tools/` `tools/sim/` | Node 工具与难度模拟器（core 零 'cc' 依赖，可 Node 直跑） | ❌ |
| `docs/` | 工程文档（dev-plan / devlog / 各专题评审） | ❌ |
| `docs/reference/` | ★ 上游资料：PRD 2.0 / 技术方案 / 品类调研 / 原型 V4.1 / HTML 交接文档 | ❌ |
| `raw-art/` | 原始美术源（2048 大图等，`process-animal-art.cjs` 的输入） | ❌ |
| `art-draft/` `raw-models/` | 美术草稿 / 3D 源模型备份 | ❌ |
| `store-assets/` | 商店素材与生成器（图标、启动图、填写单、字体子集） | ❌ |
| `_archive/` | 归档（历史 3D 模型、原型时代脚本） | ❌ |
| `settings/` `build-templates/` | 编辑器配置 / 构建模板（自定义插屏 `first-screen.js`） | 构建期使用 |
| `extensions/` | Cocos 编辑器扩展（第三方，**不进仓库**，新设备在编辑器内重装） | ❌ |

> 🔴 `raw-art/` 与 `art-draft/` **必须留在 `assets/` 之外**：放进去会被编辑器当纹理导入（拖慢 `library/`），
> 且一旦位于 `resources/` 下会**无条件进包**——2026-09-10 曾因此把 13MB 源图迁出（见 `docs/devlog/DEVLOG-2026-09.md`）。

构建微信小游戏：菜单 → 项目 → 构建发布 → 平台选 **微信小游戏** → 填 AppID（待申请）→ 构建 → 微信开发者工具打开 `build/wechatgame/`。

**广告（2026-09-19）**：由 `assets/scripts/platform/AdConfig.ts` 的 **`AD_ENABLED` 总开关**控制，**默认 `false`**。

- **关闭（默认）**：全链路无广告 —— 页面不显示任何广告元素（道具/车位的视频角标、按钮上的" · 看广告"、演示广告层），但 **7 个广告点位（吊车 / 翻转 / 洗牌 / 车位解锁 / 围栏放生 / 生命复活 / 营收翻倍）点击即生效**，玩法无缺失；不创建 wx 实例、不发 `ad_*` 埋点。
- **打开**：置 `AD_ENABLED = true` 启用激励视频 —— `REWARDED_AD_UNITS` 有 ID 走真机，为空走 dev 演示层（3 秒倒计时 + 「跳过（不发奖）」钮）；启用三态兜底（**只有完整看完才发奖**，中途关闭 / 无填充不发奖并给提示）。
- **打开前置条件**：开通流量主（小游戏已上架 + 累计独立访客 **UV ≥ 1000** + 无严重违规），再在 `REWARDED_AD_UNITS` 回填广告位 ID（可填多个自动轮换）。
- 点位标识见 `assets/scripts/services/AdPoints.ts`；审计入口 `console.warn('[ad]', …)` 打错误码，埋点走 `[track]` 结构化输出。
