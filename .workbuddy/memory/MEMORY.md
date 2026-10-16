# 工作区长期记忆（项目约定 · 跨会话生效）

## 《动物集市》（`animal-market-cocos/`）

Cocos Creator 3.8.8 + TS strict；**core 禁 import 'cc'**（难度曲线是核心资产，模拟器要 Node 直跑）。
PRD `animal-market-prd/animal-market-prd.html`（V2.0）＞ 原型 V4.1；**细节全在 `animal-market-cocos/DEVLOG.md`，本文件只留决策与坑**；任务基准 `docs/dev-plan-20260906.md`。

---

## 🔴 DEVLOG 强制写入（最高优先级）

**任何代码改动必须在同一次改动中追加 DEVLOG，未写＝未完成。** ① 时间取系统时间（`date`／`Get-Date`／node），**禁止估算**；② 插到 `DEVLOG.md` **热区首条之前**（严格时间倒序）；③ 三段齐全：`## [YYYY-MM-DD HH:MM] 标题`／**变更**（做了什么＋为什么）／**涉及文件**／**成果・验证**（可复现证据）；④ 被改 `.ts` 头部 `修改时间：`同步；⑤ **排查/审计结论也记一条**，注明「无代码变更」；⑥ **热区封顶 30 条**：超了执行 `node tools/devlog-trim.cjs`，最旧条目原样搬到 `docs/devlog/DEVLOG-YYYY-MM.md`（按月冷存）；查历史用 `rg "关键词" animal-market-cocos/docs/devlog/`，不要通读 DEVLOG.md。

## 🔴 交付链路（2026-09-21 血案）

**源码 →（编辑器编译）→（构建发布）→ 微信包 →（开发者工具读）**：第 3 环不做，前面全白干。
- 查"用户看的是哪份代码"：`node tools/bundle-fingerprint.cjs <构建目录> <符号…>`（mtime＋关键词；旧产物还能搜到源码已删符号 ⇒ 旧包）。
- 截图量化：`python tools/measure-safearea.py <png>`（定位手机屏矩形→量刘海/Home 条/道具栏→设计单位；自带刘海 209×30 标定自检）。
- **开发者工具模拟器报的底部安全区小于真机**（真机 iPhone X＝34）⇒ 模拟器"仍显紧"≠没修好。
- 改完必答三问：①编辑器编译了吗（看活跃 chunk）②产物换了吗 ③用户看的是不是它。

## 🔴 刘海屏安全区（改布局前必读）

- 唯一数据源 `sys.getSafeAreaRect(false)`（与 `view.getVisibleSize()` 同坐标系，引擎 `SafeArea` 组件同公式）。🚫 别读 `wx.getSystemInfoSync().safeArea`（旧实现已删）。
- `getVisibleSize()` 返回**物理像素**（375pt@2x ⇒ 750×1624）⇒ `s=min(vis.w/375, vis.h/667)=2`；`top=(visH−sa.y−sa.height)/s`、`bottom=sa.y/s`。⚠️ 旧代码 `wx.safeArea.top/s`＝22，真值 44（只让出一半）。
- **躲开刘海外观 ≠ 躲开安全区**：刘海外观仅 30 高，状态栏安全区是 44。
- 应用：`column` 平移 `dh/2−topIn`；`toolsTop = dh − PAD_BOTTOM − TOOLS_H − topIn − bottomIn`；`Toast` 收 `bottomIn`；`bg` 铺满全屏。**普通屏/预览 inset 恒 0 ⇒ 布局不变**。
- 开发者工具右上深色胶囊是工具自身 UI，真机不显示。

## 🔴 启动插屏（2026-09-21 落地）

