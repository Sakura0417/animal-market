# 《动物集市》· 项目交接文档（HANDOVER）

> **文档版本**：v1.0 · 2026-09-08
> **交接范围**：原始工作区 `E:\traeWork\6a9ae4d49c9f09b0a04bfe61\` 全部内容（多子项目 + 根目录临时产物）
> —— 历史声明：该工作区内容已于 2026-10-16 全部并入本仓库，见 §3.1 迁移说明。
> **核心工程**：`animal-market-cocos/`（Cocos Creator 3.8.8 + TS 微信小游戏）
> **主项目状态**：v1.0 上线冲刺阶段（M1 代码冻结已达成；M2 真机验收待启动；D8 难度反向偏置已入目标带；0/0 显示 bug 已修；石头开关已落）
> 🔴 **时效声明（2026-09-19 补）**：本版为 **2026-09-08 快照**；此后 09-09 ~ 09-19 的多轮改造（网格紧密化 / 朝向构造式放置 / 走廊遮挡 / 失败转化位收敛 / 道具同构 / **真实广告接入**）**多数尚未并入本文明细**。
> 本次已把"广告"相关条目**就地更新**（TL;DR 瓶颈、里程碑表、架构表、依赖表、文件清单、阻塞项、平台纪律、修改指引表）；**其余明细一律以 `animal-market-cocos/DEVLOG.md` 与 `docs/dev-plan-20260906.md` 为准**。

---

## 〇、TL;DR（30 秒接手版）

- **项目**：微信小游戏《动物集市》，Cocos Creator 3.8.8 + TypeScript strict，375 行级 TS 源码（4 层架构），单关贪心机器人验证可达性，core 层零 Cocos 依赖可 Node 直跑。
- **核心玩法**：6×10 网格农场 → 点击动物入栏 → 围栏 7 格暂存 → 订单匹配 → 装车离场；HP 3 心；吊车/翻转/洗牌/看广告救援。
- **关键约束**：`assets/scripts/core/` 禁止 import 'cc'（难度曲线是核心资产，模拟器 Node 直跑依赖）；`platform/` 是全工程唯一允许出现 `wx.*` 的文件；任何 core 改动必须跑 `sim:verify` 12/12 全绿。
- **当前瓶颈**：T4（12 关真人逐关验收）和 T6（微信真机构建）均为**人工/外部依赖项**，AI 无法替代；T7 广告**代码侧已于 2026-09-19 完成**（7 点位 + 三态兜底 + 实例池 + **`AD_ENABLED` 总开关，默认关闭**），上线只剩三步：开通流量主（门槛：小游戏已上架 + 累计独立访客 UV ≥ 1000）→ 回填广告位 ID → 置 `AD_ENABLED = true`。

---

## 一、项目背景与目标

### 1.1 一句话定位

> 微信小游戏《动物集市》：6×10 网格农场里点动物入栏，凑齐订单装车离场，挡路就扣心；3 心用完 + 围栏挤爆均会触发独立失败面板，可看广告续命或复活；12 关内不断加压密度。

### 1.2 设计三角与差异化

- **玩法三元组**：挪车（相邻格遮挡）+ 羊了个羊（7 格围栏暂存+三消）+ Goods Sort（订单匹配）。
- **与 羊了个羊 的本质差异**：相邻格遮挡而非"被压住即不可点"；动物可点击但碰撞扣心（带弹回 + 飘字 + 震屏 + 粒子反馈），无挫败感的强行死局。
- **核心判定**：通关 = 牧场动物清空 + 围栏清空；星级按剩余生命结算（用过复活封顶 1 星）；目标难度曲线 L1-2 ≥95% / L3-5 ≥85% / L6-12 55-75%（实际 L6-12 现 64-72% 落在带内）。

### 1.3 版本与里程碑

| 里程碑 | 状态 | 内容 |
|---|---|---|
| **M1 代码冻结** | ✅ 2026-09-06 22:27 | 核心玩法闭环、围栏满载判定、星级压暗复活、接触距离常量化 |
| **M2 真机验收** | 🔄 进行中 | T4 逐关人工通关 + T5 特效视觉对拍 + T6 微信真机构建（待 AppID）|
| **M3 上线发布** | 🔄 代码侧就绪 | T7 广告已接入真实激励视频（2026-09-19，7 点位 + 三态兜底），仅待广告位 ID 回填（流量主门槛 UV ≥ 1000）|
| **M4 v1.1 网格化后置** | ⏸ 待排 | 关卡 JSON schema / 3D 化方案等约 4-5 人日 |

---

## 二、技术栈与运行环境

### 2.1 技术栈

| 维度 | 选型 | 说明 |
|---|---|---|
| 引擎 | **Cocos Creator 3.8.8** | `package.json#creator.version` 强锁版本，勿用其他版本打开（meta 漂移）|
| 语言 | **TypeScript strict** | 11 条既有宽松用法报错（TweenEasing / Label 包装属性）可忽略，不阻塞（2026-09-19 实测复核；旧文档写 13 条已过期）|
| 架构 | **四层单向依赖** | `core`（纯逻辑）→ `view`（渲染+特效）→ `services`（存档 / 广告服务 + 点位标识）→ `platform`（**wx 真实接入**：广告位配置 + 平台适配器）|
| 资源加载 | `resources.load()` | **只能加载 `assets/resources/`** 下的资源（铁律，见 §4.3）|
| 主包目标 | ≤4MB | 当前 resources 约 862KB；字体未子集化可能成为风险点 |
| 平台 | 微信小游戏 | iOS/Android 双端；竖屏 375 宽 |

### 2.2 运行环境

| 环境 | 版本/要求 |
|---|---|
| **Node.js** | ≥ 22（`--experimental-strip-types` 直跑 TS，无第三方依赖）|
| **Cocos Creator** | 3.8.8（**先用 Creator 打开一次再进 VS Code**，否则 `temp/tsconfig.cocos.json` 不存在）|
| **TypeScript** | ^5.5.0（项目 devDependencies）|
| **微信开发者工具** | 最新稳定版（待 T6 真机验证）|
| **微信 AppID** | **待申请**（演示广告可全程自测）；**广告位 ID 也要等**——需先开通流量主（小游戏已上架 + 累计独立访客 UV ≥ 1000），再回填 `assets/scripts/platform/AdConfig.ts` 的 `REWARDED_AD_UNITS` |

### 2.3 依赖与构建

