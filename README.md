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

## 60 秒手动兜底（若 Game.scene 打不开）

交接文档 R2 预案：场景文件为手工序列化，若编辑器报错，按以下步骤 60 秒重建：

1. 资源管理器右键 `assets/scenes` → 新建 → 场景，命名 `Game`；
2. 双击打开，层级面板新建节点 `GameRoot`（Canvas 子节点）；
3. 选中 GameRoot → 添加组件 → 自定义脚本 → `GameView`；
4. 保存场景，预览。（GameView 在 `start()` 里自建全部 UI，场景只需这一个组件。）

## 目录约定（四层单向依赖）

```
assets/scripts/
  core/       纯逻辑，禁 import 'cc' ← 数值唯一来源（Types/Constants/LevelCfg/Board/GameSession）
  view/       渲染 + 特效，可调不可算（GameView 总控 + 9 子组件 + Draw2D/Ui 基建）
  services/   SaveService / AdService（依赖 platform）
  platform/   PlatformAdapter —— 全工程唯一允许出现 wx.* 的文件
assets/scenes/Game.scene   最小场景（Canvas + GameRoot 挂 GameView）
tools/sim/                 难度回归模拟器 + 种子对拍（Node 直跑，不进包体）
DEV-PLAN.md                任务基准（P0–P6 拆解与勾选）
DEVLOG.md                  开发变更日志（每次调整自动追加：时间/内容/文件/成果）
```

## 模拟器与回归（改 core 必跑）

```bash
npm run sim           # L1–L12 曲线扫描（各 400 局）
npm run sim:check     # 单关深测：L5 × 1600 局
npm run sim:verify    # 种子对拍：core vs 原型 _sim-trace.js（L1–L12 各 100 局，必须 12/12 全绿）
```

> 依赖：Node.js ≥ 22（`--experimental-strip-types` 直跑 TS，无需 `npm install`）。
> 工程红线：任何动到 `core/` 的改动，提交前 `npm run sim:verify` 必须全绿；
> `wx.*` 只准出现在 `platform/`；视觉随机量只准放 view 层。

## 已知坑（都踩过，别再踩）

- **先用 Creator 打开一次再进 VS Code**：`tsconfig.json` extends `./temp/tsconfig.cocos.json`，`temp/` 需编辑器首开生成；`node_modules` 未装属正常（工程零第三方依赖）。
- **HP_MAX 在 `core/Constants.ts`**，不在 Types.ts。
- view 组件统一顶部 `import { … } from 'cc'`，不要用 `import type` 或 `require`（易触发打包器问题）。
- 3.8 脚本编译产物在 `temp/programming/packer-driver/targets/editor/`，不在 `library/imports/`。
- 模拟器输出必须与 `_sim-trace.js` 对拍才算回归通过；单看胜率涨跌不算。

## 当前状态（2026-09-06 01:35:00 更新 · A1/A2 完成 + 首轮冒烟）

- **A1/A2 完成**：GameView.ts 总控（约 560 行）+ Game.scene（Canvas + GameRoot 挂 GameView）+ 本 README；DEV-PLAN 勾选已回填（R7）。
- **构建链路全绿**：Creator 3.8.8 CLI 构建 web-mobile 成功、0 编译错误、0 Missing class（`npm run sim:verify` 12/12 全绿未动）。
- **浏览器冒烟已验证**（web-mobile 构建 + 本地静态服务）：开局面板/开始营业、动物点击入栏、碰撞弹回扣心全套特效（bonk/爆点/飘字/toast/扣心）、装车链（findMatch→逐只装车→发车→补车，实测 2 单入账 25 金币）、busy 输入锁、围栏/HUD 标签刷新。
- **冒烟修掉的 R1 类存量 bug**（均带时间戳注释）：
  1. `ParkView` SLOT_COLORS 误从 core/Constants 导入（构建期 rollup MISSING_EXPORT）；
  2. `Panels.begin()` wipeChildren 误毁持久面板底板（白色面板永不渲染）；
  3. `HudView`/`FenceView`/`Panels.ad` 对 makeLabel 包装对象直赋 `.string`（进度/金币/围栏计数标签永不更新）；
  4. `mkBtn` 标题/副文案放在 (w/2,0)（中心锚点下等于右缘，文字右偏出按钮）；
  5. GameView 布局容器锚点（新增左上原点 column 容器）；
  6. Game.scene 组件 Class ID 须用打包器 23 字符压缩格式（前 5 位 hex + 18 位 base64）；
  7. 顶部布局错位（2026-09-06 01:50 修复）：`place()` 会把节点锚点重置为 (0,1)=左上，
     而 `HudView` 图标/胶囊与 `FenceView` 围栏格的底板按**中心**绘制，直接 place 导致视觉
     左上偏移半宽/半高（按钮顶部被裁 15px、文字吊底、围栏格左侵文字区）。修复惯用法：
     place 一个 (0,1) 容器 + 居中底板作为子节点 setPosition(w/2,-h/2)（与 ToolsBar 底板一致）；
  8. 车位错位 + 红心偏左（2026-09-06 02:10 修复）：`ParkView` 的 truckWrap 被 placeC 到
     槽位左上角（整组卡车/载货/需求行偏移），按槽位中心重定位；`HudView` 三心左偏 5.5，改 14.5 起。
- **交互迭代（2026-09-06 02:20，用户需求）**：
  1. 入栏动画：普通拿取改为「按朝向走出牧场边界 → 停顿调头 → 走向围栏格缩步入栏」
     （FxService.walkAnimal，带步频弹跳与方向箭头；吊车吊走仍为飞行）；
  2. 碰撞动画：动物先**真实走到**路径上的遮挡者身边（core 新增 blockerOf 纯查询定位，
     对拍 12/12 仍全绿），接触瞬间才触发粒子/飘字/震屏/心碎并过冲弹回
     （AnimalNode.bonk(dir, hitDist, onImpact)）。
- **待办**（对应交接文档 A3–A7）：12 关逐关人工通关、失败/复活/翻倍广告链路人工核对、特效视觉对拍 A5、微信真机构建 A4（需 AppID）。
- 本地预览构建产物：`node tools/dev-server.mjs 8138` → 浏览器开 `http://127.0.0.1:8138/`（后台标签页会被浏览器节流停帧，需保持标签页前台）。
- 广告为 Mock 直通（`WxAdapter.adUnitId = ''`），上线前填入真实广告位 ID（行动项 A7）。