- **完全由构建期决定**：包根 `first-screen.js` 的 9 个值是构建时编译的常量，**运行时不读配置**；改源码或改产物 `settings.json` 都无效 ⇒ 必须改编辑器配置后**重新构建**（插屏只在打包后生效，编辑器预览不显示）。
- 配置字段（编辑器 `ISplashSetting`）：`logo.type(default|none|custom)＋image|base64`、`background.type(default|color|custom)＋image|color{x,y,z,w}`、`totalTime`（最小显示 ms，≥500）、`displayRatio`（≥100%）、`watermarkLocation`、`autoFit`；另有 `useSplashScreen`（面板「替换插屏」，CLI 名 `replaceSplashScreen`）。
- **Cocos 水印与默认 LOGO 同生共死**：模板里 `slogan.png` 只在 `useDefaultLogo=true` 时绘制 ⇒ 换自定义图或设 `none` 后水印自动消失，**没有单独的"去水印"开关**。
- 尺寸约束：logo 槽按**屏高 18.5%×displayRatio** 等比居中 ⇒ 图片宽高比 ≤ 屏宽/(0.185×屏高) ≈ **2.5**（超了左右被裁）；bg 槽是 fitWidth ⇒ 图要做得比屏幕更"瘦"才不露底。
- 素材与生成器：`assets/splash/{splash-logo.png(1200×510), splash-bg.png(750×2400)}` 由 `node tools/gen-splash.cjs` 生成（改文案/换主视觉后重跑；`--verify=<截图>` 实测插屏底色 vs 游戏首帧色差）；自检图在 `store-assets/splash-check/`。依赖 `jpeg-js`＋`pureimage`（纯 JS），首次运行自动装到 `%TEMP%/animal-market-splashgen`。

## 🔴 广告（改广告前必读）

- 总开关 `AD_ENABLED`（`platform/AdConfig.ts`，默认 false）：关＝7 点位**直接发奖**＋UI 零广告元素；开＝真实激励视频。上线三步：开通流量主（UV≥1000）→ 回填 `REWARDED_AD_UNITS` → 置 true。文案走 `AdPoints.adSuffix()`、角标收口在 `ToolsBar`/`ParkView` 的 `if (… && AD_ENABLED)` ⇒ 新点位自动继承。
- 点位 `crane/flip/shuffle/slot_unlock/fence_release/hp_revive/win_double`（后两个 critical，失败不得锁死 UI）。`docs/roadmap` 的"8 个"含已删的「清仓大甩卖」，已过期。
- 口径 `showRewarded(point,onReward,onCancel)` 三态，**只有 rewarded 发奖**；🚫 禁 `onSkip||onDone`。失败分支只提示、不得改游戏状态；面板打开时用 `Panels.tipDanger`（Toast 会被模态遮罩压住）。
- 防重入：`inFlight` 锁＋`AD_WATCHDOG_MS`(90s)；奖励分支带 `fxGen` 校验；`startGame` 调 `ad.reset()`。
- 三个反直觉：① 自动拉取**不触发 onError**，只有 `show().catch→load()` 拿到错误码；② 1004 后 `load()` 无效，必须 destroy＋重建；③ 基础库 <2.1.0 时 `res===undefined` 按完整观看处理。错误码 1000/1003/1004 瞬时（冷却 30s）；1001/1002/1005-1008 配置态。
- `CRANE_MAX=FLIP_MAX=SHUF_MAX=2`；⚠️ `CRANE_MAX` 非纯 view 常量（BalanceSim 救援策略用）⇒ 改动必须重建 baseline。

## 🔴 核心规则基线

- 盘面 **6×10**，动物/岩石各占整格、四朝向。**遮挡＝走廊遮挡**：沿朝向路径**第一个占用者**即遮挡者；边界朝外/全空＝可入栏；相邻格空而远处有动物＝被挡（点击冲撞）。🚫 绕行已取消（`pickExitDir`/`findExitPath` 已删）。
- **朝向铁律**：生成时定死，全程零改动（`assignDirsNoHeadOn`）；玩家唯一改朝向途径＝翻转道具。🚫 禁事后翻转修正（`breakAllHeadOnPairs/Lines` 已删）；`takeAnimal` 后不重校。**方法论：冲突消解放在生成决策期，别生成后回补**。
- 生命 3 心：被挡可点→冲撞→红闪/震屏/扣心→弹回；扣完失败，广告复活**回 1 颗**（`REVIVE_HP=1`）。通关＝清空判定；星级按剩余生命（复活过封顶 1 星）。双失败态：围栏挤爆／生命耗尽，各挂独立面板。不做遮挡可视化。
- 玩法＝挪车＋羊了个羊（7 格围栏暂存+三消）＋Goods Sort。**「打螺丝」不属本项目**。碰撞**不用物理引擎**（回合制裁决，物理不可复现会毁种子对拍）。

## 关键不变量