- **零第三方运行时依赖**：工程 `package.json` 仅 `typescript` 一个 devDependency。
- **extensions/cocos-mcp-server/**：Cocos 编辑器 MCP 扩展（编辑器内操作面板用），与代码逻辑无关。
- **不参与构建**：`tools/`、`docs/`、`.workbuddy/`、`store-assets/`、`_archive/`、`art-draft/`、`raw-art/`、`raw-models/` 均不进包；`assets/resources/` 才会进包。

---

## 三、目录结构与模块职责

### 3.1 仓库顶层（2026-10-16 结构重整后：**仓库根 = Cocos 工程根**）

```
assets/                       ★★ Cocos 工程资源（编辑器只扫描这里；仅 resources/ 下进包）
tools/  tools/sim/            ★★ Node 工具与难度模拟器（core 零 'cc' 依赖，可 Node 直跑）
settings/  build-templates/   编辑器配置 / 构建模板（自定义插屏 first-screen.js）
docs/                         ★ 工程文档（dev-plan / devlog / 各专题评审 / 对齐）
  └─ reference/               ★ 上游资料（2026-10-16 由原工作区根迁入）
      ├─ prd/                 PRD 2.0（需求最高优先级，HTML）
      ├─ tech/                技术方案（HTML）
      ├─ research/            微信小游戏品类调研（HTML）
      ├─ prototype/           V4.1 原型 HTML/JS（历史参考，不对拍）
      └─ handover-20260908/   HTML 版交接文档（已被本文件替代）
raw-art/                      原始美术源（2048 大图 + 历次备份；**刻意放 assets/ 外**）
art-draft/  raw-models/       美术草稿 / 3D 源模型备份（均不进包）
store-assets/                 商店素材与生成器（图标 / 启动图 / 填写单 / 字体子集）
_archive/                     归档（models-3d-dormant / legacy-prototype）
.workbuddy/memory/            项目约定与工作日志（AI 协作用，随仓库分发）
DEVLOG.md  DEV-PLAN.md  README.md  HANDOVER.md  AGENTS.md  LICENSE
extensions/                   Cocos 编辑器扩展（第三方，不进仓库，新设备在编辑器内重装）
```

> **迁移说明（2026-10-16）**：原工作区根下的 `animal-market-prd/`、`animal-market-tech/`、
> `wechat-minigame-research/`、`animal-market-prototype/`、`animal-market-handover/`、`raw-art/`、
> `store-assets/`、`HANDOVER.md`、`AGENTS.md` 已全部并入本仓库（目标：**clone 单仓库即可开发**，
> 不再依赖仓库外资料）；`_sim-trace.js` / `_prototype-contract.md` 归入 `_archive/legacy-prototype/`。
> **本文档下文出现的旧路径一律按上表换算。**

### 3.2 主工程（`animal-market-cocos/`）

> ⚠️ 2026-10-16 结构重整：`animal-market-cocos/` **即仓库根**（下文路径前缀可省略）；
> `assets/animal/`（源图）已迁至 `raw-art/animals-2048-src/`；`assets/resources/art/`（废弃目录）已移除。

```
animal-market-cocos/
├── DEVLOG.md                  ★ 变更日志（时间倒序；热区最近 30 条，历史见 docs/devlog/）
├── README.md                  快速开始（**内容已部分过期，2026-09-06 01:35 快照**，以本文档为准）
├── DEV-PLAN.md                P0-P6 旧拆解（**已过期，保留为历史基线**）
├── docs/                      ★ 现行文档与 living plan
│   ├── devlog/                ★ DEVLOG 冷归档（DEVLOG-YYYY-MM.md，按月，rg 检索）
│   ├── dev-plan-20260906.md   ★ 唯一进度事实源（living doc，状态表自动回填）
│   ├── roadmap-20260906.md    决策快照（不再回填）
│   ├── prd2-reconciliation-20260906.md
│   ├── review-and-plan-20260906.md
│   ├── grid-layout-and-collision-analysis.md
│   ├── t4-acceptance-checklist.md
│   ├── t5-fx-parity.md
│   ├── animal-schema.md       动物数据操作手册
│   ├── art-spec.md / art-prompts.md / model-import-spec.md
│
├── assets/                    ★ Cocos 工程资源
│   ├── scenes/Game.scene      唯一场景（Canvas + GameRoot 挂 GameView）
│   ├── scripts/               ★★ 四层架构（见 §3.3）
│   ├── resources/             ★★ 进包资源铁律：只有这里会进 build
│   │   ├── animal/{chicken,cow,duck,pig,rabbit,sheep}.png  运行时动物图（256×256，6 张共 284KB）
│   │   ├── art/animals/  ←【已废弃目录，备份到顶层 raw-art/】建议从 resources 移除
│   │   └── art/models/*.glb  ←【Farm3D 簇孤儿，Farm3D.ts 已无引用】建议从 resources 移除
│   └── animal/                源图仓库（不进包，process-animal-art.cjs 默认 srcDir）
│
├── art-draft/                 美术草稿与联络表（不进包，build-animal-sprites.cjs 输入）
├── raw-models/                3D 模型原始备份（glb）
├── extensions/cocos-mcp-server/  Cocos 编辑器 MCP 扩展（与代码逻辑无关）
├── profiles/ settings/        Cocos 编辑器配置
├── tools/                     ★★ Node 工具与模拟器
└── package.json               npm scripts: sim / sim:check / sim:verify / test:hopeless
```

### 3.3 核心代码四层（`assets/scripts/`）

| 层 | 文件 | 行数 | 职责 | 约束 |
|---|---|---|---|---|
| **core/** | `Types.ts` | 91 | 核心类型（Animal/Order/Slot/Phase/LevelConfig）| 唯一位置真相源 = 整格 `col/row` |
| | `Constants.ts` | 85 | **全局配置单一真相源**（CRANE_MAX/ENABLE_FARM_ROCKS/ORDER_QTY3_P 等）| 业务逻辑禁止硬编码数值 |
| | `LevelCfg.ts` | 41 | 关卡曲线（herdN/typeCount/rocks/orderKinds）| 业务逻辑全部读 `cfg.xxx` |
| | `Board.ts` | 206 | 棋盘纯函数（gridLayout/smartDir/hasBlockCycle/breakHeadOnPairs）| 拒绝采样兜底 3+ 环 |
| | `GameSession.ts` | 499 | 对局状态机（start/generate/makeOrder/findMatch/takeAnimal/...）| 调度走 this.rng（seed 化）|
| | `AnimalSchema.ts` | 37 | 动物数据（id/name/price/rareMultiplier）| **唯一数据真相源**，TYPES 派生 |
| | `Grid.ts` | 39 | 6×10 占用图 O(1) 查询 | 越界视为场外（朝外可走出）|
| | `Seed.ts` | 13 | mulberry32 PRNG | 注入式随机流 |
| **view/** | `GameView.ts` | 853 | **总控**（start/takeAnimal/moveTo/reconcile/update）| 挂在 GameRoot 上 |
| | `ParkView.ts` | 271 | 顶部卡车/订单/需求行 | syncNeeds 维护 `items value ≥ 1` 不变量 |
| | `PenView.ts` | 167 | 牧场网格（动物摆放）| z-order 岩石垫底 |
| | `FenceView.ts` | 142 | 围栏（7 格）| 满载时 `isFenceHopeless` 判定 |
| | `HudView.ts` | 164 | HUD（关卡/生命/剩余/金币）| 标签直接赋 `.string`（makeLabel 包装）|
| | `Panels.ts` | 301 | 弹层（开局须知/失败/复活/胜利/星级）| begin() wipeChildren 别毁底板 |
| | `AnimalNode.ts` | 194 | 单个动物节点 | 0/0 防御 |
| | `AnimalArt.ts` | 44 | 美术模式开关（vector/sprite）| ART_MODE 常量 |
| | `ToolsBar.ts` | 105 | 底部工具栏（吊车/翻转/洗牌）| 复用进度显示 |
| | `FxService.ts` | 262 | 特效（bonk/飘字/震屏/粒子）| walkAnimal 入栏动画 |
| | `Draw2D.ts` | 529 | 矢量绘制（动物/卡车/UI 元素）| Draw2D 像素 → 屏幕像素映射 |
| | `Ui.ts` | 137 | UI 基建（mkBtn/makeLabel/wipeChildren/placeC）| 顶部 import 全部 from 'cc' |
| | `Farm3D.ts` | 335 | **【死代码】** 3D 化尝试（已自标"不再被引用"）| 可清理 |
| **services/** | `SaveService.ts` | 85 | 存档（am_level/am_wallet/am_last_result/am_stars）| localStorage |
| | `AdService.ts` | 81 | 广告服务（**7 点位三态入口** + 防重入锁 + 90s 看门狗 + **`AD_ENABLED` 关闭时直接放行**）| 2026-09-19 接真实激励视频；接线 TrackService |
| | `AdPoints.ts` | 45 | **广告点位标识真相源**（7 个 id + `critical` 标记 + `adSuffix()` 文案后缀）| 禁 import 'cc'；点位 id 上线后禁改 |
| | `TrackService.ts` | 31 | 埋点（最小集 + 广告三事件；开关关闭时不发 `ad_*`）| TRACK_ENABLED 开关 + wx 留桩 |
| **platform/** | `PlatformAdapter.ts` | 195 | **全工程唯一允许出现 `wx.*` 的文件** | 2026-09-19：三态回调 + 实例池 + 错误码分流 |
| | `AdConfig.ts` | 28 | **`AD_ENABLED` 总开关（默认 `false`：零广告元素但点位直接可用）** + 广告位 ID 池 + 冷却 / 看门狗参数 | **上线三步：开通流量主（UV ≥ 1000）→ 回填 ID → 置 `AD_ENABLED = true`** |

### 3.4 工具与模拟器（`tools/` 与 `tools/sim/`）

| 文件 | 用途 | 调用方式 |
|---|---|---|
| `tools/sim/run.ts` | **核心入口**：曲线扫描 / 单关深测 / 快照对拍 | `npm run sim / sim:check / sim:verify` |
| `tools/sim/BalanceSim.ts` | 难度回归模拟器（贪心机器人）| run.ts 间接调用 |
| `tools/sim/boundary_check.ts` | 边界白盒（T1 同 seed 双跑/T2 ≥2/T3 末车/T4 解锁车位/T5 满载判败）| 手动跑 |
| `tools/sim/rocks_check.ts` | 石头开关 + 对冲对验收 | 手动跑（建议纳入 CI）|
| `tools/sim/typecount_scan.ts` | typeCount 覆盖扫描（BalanceSim 留了 typeCountOverride 钩子）| 手动跑 |
| `tools/sim/test-hopeless.ts` | 满载判败白盒（与 boundary T5 重叠）| `npm run test:hopeless` |
| `tools/sim/test-cyclerate.ts` | 互锁环率测量 | 手动跑 |
| `tools/sim/baseline-snapshot.json` | **L1-L12×100 局种子对拍基准** | sim:verify 用 |
| `tools/sim/baseline-snapshot.*.bak.json` | 历次规则变更前快照备份 | **可清理**（已归档） |
| `tools/process-animal-art.cjs` | PNG 降采样 + 去水印 + 白→透明键控 | `node tools/process-animal-art.cjs [srcDir] [outDir] [size]` |
| `tools/scan-watermark.cjs` | 单张图水印检测 | `node tools/scan-watermark.cjs <dir> <file.png>...` |
| `tools/png-probe.cjs` | PNG 像素探测（管线底层）| 间接依赖 |
| `tools/dev-server.mjs` | 静态预览服务（端口 8138）| `node tools/dev-server.mjs` |
| `tools/mcp-call.mjs` | Cocos MCP 客户端调用 | 手动跑 |
| `tools/sprite-preview.html` | 24 方向草稿预览（由 gen-animal-sprites.mjs 生成）| 浏览器开 |
| `tools/gen-animal-sprites.mjs` | 生成 sprite-preview.html | `node tools/gen-animal-sprites.mjs` |
| `tools/build-animal-sprites.cjs` | 合成 art-draft/contact-sheet-v2.png | 手动跑 |
| `tools/gen-rock.cjs` | **【建议清理】** 生成 rock.glb（石头开关默认关后无意义）| 一次性 |
| `tools/inspect-glb.cjs` | **【Farm3D 簇，建议清理】** glb 解析检查 | 一次性 |
| `tools/test-dashed-roundrect.cjs` | **【可能废弃】** Graphics dashed roundRect 验证 | 手动跑 |
| `tools/sim/refrun.mjs` | **【明确废弃】** 原型对拍加载器（run.ts 已不用）| 不可用 |
| `tools/sim/prng.mjs` | mulberry32 入口（re-export 给 Node ESM）| run.ts 引用 |
| `tools/sim/hooks.mjs` | ESM `.ts` 扩展名解析钩子 | register.mjs 引用 |
| `tools/sim/register.mjs` | `--import` 入口（启动所有 sim 工具）| npm scripts 引用 |
| `tools/sim/refrun.mjs` | **【已废弃】** 原型对拍（替代为 core 自身快照）| 不可用 |

---

## 四、核心开发思路与架构决策

### 4.1 四层单向依赖（铁律）

```
core ─┐
      ├─→ view ─→ services ─→ platform
      │                         ↑
      └─────────────────────────┘
```

- **core 禁止 import 'cc'**：难度曲线是核心资产，必须能在 Node 直跑（`BalanceSim` 依赖）。
- **platform 唯一允许出现 `wx.*`**：便于 dev 模式 vs 真机模式无缝切换。
- **view 只能接线不能算数值**：所有数值参数从 `cfg.xxx` / `Constants.xxx` 读。

### 4.2 关键架构决策（按重要性排序）

| 决策 | 理由 | 落地位置 |
|---|---|---|
| **整格 col/row 取代浮点 x/yu** | 网格化主线（PRD 2.0 §5.1），位置真相源唯一、可重排洗牌简单 | `Types.Animal` 字段，x/yu 降级为派生 getter |
| **相邻格遮挡（取代走廊遮挡）** | 网格化后自然语义，碰撞动画更可控 | `Board.blockerOf/isBlocked` |
| **3 拒绝采样兜底（un≥6 + 无 head-on + 无 cycle）** | 网格化后"互锁环"会变长链 2-4 长度环，需 3 步保护 | `GameSession.generate` + `breakAllHeadOnPairs` |
| **调度走 this.rng（seed 化）** | 模拟器 / 回放 / Debug 同种子复现 100% 一致 | `GameSession.start(level, seed=-1)` |
| **单种数量上限 = 概率闸门 ORDER_QTY3_P** | 恒 2 太松 / 恒 3 超调，中间是非线性跳变，固定常量无解，必须用概率插值 | `Constants.ORDER_QTY3_P = 0.4` |
| **石头开关 ENABLE_FARM_ROCKS** | 农场随机石头改成可配置项，默认关闭 | `Constants.ENABLE_FARM_ROCKS = false` |
| **偶数化策略（先减 q≥2 / 退化删 q=1）** | 维持"场上剩余恒偶"不变量，保证末车永不剩 1；同时 items map value ≥ 1 防止 0/0 显示 | `GameSession.makeOrder` 偶数化分支 |
| **isFenceHopeless 纯读判定** | 满载判败需"满 + 无可满足订单"双条件，避免误判挤爆 | `GameSession.isFenceHopeless` |
| **动物 schema 化** | 6 个动物数据（id/name/price/rareMultiplier）集中管理，3 处闪光倍率字面值收编 | `core/AnimalSchema.ts` |
| **全景代码构建 UI** | 无 .scene/.prefab 静态引用 → 运行时资源必须放 `assets/resources/` | `GameView.start()` 自建全部 UI |

### 4.3 🔴 Cocos 资源加载铁律（必读）

> **`resources.load()` 只能加载 `assets/resources/` 下的资源**，路径相对该目录。
> - `assets/` 下未被场景/prefab/代码引用的资源**不会打进构建产物**。
> - 本项目是**纯代码构建 UI**（无 .scene/.prefab 静态引用）→ 运行时图片**必须**放 `assets/resources/` 下。
> - 当前：动物图 = `assets/resources/animal/{species}.png`（256×256，6 张共 284KB），代码 `resources.load('animal/' + species + '/texture')`。
> - 原始 2048 大图存 `raw-art/animals-2048-src/`（**在 `assets/` 之外**；2026-09-10 迁出：避免编辑器当纹理导入 + 防止冲进主包）。
> - **处理管线**：`node tools/process-animal-art.cjs [srcDir] [outDir] [size]`（默认 `<仓库根>/raw-art/animals-2048-src` → `<仓库根>/assets/resources/animal` → 256；路径基于脚本位置解析，与 cwd 无关）。零依赖 PNG 编解码（无 PIL/sharp），做 2048→256 降采样 + 去水印 + 白→透明键控。
> - **美术模式**：`AnimalArt.ART_MODE = 'sprite'`（顶视角图 + 运行时旋转 `spNode.angle = -CSS_DEG[dir]`）/ `'vector'`（回退）。素材缺失自动回退矢量。

### 4.4 core vs view 的边界（决策树）

```
问：这是数值/规则/判定吗？
├─ 是 → core（禁 import 'cc'）
│   ├─ 影响随机流吗？→ GameSession 状态机
│   ├─ 是纯函数查询吗？→ Board.ts
│   ├─ 是配置常量吗？→ Constants.ts（单一真相源）
│   └─ 是关卡曲线吗？→ LevelCfg.ts
└─ 否 → view
    ├─ 视觉随机量（rot 倾斜等）→ view 内生成
    ├─ UI 接线（按钮/标签/弹层）→ view
    ├─ 渲染（Draw2D/Node）→ view
    └─ 特效（粒子/震屏/飘字）→ FxService
```

---

## 五、关键接口与数据结构

### 5.1 `LevelConfig`（`core/Types.ts`）

```typescript
export interface LevelConfig {
  level: number;        // 关卡号 1-30
  herdN: number;        // 动物数量（L4=24 / L7-L12=30）
  typeCount: number;    // 种类数（L6-L12=5）
  rocks: number;        // 石头数量（受 ENABLE_FARM_ROCKS 开关）
  rareP: number;        // 闪光个体概率
  orderKinds: number;   // 单笔订单覆盖种类数（L6+ 2→3）
}
```

### 5.2 `Order`（`core/Types.ts`）—— 强不变量

```typescript
export interface Order {
  items: Record<string, number>;  // 物种id → 数量；**不变量：所有 value ≥ 1**
  value: number;                  // 期望金币（订单总价值）
}
```

### 5.3 `Animal`（`core/Types.ts`）—— 网格化后的位置真相源

```typescript
export class Animal {
  readonly uid: number;            // 唯一 ID（生成/调度/存档稳定键）
  type: AnimalType;                // AnimalSchema 引用
  dir: Dir;                        // 朝向：'up' | 'down' | 'left' | 'right'
  rare: boolean;                   // 闪光（price × rareMultiplier）
  obstacle: boolean;               // 是否为岩石（不参与订单匹配/不被点击/不计入 animalLeft）
  col: number;                     // 整格 col（0-5）—— **位置真相源**
  row: number;                     // 整格 row（0-9）
  get x(): number;                 // = (col + 0.5) × CELL_W（连续坐标，view 过渡期）
  get yu(): number;                // = (row + 0.5) × CELL_H
}
```

### 5.4 `GameSession` 公开 API（`core/GameSession.ts:15-490`）

| 方法 | 用途 |
|---|---|
| `start(level, seed=-1)` | 启动一局（seed=-1 用全局 Math.random；≥0 用 mulberry32） |
| `isBlocked(b)` / `blockerOf(b)` | 查询动物是否被相邻格动物/岩石阻挡（用于碰撞动画） |
| `herdLeftCount()` / `fenceCount()` / `countUnlocked()` | 状态查询 |
| `unlockedSet()` / `unlockedSet()` | 全部可点击动物 uid 列表 |
| `allLocked()` / `isWin()` / `canPlay()` | 阶段判定 |
| `markOutcome(p)` | 阶段流转 |
| `activeOrders()` | 在途订单 slot 列表 |
| `makeOrder()` | **核心**：末车模式 vs 正常模式；偶数化维持不变量；items value ≥ 1 |
| `tryDispatch()` | 给空 slot 发车 |
| `aliveCount(id)` | 该种在场（herd 非 obstacle + fence）数量 |
| `orderSatisfiable(o)` | 订单是否可被当前场+栏满足 |
| `isFenceHopeless()` | 满载判败纯读判定 |
| `findMatch()` / `takeAnimal(uid, crane?)` / `pushLoaded()` | 入栏流程 |
| `beginFulfill(m)` / `departSlot()` / `settleSlot()` / `fulfillNow()` | 装车离场 |
| `abandonOrder(slotIdx)` | 弃单（围栏清空时） |
| `useFlip()` / `useShuffle()` | 工具（用次数 -1，成功 true） |
| `unlockSlot(i)` / `releaseSome(n)` / `sellAll()` | 广告/紧急释放 |
| `revive()` / `canRevive()` | 复活（HP 3 心） |
| `addCrane(n=1)` | 加吊车次数 |
| `isStuck()` | 围栏满且 hopeless |

### 5.5 关键常量（`core/Constants.ts`）

```typescript
export const SLOT_TOTAL = 5;     // 车位总数
export const SLOT_OPEN = 3;      // 默认开放
export const FENCE_MAX = 7;      // 围栏上限
export const CRANE_MAX = 3;      // 吊车初始次数
export const HP_MAX = 3;          // 生命
export const REVIVE_MAX = 2;     // 复活次数上限
export const FLIP_MAX = 2;       // 翻转工具次数
export const SHUF_MAX = 2;       // 洗牌工具次数
export const DEFAULT_SEED = -1;  // seed 哨兵
export const GRID_COLS = 6; export const GRID_ROWS = 10;  // 网格
export const CELL_W = 100/6; export const CELL_H = 125/10;
export const ENABLE_FARM_ROCKS = false;  // ★ 农场石头开关（默认关）
export const ORDER_QTY3_P = 0.4;         // ★ 订单单种数量上限概率闸门
```

---

## 六、开发进度

### 6.1 已完成（✅）

| 日期 | 里程碑 | 关键产出 |
|---|---|---|
| 2026-09-05 | 原型 V4.1 移植启动 | 4 层架构、6 物种、3 围栏、12 关基础曲线 |
| 2026-09-06 22:27 | **M1 代码冻结** | 吊车=3 / seed 化 / ≥2 末车 / 接触距离 21px / 围栏满载判败 / 星级压暗复活 |
| 2026-09-07 00:55 | 互锁环拒绝采样 | `hasBlockCycle` + 40 次重试兜底 |
| 2026-09-07 16:59 | **P1 网格化落地** | 整格 col/row / 相邻格遮挡 / gridLayout 落位 / reflow 洗牌 |
| 2026-09-07 14:11 | T8 埋点最小集 | 5 事件（init/start/match/sell/level_end）+ ad_show |
| 2026-09-07 22:38 | 石头开关 | `ENABLE_FARM_ROCKS` 默认 false |
| 2026-09-07 23:34 | L4 问题排查三连 | 对冲对防御（`hasHeadOnPair`+`breakAllHeadOnPairs`）+ herdN +8 密度补偿 |
| 2026-09-08 00:04 | **D8 难度调参收官** | orderKinds L6+ 2→3 + `ORDER_QTY3_P=0.4`，L6-L12 全 7 关入 55-75% 带 |
| 2026-09-08 17:59 | 0/0 显示 bug 修复 | 偶数化升级（先减 q≥2 / 退化删 q=1）+ 防御层 + `syncNeeds` 过滤 |

### 6.2 进行中（🔄）

| 任务 | 状态 | 阻塞/下一步 |
|---|---|---|
| T4 A3 逐关人工验收 | 🔄 清单就绪 | **`docs/t4-acceptance-checklist.md`** 12 关记录表 + 10 项验收点；**AI 无法替代，需用户玩** |
| T5 A5 特效对拍 | 🔄 代码对照完成 | **`docs/t5-fx-parity.md`** 15 项对照（12 一致/3 有意差异）+ sprite 签收 4 项；**视觉签收随 T4 一次过** |
| T6 A4 微信构建真机 | 🔄 盘点+runbook 就绪 | 体积：resources 862KB / art-draft 不进包 / 无 ttf；MCP 无法触发 wechatgame 构建 → 编辑器手动；**待 AppID** |

### 6.3 阻塞（⛔）

| 任务 | 阻塞原因 | 缓解 |
|---|---|---|
| T7 A7 真实广告 | 代码侧**已就绪**（2026-09-19）；仅等微信广告位 ID | `AdConfig.REWARDED_AD_UNITS` 回填即启用；ID 之前走演示层，全流程可自测 |
| M3 上线发布 | T4+T6+T7 全闭环 | T4 玩 + T6 手动构建 + T7 回填广告位 ID |

### 6.4 待办（⏸，v1.1 排期）

| 任务 | 估算 | 备注 |
|---|---|---|
| 关卡 JSON schema Phase A | 1-2 天 | PRD 2.0 §5.8 列入 v1.0 范围但延后（用户拍板）|
| 3D 化方案落地（Farm3D 簇）| 3-4 天 | 需用户提供素材或对接云端图生3D 工具（凭证本会话不可用）|
| 主包体积优化（字体子集化）| 0.5 天 | 微信主包 ≤4M 红线前先出体积报告 |
| 13 条 tsc 宽松用法清理 | 0.5 天 | TweenEasing kebab-case / Label 包装属性，不阻塞上线 |

---

## 七、已知问题与技术债务

### 7.1 已知坑（踩过别再踩）

- **先用 Creator 打开一次再进 VS Code**：`tsconfig.json` extends `./temp/tsconfig.cocos.json`，`temp/` 需编辑器首开生成；`node_modules` 未装属正常（工程零第三方依赖）。
- **HP_MAX 在 `core/Constants.ts`**，不在 Types.ts。
- view 组件统一顶部 `import { … } from 'cc'`，不要用 `import type` 或 `require`（易触发打包器问题）。
- 3.8 脚本编译产物在 `temp/programming/packer-driver/targets/editor/`，不在 `library/imports/`。
- `npm run sim:check` **只跑 L5**（npm scripts 里硬编码 `run.ts 5 1600`），要测 L4/L6 等必须直接用 `node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts 4 1600`。
- `Grid.build(herd)` 越界视为场外（朝外可走出）；不要用 try/catch 包它（吞错）。
- `Game.scene` 组件 Class ID 须用打包器 23 字符压缩格式（前 5 位 hex + 18 位 base64）。

### 7.2 技术债务（已在 .workbuddy/memory/MEMORY.md 追踪）

1. **D8 难度反向偏置未根治**：L6-L12 一审 64-72% 全程越 PRD 目标带 55-75%。当前用 `ORDER_QTY3_P=0.4` 概率闸门落在带内，但根因（相邻遮挡解锁宽松 + 贪心机器人不依赖吊车）未根治。若体感仍偏松可调 ORDER_QTY3_P 0.3（更松）或 0.5（更硬）。
2. **D2 接触距离**：核心 21px 是兜底值（投影 − 2×半径×0.95），实际运行时按阻挡距离动态计算。
3. **D7 埋点**：当前 5 事件最小集（init/start/match/sell/level_end），未做漏斗/留存/付费。
4. **存量 13 条 tsc 宽松用法报错**：不阻塞上线，但类型护栏失效。
5. **Farm3D 死代码簇未清理**：`assets/scripts/view/Farm3D.ts`（335 行）+ `assets/resources/art/models/*.glb`（7 个 298K）+ `raw-models/*.glb`（2.3M）+ `tools/inspect-glb.cjs` + `tools/gen-rock.cjs` + `docs/model-import-spec.md`。`Farm3D.ts` 自带注释"本文件不再被任何代码引用"。**建议清理（见附件"疑似无用/过期文件清单"）**。
6. **3D 化方案未拍板**：AI 图生3D 凭证本会话不可用；用户连连接器或供素材后开 P3 合并轮。
7. **存量 `_sim-trace.js` + `refrun.mjs` + `_selftest-demo.js` + `_prototype-contract.md`**：历史原型资产，2026-09-06 后已不再对拍。**建议清理**。
8. **快照备份文件**：`tools/sim/baseline-snapshot.20260907-rocks-on.bak.json` + `baseline-snapshot.20260908-pre00-fix.bak.json`，**可归档**（已分别记录了 22:38 和 17:59 两次规则变更）。
9. **0/0 bug 修复后订单形状变化**：L6-L12 一审微调 1-5pt（仍在 55-75% 带内），曲线行为已与快照对拍 12/12。
10. **临时 PNG 残留**：`animal-market-cocos/tmp-*.png`（7 个 9.5MB）—— tmp 前缀临时调试图，建议清理。

### 7.3 风险

- **R1 唯一人工瓶颈 T4**：12 关真人通关只能用户执行，AI 无法替代。
- **R2 外部依赖 T6/T7**：AppID / 广告位 ID 需微信开放平台申请；⚠️ **广告位 ID 另有门槛** —— 须先开通流量主（小游戏已上架 + 累计独立访客 **UV ≥ 1000** + 无严重违规）。广告**代码侧已就绪**，只剩回填 ID。
- **R3 主包体积未实测**：3 份 ttf 字体 + 未裁剪引擎可能超 4M。
- **R5 难度曲线 ±2-3pp 噪声**：体感与 400 局仿真可能感知偏差。

---

## 八、代码规范与提交约定

### 8.1 强制规则（任何会话不得跳过）

1. **时间**：精确到 `YYYY-MM-DD HH:MM`，**必须执行 `date "+%Y-%m-%d %H:%M"` 取系统时间**，禁止估算、禁止沿用上下文里的旧时间。
2. **DEVLOG 倒序追加 + 热区封顶**：新条目插在 `DEVLOG.md` **热区首条之前（紧跟分隔线 `---`）**，三段齐全（变更/涉及文件/成果・验证）。热区**只保留最近 30 条**；追加后若超 30 条，必须执行 `node tools/devlog-trim.cjs` 把最旧条目**原样搬运**到 `docs/devlog/DEVLOG-YYYY-MM.md`（按条目日期所在月）并刷新索引表——内容零改写、只换位置。查历史用 `rg "关键词" animal-market-cocos/docs/devlog/`，不要通读 `DEVLOG.md`。
3. **源文件时间戳同步**：被修改的 `.ts` 文件头部注释 `修改时间：YYYY-MM-DD HH:MM` 一并更新。
4. **零改动也要记**：排查结论/审计/评审若产生结论，同样记一条，注明「无代码变更」。
5. **效果必写**：`成果・验证` 必须是可复现的证据（命令输出 / 预览实测 / 截图 / 断言 / 对拍结果），不接受"应该没问题"。

### 8.2 编码风格

- **4 空格缩进**、**单引号**、**分号**（与现代码一致）。
- core 层：纯函数 + 类型严格；view 层：组件 + 节点树。
- **业务逻辑禁止硬编码数值** → 全部走 `core/Constants.ts`。
- **单文件 ≤ 600 行**（GameView.ts 853 行是历史超大文件，建议后续拆分子组件）。
- 注释：**中文**（与项目代码一致），关键算法/不变量必须写头部注释。

### 8.3 改动纪律

- **开关类改动的黄金验证法**：
  1. 开关置"恢复原行为"值 → 跑 `sim:verify` 与**改动前**旧快照对拍
  2. 12/12 一致即证明"开启时与改造前逐帧同构"
  3. 再置回默认值 → 旧快照必然偏离（预期规则变更）→ 备份+删快照重建 + DEVLOG 说明
- **core 改动后必跑**：`tsc`（零新增）+ `sim:verify`（12/12）+ `boundary_check`（五项全绿）+ `rocks_check`（石头开关+对冲对）
- **每次数值改动后跑 `npm run sim:verify`**，当前基线 12/12。
- **先出方案 → 用户确认 → 再执行**，不要跳过确认直接动手。
- **用户自己动手改代码**，AI 给方案 + 定位 + 根因。

### 8.4 提交约定

- 提交信息：`<类型>(<范围>): <一句话描述>`（如 `fix(core): 修 0/0 显示 bug`）
- 类型：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`
- 每个 commit 必须对应一个 DEVLOG 条目（DEVLOG 自动按时间倒序，不要求按 commit 顺序）。

---

## 九、本地启动与调试步骤

### 9.1 首次启动（60 秒进对局）

```bash
# 1. 打开 Cocos Creator 3.8.8（重要：版本必须一致，meta 漂移）
#    Dashboard → 导入 → 选择仓库根目录（clone 后的 `animal-market/`，即本文件所在目录）
#    首次打开会重建 temp/、library/（已存在则秒开）

# 2. 资源管理器双击 assets/scenes/Game.scene
#    场景内容：Canvas + GameRoot（挂 GameView.ts）
#    场景本身无其他内容——全部 UI 由 GameView.start() 自建

# 3. 点编辑器顶部 ▶ 预览按钮（浏览器打开）
#    进入即弹「开局须知」→ 点「开始营业」进对局
```

### 9.2 60 秒手动兜底（若 Game.scene 打不开）

> 交接文档 R2 预案：场景文件为手工序列化，若编辑器报错：

1. 资源管理器右键 `assets/scenes` → 新建 → 场景，命名 `Game`
2. 双击打开，层级面板新建节点 `GameRoot`（Canvas 子节点）
3. 选中 GameRoot → 添加组件 → 自定义脚本 → `GameView`
4. 保存场景，预览（GameView 在 `start()` 里自建全部 UI，场景只需这一个组件）

### 9.3 命令行模拟器（核心调试工具）

```bash
cd animal-market-cocos

# 难度曲线扫描（L1-L12 各 400 局）—— 改完 core 必跑
npm run sim

# 快照对拍（与 baseline-snapshot.json 比对，必须 12/12 全绿）
npm run sim:verify

# 单关深测（注意：只跑 L5）
npm run sim:check    # 实际上 = node ... tools/sim/run.ts 5 1600

# 其他关位深测（直接调用）
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts 4 1600

# 边界白盒（T1-T5）
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/boundary_check.ts

# 满载判败白盒
npm run test:hopeless

# 石头开关 + 对冲对验收
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/rocks_check.ts

# 类型检查（13 条既有报错可忽略）
npx tsc -p tsconfig.typecheck.json
```

### 9.4 美术管线（如需新增/替换动物图）

```bash
# 1. 把原始 2048 大图丢到 raw-art/animals-2048-src/（在 assets/ 外，不进包）
# 2. 降采样到 256 + 去水印 + 白→透明 → 落到 assets/resources/animal/（会进包）
node tools/process-animal-art.cjs    # 无参 = 用默认路径（基于脚本位置解析，与 cwd 无关）

# 3. 水印检测（看是否还有水印残留）
node tools/scan-watermark.cjs assets/resources/animal chicken.png
```

### 9.5 静态预览（不开编辑器）

```bash
node tools/dev-server.mjs 8138
# 浏览器开 http://127.0.0.1:8138/
# 注：后台标签页会被浏览器节流停帧，需保持前台
```

### 9.6 Cocos MCP（编辑器内操作）

```
URL: http://localhost:3000/mcp
版本: v1.5.4
工具: 50 个
参数名: action（不是 operation）
预览: :7456
```

---

## 十、AI 接手指南（可复制粘贴版）

> **目标**：让新 AI 在零项目背景、仅读本文档的情况下，能在 5 分钟内准确定位功能入口、识别常见需求改点、遵守全部强制约束。

### 10.1 🔴 必读清单（按优先级，新 AI 上手按序读）

```
[5 分钟必读]
1. 本文 §〇 TL;DR（30 秒接手版）
2. 本文 §一.1（玩法三角）/ §二（技术栈）/ §三.3（四层架构）
3. .workbuddy/memory/MEMORY.md（项目约定跨会话生效）
4. animal-market-cocos/DEVLOG.md 最近 5 条（最新变更；头部含归档索引，历史查 docs/devlog/）

[10 分钟深入]
5. 本文 §四.3（资源加载铁律）+ §五.4（GameSession 公开 API）
6. animal-market-cocos/docs/dev-plan-20260906.md（唯一进度事实源）
7. animal-market-cocos/docs/prd2-reconciliation-20260906.md（PRD 2.0 决策）

[按需查阅]
8. 动物数据 → core/AnimalSchema.ts（6 物种真相源）
9. 难度曲线 → core/LevelCfg.ts + .workbuddy/memory/MEMORY.md §已落地改造
10. 0/0 / 石头 / 对冲等已修 bug → 归档 `animal-market-cocos/docs/devlog/DEVLOG-2026-09.md` 的 2026-09-08 条目
```

### 10.2 🔴 必须遵守的约束（违反即返工）

```
1. 【架构】core 层禁 import 'cc'，业务层禁硬编码数值（走 core/Constants.ts）
2. 【资源】运行时图片必须放 assets/resources/，原始源图放 raw-art/animals-2048-src/（在 assets/ 外）
3. 【回归】core 改动后必跑：tsc + sim:verify(12/12) + boundary_check(5/5) + rocks_check
4. 【dev-plan】每次代码改动必须倒序追加 DEVLOG 条目（三段齐全 + 时间戳）；热区恒 ≤ 30 条，超了跑 `node tools/devlog-trim.cjs` 归档到 `docs/devlog/`
5. 【快照】core 规则变更需备份 + 删除 + 重建 baseline-snapshot.json
6. 【架构】view 层只接线不算数值；视觉随机量（rot）只能放 view
7. 【单文件】单文件 ≤ 600 行（`GameView.ts` 959 行是历史例外，2026-09-19 实测）
8. 【平台】wx.* 只准出现在 `platform/` 目录（当前仅 `PlatformAdapter.ts`；`AdConfig.ts` 只放广告位 ID 与重试参数，不含 wx.*）
9. 【tsc】11 条既有报错（TweenEasing `back-out` / `quad-in`、makeLabel 包装属性 `lineHeight`）是已知，不算新错误
10. 【命名】新常量走 UPPER_SNAKE_CASE，新方法走 camelCase
```

### 10.3 常见需求改点速查（★ 高频 / ◆ 中频 / ☆ 低频）

| 需求 | 改哪里 | 注意 |
|---|---|---|
| **★ 改关卡难度** | `core/LevelCfg.ts` 的 `levelCfg()` 公式 + `core/Constants.ts` 常量 | 改后必跑 sim + rocks_check，重建 snapshot |
| **★ 改动物种类** | `core/AnimalSchema.ts`（加一行）+ Draw2D 矢量 case（vector 模式）| id 上线后禁改，只允许追加 |
| **★ 改订单生成规则** | `core/GameSession.ts` 的 `makeOrder()` | 关注偶数化不变量 + items value ≥ 1 |
| **★ 改围栏/车位/吊车次数** | `core/Constants.ts` 的 FENCE_MAX / SLOT_OPEN / CRANE_MAX | 业务层全工程零硬编码 |
| **◆ 改 UI 布局** | `view/ParkView.ts` / `HudView.ts` / `FenceView.ts` 等 | 顶部 import from 'cc'；UI 基建用 view/Ui.ts |
| **◆ 改特效** | `view/FxService.ts`（bonk/震屏/飘字/粒子）| 与 GameView 动画钩子对齐 |
| **◆ 改碰撞/接触** | `core/Constants.ts` 的 CONTACT_* + `view/AnimalNode.ts` 的 bonk() | PRD D2：核心 21px |
| **◆ 改存档/广告/埋点** | 存档 `services/SaveService.ts`；广告 `services/AdService.ts` + `services/AdPoints.ts`（点位标识）+ `platform/PlatformAdapter.ts` / `AdConfig.ts`（广告位 ID）；埋点 `services/TrackService.ts` | wx.* 仅 `platform/`；**接广告前必读归档 `docs/devlog/DEVLOG-2026-09.md` 的 2026-09-19 条目**（三态口径：只有完整看完才发奖，失败分支不得改游戏状态）|
| **◆ 改美术资源** | `assets/resources/animal/` 替换 PNG + `process-animal-art.cjs` 管线 | 资源 256×256，必须在 resources/ 下 |
| **☆ 新增调试工具** | `tools/sim/` 放 .ts + `tools/sim/register.mjs` 启动 | npm scripts 引用 register.mjs |
| **☆ 改画风/UI 主题** | `view/Draw2D.ts` 矢量函数 + `view/Ui.ts` 颜色常量 | 注意视觉随机量（rot 倾斜）放 view |
| **☆ 升级 Cocos 版本** | 不要擅自改 `package.json#creator.version` | 强锁 3.8.8，meta 漂移风险 |

### 10.4 排查问题的黄金路径

```
用户报 bug
  ↓
[1] 复现：从截图 + 用户描述锁定关卡/操作
  ↓
[2] 定位：是 view 表现问题还是 core 规则问题？
  ├─ view → 看 ParkView / PenView / FenceView / AnimalNode 渲染逻辑
  └─ core → 跑 node ... tools/sim/run.ts <lv> 1600 复现
  ↓
[3] 根因：单步调 + 临时 console.log / view 层 vConsole
  ↓
[4] 修复：最小动作（不动无关代码）
  ↓
[5] 验证：tsc + sim:verify(12/12) + boundary_check + rocks_check + 改关位 1600 局
  ↓
[6] 文档：DEVLOG 倒序追加三段式条目 + dev-plan 进度行（如适用）
```

### 10.5 第一个任务的标准动作模板

```bash
# 1. 取系统时间
date "+%Y-%m-%d %H:%M"

# 2. 读现状
cat animal-market-cocos/DEVLOG.md | head -45          # 头部规则 + 索引 + 最近条目
rg "关键词" animal-market-cocos/docs/devlog/           # 查历史（冷归档，别通读 DEVLOG.md）
cat .workbuddy/memory/MEMORY.md | head -50

# 3. 跑基线
cd animal-market-cocos && npm run sim:verify

# 4. 实施改动（按用户指令）

# 5. 验证
npx tsc -p tsconfig.typecheck.json
npm run sim:verify
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/boundary_check.ts
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/rocks_check.ts
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/run.ts 4 1600  # 改关必跑

# 6. 回填文档
# - DEVLOG.md 倒序插入（紧跟 --- 分隔线，插在热区最上）
# - node tools/devlog-trim.cjs（DEVLOG 超 30 条时归档，刷新索引表）
# - docs/dev-plan-20260906.md §七 追加进度行
# - .workbuddy/memory/2026-09-XX.md 追加日志（如实质性工作）
# - .workbuddy/memory/MEMORY.md 追加新约束（如新增）
```

### 10.6 不要做（反模式）

```
❌ 替用户改代码（用户偏好自己改，AI 给方案 + 定位 + 根因）
❌ 跳过确认直接动手（先出方案 → 用户确认 → 再执行）
❌ 不写 DEVLOG（未写日志 = 改动未完成）
❌ 沿用上下文的旧时间（必须 date "+%Y-%m-%d %H:%M" 取系统时间）
❌ 在 core 层 import 'cc'（会破坏 Node 直跑模拟器）
❌ 在 view 层外用 wx.*（破坏 dev/wx 模式切换）
❌ 改 core 后不跑 sim:verify（12/12 偏离 = 隐患）
❌ 给业务逻辑硬编码数值（违反"单一真相源"原则）
❌ 删快照前不备份（DEVLOG 必须记录备份文件名）
❌ 一行 Edit 误改跨多文件（用 replace_all 或多次 Edit 串行）
```

### 10.7 跨平台接手（如你正在其他 AI 平台继续开发）

```bash
# 1. 拉取本仓库（已 git 化，远端 Sakura0417/animal-market）
git clone git@github.com:Sakura0417/animal-market.git
#    clone 后目录即 Cocos 工程根，用 Cocos Creator 3.8.8 直接导入即可

# 2. 任何 AI 平台只要把以下 5 个文件喂进去就能接手：
#    - 本 HANDOVER.md
#    - .workbuddy/memory/MEMORY.md（项目约定）
#    - animal-market-cocos/DEVLOG.md（最近 10 条）
#    - animal-market-cocos/docs/dev-plan-20260906.md（进度事实源）
#    - animal-market-cocos/docs/prd2-reconciliation-20260906.md（PRD 决策）
#
# 3. 告诉新 AI：
#    "请先读 HANDOVER.md §10 AI 接手指南，再处理我的需求：[...]"
```

---

## 十一、附件：疑似无用/过期文件清单

> **执行状态（2026-09-08 19:37）**：**P0 级 6 组已全部删除**（用户确认"P0全删"；回滚点 = 工作区根 `_archive/p0-backup-20260908-1917/`，27 文件 15MB，确认无副作用后可整体删除）。P1/P2 级仍保留待逐条确认。
>
> **执行状态（2026-10-16）**：`refrun.mjs` 已删；`_sim-trace.js` / `_prototype-contract.md` 已归 `_archive/legacy-prototype/`；P0 回滚点按用户决定**不并入仓库**（留在原工作区路径）。本节其余条目的路径按 §3.1 新结构换算。

### 11.1 分类 A：明确废弃（自证）

| # | 路径 | 大小 | 原用途 | 判定理由 | 风险 |
|---|---|---|---|---|---|
| 1 | `animal-market-cocos/tools/sim/refrun.mjs` | 1KB | 原型基准对拍加载器 | run.ts 2026-09-06 19:36 改用 core 自身快照后 0 import；仅 prng.mjs 注释提到 | 低（无引用）|
| 2 | `_sim-trace.js`（根目录）| 16.7K | V4.1 原型基准 | DEVLOG / run.ts / BalanceSim 三处注释均说明"已不再对拍"；仅 refrun.mjs 执行它 | 低 |
| 3 | `_selftest-demo.js`（根目录）| 7.4K | 临时自测脚本 | 全项目 0 引用 | 低 |
| 4 | `_prototype-contract.md`（根目录）| 18K | 原型契约 | 全项目 md/ts/js 0 引用（已被 PRD 2.0 替代）| 低 |
| 5 | `animal-market-cocos/assets/scripts/view/Farm3D.ts` | 9.5K | 3D 化尝试 | **文件自带注释**："GameView 已移除全部 Farm3D 接线（import/字段/构造三处均已删除），本文件不再被任何代码引用" | **中**（用户可能想恢复 3D，需用户拍板）|

### 11.2 分类 B：死代码连带资源（Farm3D 簇）

| # | 路径 | 大小 | 判定理由 | 风险 |
|---|---|---|---|---|
| 6 | `animal-market-cocos/assets/resources/art/models/*.glb`（7 个）| 298K | Farm3D 死代码 → 孤儿资源；**在 resources/ 下会进包**（影响 298K 包体）| 中（用户可能想恢复 3D）|
| 7 | `animal-market-cocos/raw-models/*.glb`（6 个）| 2.3M | 3D 模型原始备份（不进包但占仓库）| 低 |
| 8 | `animal-market-cocos/tools/inspect-glb.cjs` | <1K | glb 检查工具（Farm3D 相关）| 低 |
| 9 | `animal-market-cocos/tools/gen-rock.cjs` | <1K | 生成 rock.glb；ENABLE_FARM_ROCKS 默认关后无意义 | 低 |
| 10 | `animal-market-cocos/docs/model-import-spec.md` | <10K | 3D 模型导入规格（Farm3D 相关）| 低 |

### 11.3 分类 C：临时/中间产物

| # | 路径 | 大小 | 判定理由 | 风险 |
|---|---|---|---|---|
| 11 | `animal-market-cocos/tmp-*.png`（7 个：tmp-duck-TL-raw / tmp-duck-stageA / tmp-pig-BL/BR/TL/tr / tmp-stage-a）| 9.5M | tmp 前缀调试图，全项目 0 引用 | 低（已无引用）|
| 12 | `animal-market-cocos/cocos-mcp-server-main.zip` | 2.0M | MCP server 源码压缩包；已解压到 `extensions/cocos-mcp-server/` | 低（重复）|
| 13 | `.trae-html-share-packages/*.zip`（4 个）| 几 MB | Trae HTML 分享包临时产物 | 低 |
| 14 | `animal-market-cocos/extensions/cocos-mcp-server/tsconfig copy.json` | <1K | 明显副本（带 " copy" 后缀）| 低 |
| 15 | `animal-market-cocos/assets/resources/animal - 副本/`（6 PNG）| 300K | Windows 复制产生副本，0 引用；**在 resources/ 下会进包** | 低（已无引用）|
| 16 | `raw-art/`（顶层，36 文件）| 1.6M | AnimalArt.ts 注释："旧目录 assets/resources/art/animals/ 已废弃并备份到 raw-art/" | 低 |

### 11.4 分类 D：快照备份（可归档）

| # | 路径 | 大小 | 判定理由 | 风险 |
|---|---|---|---|---|
| 17 | `tools/sim/baseline-snapshot.20260907-rocks-on.bak.json` | ~3K | 22:38 石头开关前的快照 | 低（已记录变更日期）|
| 18 | `tools/sim/baseline-snapshot.20260908-pre00-fix.bak.json` | ~3K | 17:59 0/0 bug 修复前的快照 | 低 |

### 11.5 分类 E：文档脱节（建议修正而非删除）

| # | 路径 | 判定理由 | 建议 |
|---|---|---|---|
| 19 | `animal-market-cocos/README.md` | 2026-09-06 01:35 快照；**第 47/60 行仍写"sim:verify 与原型 _sim-trace.js 对拍"** 与实际（core 自身快照）矛盾 | 全面更新至当前状态（参见本文档 §0-10）|
| 20 | `animal-market-cocos/DEV-PLAN.md` | 2026-09-06 01:35 快照；P0-P4 勾选停留在初始状态；docs/dev-plan 已"不再更新"明文 | 保留为历史基线，但加头部注释指向 HANDOVER.md / docs/dev-plan-20260906.md |
| 21 | `animal-market-cocos/docs/roadmap-20260906.md` | 决策快照（"不再回填"）| 保留为历史决策记录 |

### 11.6 建议清理清单（按风险从低到高）

| 优先级 | 项 | 类型 | 删除命令（建议）| 回滚 |
|---|---|---|---|---|
| 🟢 P0 即清 | #3 `_selftest-demo.js` | 临时脚本 | `rm` | git 历史（如已 git 化）|
| 🟢 P0 即清 | #11 `tmp-*.png`（7 个）| 临时图片 | `rm animal-market-cocos/tmp-*.png` | git |
| 🟢 P0 即清 | #12 `cocos-mcp-server-main.zip` | 重复压缩包 | `rm animal-market-cocos/cocos-mcp-server-main.zip` | git |
| 🟢 P0 即清 | #13 `.trae-html-share-packages/` | 临时分享包 | `rm -rf .trae-html-share-packages` | git |
| 🟢 P0 即清 | #14 `tsconfig copy.json` | 副本 | `rm animal-market-cocos/extensions/cocos-mcp-server/tsconfig\ copy.json` | git |
| 🟢 P0 即清 | #15 `animal - 副本/` | 重复（且进包！）| `rm -rf animal-market-cocos/assets/resources/animal\ -*` | git |
| 🟡 P1 确认后清 | #1 `refrun.mjs` | 明确废弃 | `rm animal-market-cocos/tools/sim/refrun.mjs` | git |
| 🟡 P1 确认后清 | #2 `_sim-trace.js` | 明确废弃 | `rm _sim-trace.js` | git |
| 🟡 P1 确认后清 | #4 `_prototype-contract.md` | 0 引用 | `rm _prototype-contract.md` | git |
| 🟡 P1 确认后清 | #8 `inspect-glb.cjs` | Farm3D 簇 | `rm animal-market-cocos/tools/inspect-glb.cjs` | git |
| 🟡 P1 确认后清 | #9 `gen-rock.cjs` | 石头关后无意义 | `rm animal-market-cocos/tools/gen-rock.cjs` | git |
| 🟡 P1 确认后清 | #10 `model-import-spec.md` | Farm3D 簇 | `rm animal-market-cocos/docs/model-import-spec.md` | git |
| 🟡 P1 确认后清 | #7 `raw-models/` | 备份（不进包）| `rm -rf animal-market-cocos/raw-models` | git |
| 🟡 P1 确认后清 | #16 `raw-art/` | 备份（顶层）| `rm -rf raw-art` | git |
| 🟡 P1 确认后清 | #17 #18 `baseline-snapshot.*.bak.json` | 归档而非删 | `mv tools/sim/baseline-snapshot.*.bak.json docs/archive/` | 改名可恢复 |
| 🟠 P2 用户拍板 | #5 `Farm3D.ts` | 死代码 | `rm animal-market-cocos/assets/scripts/view/Farm3D.ts` | git + 备份 |
| 🟠 P2 用户拍板 | #6 `assets/resources/art/models/*.glb`（7 个）| 进包！| `rm animal-market-cocos/assets/resources/art/models/*.glb` | git + 备份 |
| 🔵 保留 | #19 #20 #21 文档 | 修正而非删 | 详见 §11.5 | — |

### 11.7 回滚方案

- **若项目已 git 化**：`git checkout HEAD -- <path>` 或 `git revert <commit>` 即可。
- **若未 git 化**：
  1. 删除前先 `cp -r <path> /tmp/handover-backup-$(date +%s)/` 全量备份到临时目录
  2. 或建议先 `git init && git add -A && git commit -m "handover baseline"` 建立基线
  3. P2 用户拍板类（Farm3D 簇）建议先移到 `animal-market-cocos/_archive/` 而不是直接 `rm`，保留一段时间观察

---

## 十二、联系与延续

- **项目维护者**：独立开发者（石家庄，6 年前端 / 2026 年转全栈 / Cocos 微信小游戏方向）
- **AI 协作平台**：本工作区使用 WorkBuddy；也兼容其他能读文件 + 跑命令的 AI 平台
- **核心文档交叉引用**：
  - `.workbuddy/memory/MEMORY.md` —— 项目约定跨会话生效
  - `animal-market-cocos/DEVLOG.md` —— 时间倒序变更日志（热区最近 30 条）+ `docs/devlog/DEVLOG-YYYY-MM.md` —— 冷归档
  - `animal-market-cocos/docs/dev-plan-20260906.md` —— 唯一进度事实源
  - `docs/reference/prd/animal-market-prd.html` —— PRD 2.0（需求最高优先级）

---

> 文档结束。如有补充/修正，请直接编辑本文档并在 §六 追加一行进度记录。