1. 随机源全走 `GameSession.rng`；`start(level, seed=-1)`（-1=Math.random，≥0=mulberry32）。
2. 收购：每单 ≥2 只；末车模式（totalAvail≤6）；清仓后可用=1 允许尾单。`items` value ≥1。空槽唯一合法形态＝`totalAvail=0`（**别当 bug 修**）。
3. 围栏满载判败＝满（≥7）**且** `isFenceHopeless()`；有可满足订单→装车腾位续局。
4. 对拍基准＝core 自快照（`tools/sim/baseline-snapshot.json`，L1-L12×100）。规则变更→备份＋删快照重建＋DEVLOG；view/services 零 core 触碰 ⇒ 不必重建。
5. 调参：cap 恒 2 太松／恒 3 超调 ⇒ 必须概率闸门插值（`ORDER_QTY3_P`）；真杠杆＝`orderKinds`＋`ORDER_QTY3_P`＋`herdN`。
6. `AnimalSchema.ts` 是动物唯一真相源（id 上线后禁改）；`ENABLE_FARM_ROCKS` 默认 false。

## 🔴 UI 表现层纪律（view/ 层，2026-10-08 审查后新增）

- **缓动名只能用驼峰**：`'backOut' | 'quadIn' | 'sineOut' | 'sineInOut'`… 🚫 **禁用短横线**（`'back-out'`/`'quad-in'`）。
  实证：引擎 `TweenEasingAdapter` 仅当**首字符大写**时才做 `-`→驼峰归一化 ⇒ 小写短横线被原样返回 ⇒
  `easing[name]`=undefined ⇒ **静默退化为线性**（只有一条真机不显示的 warnID）。合法名见 `TweenEasing` 联合类型。
  **判据：`tsc` 报 `TS2820` 即命中此坑** —— 别再当"存量宽松报错"忽略（曾据此埋了 8 处 dead easing 未察觉）。
- 唯一可信的合法性检查 = `npx tsc -p tsconfig.typecheck.json`（该 tsconfig 严格校验 easing 字面量）。**目标：0 错误**。
- 圆角一律走 `Draw2D.RADIUS`（panel16/card12/chip10/micro6）；间距/字号/时长**尚无 token**（H1/H2/M4 待办）。
- **血案纪律（本轮实证）**：注释也会传播 bug —— `Panels.ts` 头部写 `≈ back-out`，8 处错误写法很可能都是抄它。
  改代码时**顺手修正与之矛盾的注释**，否则下一轮还会照抄。
- view 层改动完成后三连验证：`tsc`(0 错误) + `check-slot-geom.cjs`(槽几何全档 OK) + `sim:verify`(12/12)。

## 🔴 改 .ts 后必须验证编辑器已重编译（最高频坑）

改 .ts → refresh（3000 端口是 JSON-RPC over HTTP：`curl -s -X POST http://localhost:3000/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"assetAdvanced_asset_system","arguments":{"action":"refresh"}}}'`）→ 核对产物 → Ctrl+F5。`sim:verify` 只证 core 正确。
- 判据用**活跃 chunk**：`grep -c <chunkhash> temp/programming/packer-driver/targets/preview/import-map.json`（改完立即 grep 会假阴；目录里的孤立旧 chunk 会假阳）。
- ⚠️ 坑 A：编辑器占用 .ts 时 Edit 报 success 但**静默回滚** ⇒ 写完必须 Read/grep 复核。
- ⚠️ 坑 B：新增导出符号必须在**消费方 chunk** 的绑定列表里确认已绑定，否则运行时 `ReferenceError`。
- stale chunk：产物 mtime < 源码 mtime ⇒ 删 `temp/programming/packer-driver`（仅编译缓存，别动 `library/`）→ refresh。

## 🔴 坐标与文本溢出

- `design`＝**中心锚点**（浮层 Toast/Panels/FxService 用中心坐标）；`column`＝**左上锚点**（布局组件用 `Ui.place(node,l,t,…)`）。⚠️ 血案：Toast 挂 design 却写 placeC ⇒ 只露左半。
- **Label `Overflow.NONE` 忽略 contentSize** ⇒ 换行必须构建期手动断行 `wrapTextByWidth()`＋`enableWrapText=false`，容器按实际行数算尺寸；估宽用 `estTextW()`（CJK 1em／其余 0.58em）。
- `makeLabel()` 返回 `{node,label}`：属性写 `t.label.xxx`，写 `t.xxx` 静默无效。

## 🔴 其他高频坑

- **Graphics 无渐变 ⇒ 色带段数要够**：段边界色差 >2-3 级就看成"线"（草地 6 段＝7.6 级/段曾被误认成格线；96 段＝0.6 级看不见）。查"有没有线"靠数值：`tools/row-profile.py`、`tools/crop-boost.py`。
- **点击无响应四类源**（Cocos 无 DOM，别查 z-index）：① 逻辑锁 `busy`（最常见）；⚠️ `departSlot`/`fulfillSlot` 的 `fxGen` 早退**漏 `busy--`**；② `swallow()` 全屏遮罩（仅模态/广告层）；③ 节点覆盖（全工程 `BlockInputEvents`＝0，Toast 不吞触摸）；④ **`once(TOUCH_END)` 死键**（交互可能失败时不得用）⇒ 改「每次 render 统一 off ＋ 条件 on」。
- **资源**：`resources.load()` 只吃 `assets/resources/`（该目录无条件全进包）；UI 图标走 `IconArt.iconArt(...)`（矢量回退层常驻＋sprite 覆盖层），开局 `preloadIcons()`，**回退层别删**，改尺寸只动 `IconArt.ICON_PX`。
- Token：`Ui.PRESS_SCALE=0.94`·`Ui.DISABLED_OPACITY=115`·`Draw2D.RADIUS={panel:16,card:12,chip:10,micro:6}`；触屏无 hover 态。
- 素材先备齐再搭 UI：`start()` async，`await preloadAnimalArt()+preloadIcons()` 后再 `buildLayout()`。素材工具：`tools/{process-animal-art.cjs, scan-watermark.cjs, gen-rock.cjs, contact-sheet.py, normalize-icons.py, gen-splash.cjs}`。

## 常用命令 ＆ 工程纪律

```bash
npx tsc -p tsconfig.typecheck.json   # 存量 11 条宽松报错可忽略，只看新增
npm run sim:verify                   # core 对拍 12/12（core 改动后必跑）
npm run sim                          # L1-L12 曲线扫描
node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/boundary_check.ts
# 同类：corridor_check / density_check / rocks_check
```
- 开关类改动黄金验证法：置"恢复原行为"值 → 与旧快照对拍 12/12 ⇒ 证"开启时与改造前同构"。
- **cocosMCP** `http://localhost:3000/mcp`（参数名 `action`，编辑器在跑才有）；预览 `:7456`。🔴 MCP **无 wechatgame 构建动作** ⇒ 微信包只能在编辑器「构建发布」手工出。
- **逐文件串行编辑**（禁并行编辑同批文件）；**先出方案 → 用户确认 → 再执行**；判断要有实测数据（精简表格 > 直觉）；说重点。

## 已知风险与待办

- 编辑器**可能激活未保存的默认场景 "Scene"**（`0e5019bc`）而 `Game.scene`（`a3f8d2e1…`）未打开 → 预览跑空场景。别因"场景里只有 Main Light＋Camera"就断定 Game.scene 不存在。
- 主包 4MB 红线：出包前清 `assets/resources/` 冗余（插屏两张图占 89KB）。
- 待办：**P2 关卡 JSON schema Phase A**｜**P6 上线收尾**（逐关验收 → 微信构建真机 → 真实广告回填 ID → 插屏替换后**重新构建**）。
- **已废弃**：相邻格遮挡、`scatter` 散点、`R/TOL/AHEAD/MIN_D/PAD`、`pickExitDir`/`findExitPath`、`breakAllHeadOnPairs/Lines`、4800 局散点基线、"否决网格化"、"原型 > PRD"、`AdService.show`／`onSkip || onDone` 旧口径。
- **待裁决**：D2 接触距离(21px)｜D3 难度目标不一致｜D5 紧密排列 vs 43.5 精灵｜D7 埋点未规划。

## 上线素材与命名（`store-assets/`）

- `logo-144.png`（144×144 PNG/RGBA/35.2KB，规格全绿）＋`basic-info.json`（文案源）＋`basic-info-sheet.html`（生成物）＋`splash-check/`（插屏自检图）。**改文案只改 JSON**：`node store-assets/build-basic-info.cjs` 重校验重出页；`check-icon.cjs` 出图标自检（落 `_check/`）。零依赖。
- **计数铁律**：微信口径「1 个中文字＝2 字符」。名称 4–30、简称 4–10 且**必须从名称按顺序连续截取**（发布前可改 2 次／发布后 2 次每年）、简介 4–120。
- ⚠️ **命名未定死**：「动物集市」＝两个通用名词拼接，微信限制"无标识性通用词"（已有动物类被判需补商标证），且名称按主体全平台唯一。**备案首次提交前必须锁定名称与主体；备案中/通过后不允许改名改主体**。备选：咩咩动物集市／动物出栏记／农场装车记。
- 提审另需：截图 ≥4 张、隐私保护指引、版本说明；二级类目必须选「休闲益智」。
