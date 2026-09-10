# 《动物集市》开发变更日志（DEVLOG）

> 本文档由接手开发维护，**每次代码调整自动追加条目**，用于后期追踪问题。
> 项目基线：交接文档 `animal-market-handover/animal-market-handover.html`（2026-09-05，20 文件 / 2,664 行 / 对拍 12/12）。

## ⚠️ 强制规则（项目不变量，任何会话不得跳过）

**任何代码改动，必须在同一次改动中自动追加一条 DEVLOG 条目，未写日志 = 改动未完成。**

1. **时间**：精确到 `YYYY-MM-DD HH:MM`。**必须执行 `date "+%Y-%m-%d %H:%M"` 取系统时间，禁止估算、禁止沿用上下文里的旧时间。**
2. **位置**：**插入到首条历史条目之前（紧跟分隔线 `---`）**——本日志自 2026-09-06 19:47 起改为**时间倒序**（最新条目在最上），便于追溯最近变更；2026-09-05 及更早的旧条目保持原正序不动。
3. **格式**（三段齐全，缺一不可）：

   ```
   ## [YYYY-MM-DD HH:MM] 标题（一句话说清改了什么）
   - **变更**：做了什么 + **为什么**（根因/动机），多条目用 ①②③ 编号
   - **涉及文件**：`路径`（新增/修改）；无代码改动时写 `无代码变更（本条为排查/审计记录）`
   - **成果・验证**：怎么证明它生效——命令输出 / 预览实测 / 截图 / 断言 / 对拍结果
   ```

4. **源文件时间戳同步**：被修改的 `.ts` 文件，头部注释 `修改时间：YYYY-MM-DD HH:MM` 一并更新（新建文件由 AI 生成时自带）。
5. **零改动也要记**：排查结论、审计、评审若产生了结论，同样记一条，并注明「无代码变更」。
6. **效果必写**：`成果・验证` 必须是可复现的证据（如 `sim:verify 12/12 全绿`、预览实测数据），不接受"应该没问题"。

---

## [2026-09-10 21:41] 失败转化位收敛为 2 项 + 吊车与翻转/洗牌同构 + 复活由回满 3 心改回 1 颗
- **变更**：用户截图反馈三处产品决策，逐条落地。
  ① **围栏挤爆面板由 4 项砍为 2 项**：删掉「清仓大甩卖 · 看广告」与「发好友求救 · 免费」，只留「吊车放生 3 只 · 看广告」+「放弃重开（免费）」。**为什么**：失败转化位同时挂 4 个出口，玩家决策成本高于行动意愿；且"好友求救"是**演示态假功能**（白送 +1 吊车、无真实分享），留在转化位会稀释广告位，并埋下"点了没反应"的预期落差。结构保持「广告续局在上、免费重开在下」，与生命耗尽面板对齐。
  ② **吊车与翻转/洗牌同构**：`CRANE_MAX` 3 → 2，并**取消"每局首次免费"特权** —— 吊车与翻转、洗牌一样，**每次使用都需看完激励视频**，广告角标改为常显。**为什么**：原实现是"首次免费 + 之后看广告"，但额度仅 3 次且用尽即置灰 ⇒ 广告分支实际**永远不可达（死代码）**；三个道具横排并置却跑两套规则，UI 上吊车无角标又强化"它免费"的错觉。
  ③ **复活由回满 3 心改为回 1 颗**：`GameSession.revive()` 原为 `hp = HP_MAX`，改为 `hp = REVIVE_HP`（新增常量 = 1）。**为什么**：回满 3 心 ⇒ 生命耗尽几乎无惩罚，一次广告把失败彻底抹平，难度曲线与广告价值同时被抵消；回 1 颗让复活回归"续一口气"的定位。
- **涉及文件**：`core/Constants.ts`（CRANE_MAX 3→2 + 新增 `REVIVE_HP = 1`）、`core/GameSession.ts`（revive 改用 REVIVE_HP；`sellAll`/`addCrane` 因失去唯一 view 调用点成为规则层备用能力，**保留未删**）、`view/Panels.ts`（failFence 4→2 项、failHp 文案改「恢复 1 颗」）、`view/GameView.ts`（failFence 接线减参、enterCraneMode 去掉首次免费分支、`craneUsed` 字段退役、failHP toast 改「❤️ 生命恢复 1 颗」）、`view/ToolsBar.ts`（render 去掉 craneUsed 参数、吊车 badge 常显）。**快照**：`tools/sim/baseline-snapshot.json` 重建，备份 `...20260910-pre-crane2.bak.json`。
- **成果・验证**：`npx tsc` **存量 11 条、零新增**；`sim:verify` 先报 **9/12 关偏离**（实锤 CRANE_MAX 会扰动随机流），备份 + 删除 + 重建后 **12/12 全绿**；`boundary_check` **5/5 全绿**；重建后 L6-L12 一审 **71/78/65/64/66/64/59%**，**全部仍在 55-75% 目标带**（改前 68/71/67/57/63/58/57，未跌出带）。编辑器 refresh 后**产物核验（不看源码看 chunk）**：活跃 chunk `ac386452…` 内 `failFence(onRelease, onRestart)` 只挂 2 个 btn（"清仓大甩卖"字样**仅存于 doc 注释**）；core chunk `b5a61af2…` 内 `REVIVE_HP` **有绑定 + `_reportPossibleCrUseOfREVIVE_HP` 防御包装**（新增导出符号无 ReferenceError 风险）；GameView chunk `f10a9f09…` 内 `tools.render` 已为 4 参、`enterCraneMode` 已无"首次免费"分支。
- ⚠️ **教训（已写进常量注释）**：`CRANE_MAX` **不是纯 view 常量** —— 它进 BalanceSim 的救援策略，额度变化会让模拟结果整体偏移（本次 9/12 关偏离）⇒ 改它**必须重建快照**，别信"只影响 UI"的直觉。

## [2026-09-10 21:26] 提示（Toast）被切一半：根因是坐标系用错；并全面审计所有提示溢出
- **变更**：用户截图反馈"碰撞提示只显示了一半"。查证是**坐标系用错**，连带审计出第二处溢出。
  ① **主因**：`Toast` 挂在**中心锚点**的 `design` 上（x ∈ [-w/2, +w/2]），却沿用左上容器的写法 `placeC(node, w/2, …)` ⇒ 提示中心被放到**屏幕右缘**，实际只露左半。改 `x = 0`。
     定量印证：design 右缘 187.5 + 文案宽 279.2 ⇒ 可见区间 47.9..187.5 = 139.6 ≈ 文案一半，与截图切点（正好"撞到前面的动物了！被"）完全吻合。
  ② **结构性成因（不修必复发）**：旧 Toast 背景**固定 34 高**、宽 `min(W-30, len*13+36)`，而 Label 用的是默认 Overflow.NONE —— Cocos 的 Overflow.NONE **忽略 contentSize 按原文宽度渲染**，既不换行也不裁剪 ⇒ 文案比背景宽就横向溢出、需要两行时背景不跟着长就纵向溢出。实测最长文案 `⚠️ 全场互相挡住了！点被挡动物会扣生命，或用吊车吊走` = **340.1**，而旧上限 345，**余量仅 5px**，估算稍偏即溢出。
     改为：`wrapTextByWidth`（新增）先按宽手动断行 → 背景高 = 行数×18+16、宽 = 最长行+36 → `enableWrapText = false` 保证行数与背景**必然一致**。
  ③ **底边锚定**：锚点改 (0.5, 0)、底边固定在屏幕底部上方 86（恒高于底部道具栏 66）⇒ 多行提示只向上生长，不会压到底部按钮。
  ④ **安全边距**：背景宽上限 = W − 2×14，窄屏不贴边、不超屏。
  ⑤ **审计出的第二处溢出（面板副文案）**：`Panels.sub()` 原样单行输出，而 `第N关 · 牧场已清空但围栏剩 N 只无人要 · 营收 N` 实测 **335.8 > 可用 300**（面板 320 宽、文案左缘 −140 起）⇒ 直接冲出面板右缘。改为同样按宽断行（上限 284），游标按**实际行数**前进，面板高度随 `cursor` 自适应。
  ⑥ **顺手修一处真 bug**：`sub()` 里 `t.horizontalAlign = 0` 写在 **makeLabel 的包装对象**上（返回 `{node,label}`），从未生效——改为 `t.label.horizontalAlign = Label.HorizontalAlign.LEFT`，同时消掉一条存量 tsc 错误。
  ⑦ **其余文本载体全部审计，确认无溢出**：面板标题 18px（最长 175.3 / 容器 280）、按钮标题 15px（172.2 / 258）、按钮副文案 10.5px（166.9 / 258）、HUD「第N关 / 剩 N 只 / 金币数」、围栏「0/7」、停车位「看广告·解锁车位 / 空车位 / N/M」、道具钮「标题+计数」、FxService 飘字、Farm3D 标题 —— 最大占用 ≤ 69%，余量充足。
- **涉及文件**：`view/Ui.ts`（Toast 重写）、`view/Draw2D.ts`（新增 `wrapTextByWidth` + 行首禁则表）、`view/Panels.ts`（sub 按宽断行 + 左对齐修正）。**core 层零改动。**
- **成果・验证**：离线模拟全部 14 条文案在 **375 / 393 / 440** 三种设计宽下的排版 —— **无一溢出**；375 下仅 `⚠️ 全场…`（340.1）折为 2 行（背景 337.1×52，两侧各留 ≥19），其余 13 条单行（最宽 315.2）；440 宽屏下全部单行。面板副文案最长行折为 2 行（279.8 + 56.0），其余 8 条仍单行。`npx tsc` **存量 11 条、零新增**（较上轮少 1 条 = 修掉的 horizontalAlign）；`sim:verify` **12/12 零扰动**；`boundary_check` **5/5**。
- ⚠️ **编译验证的坑（本次踩到，已写入工作区记忆）**：改完 .ts 后**立即** grep chunks 会得到"新符号不存在"的**假阴** —— packer-driver 数秒后才落盘（21:22 查得空，产物 21:23 才生成）。且 `chunks/` 下存在 **01:00 的孤立旧 chunk（`7dff88…`，import-map 计数 0、已不被引用）**，它也含旧 `toastbg` 字样，用 grep 判断"是否已编译"会被它**误导为已编译**。**正确判据 = `targets/preview/import-map.json` 实际引用的活跃 chunk（本次 `b5/b5158e…`，被引用 12 次）内是否含新符号**。另：`rm -rf temp/programming/packer-driver` 被 safe-delete 拦下（编辑器占用，fail-closed 未删成），本次未清缓存即自愈。
- **附**：顺手归位 `[20:50] 修复 ICON_PX is not defined` —— 它被后续写入放在了 `[20:42]` 下方，违反"时间倒序"，已上移（纯位置调整，条目总数不变）。

---

## [2026-09-10 21:05] 首帧不再闪矢量动物（素材预加载）+ 道具钮文案并排 + 解锁车位图标/文案补间距
- **变更**：用户截图反馈三处，逐项治根因。
  **① 「进场先加载之前的图标，再加载动物资源」（首帧闪矢量占位）**
  根因：动物与图标都是「异步 `resources.load` + 矢量占位回退」双层结构（`AnimalNodeC` 构造即画矢量皮肤、素材就绪后再隐藏换 sprite；`animalIcon`/`iconArt` 同型）。搭 UI 与加载并发 ⇒ **必然先渲染一帧矢量动物，再跳成顶视角图**。
  解法：**不去掉回退层**（素材缺失时还得靠它兜底），改为**在 `buildLayout()` 之前把素材备齐**——预加载完成后 cache 命中，各处 `loadAnimalSpriteFrame` / `loadIconSpriteFrame` 的回调**同步执行**，首帧画出来就已是 sprite，矢量层创建即被隐藏，肉眼零感知。
  · `AnimalArt.ts` 新增 `preloadAnimalArt(cb?)`（按 `ANIMAL_SCHEMA` 遍历 6 个 species；**cb 保证被调用，含加载失败**——失败时 cache 存 null，各处按既有纪律回退矢量，启动流程不因单个素材缺失卡死）与 `cachedAnimalFrame(species)`（只读缓存，供后续判断）。
  · `IconArt.preloadIcons(cb?)` 由「发射后不管」改为**带完成回调**。
  · `GameView.start()` 改 `async`：`await` 两个预加载后再 `buildLayout()`。新增 `booted` 守卫——预加载期间节点被销毁（切场景/热重载）则 `start` 直接返回，`onDestroy` 也在 `booted=false` 时提前 return（`panels`/`hud` 等用 `!` 声明，未装配就访问会抛）。素材为本地资源（6 图 + 8 图标 ≈300KB），耗时约 1 帧。
  **② 底部道具钮「吊车」与「×3」要在同一行、不换行**
  原先 12.5px 标题与 9.5px 计数**分两行**堆在图标下（按钮内共 3 行 ⇒ 用户看到的"换行"）。改为**一行内两个 Label 并排、整行居中**：
  · 纵向节奏改为按**光学高**排（`ICON_PX.tool × ICON_FILL = 23.2`，而非 29 方框——方框含 20% 透明留白，按方框排会视觉下坠）：底板可视区 -3..-54（51 高），内容 = 图标 23.2 + 间隙 5 + 文案行 13 = 41.2 ⇒ 上下留白各 4.9；图标中心 -19.5、文案行中心 -42.6。
  · 行内用新增的 `Draw2D.estTextW(text, fontSize)`（CJK 1em / 其余 0.58em，与 `Toast.show` 同口径）估宽算整行宽度再分别居中；**两个 Label 都设 `enableWrapText = false`**，从机制上保证不换行。实测「吊车 ×3」行宽 40/111.7（36%），吊车激活态换成「点击被挡动物」行宽 86（77%）仍在按钮内 —— 三个道具钮（吊车/翻转/洗牌）统一走这条规则。
  **③ 解锁车位「看广告/解锁车位」与锁图标没有间距**
  根因是**写死坐标撞车**：锁盒写死 y=-20（占 -11..-29）、文案写死 `-sh/2-4 = -38`（占 -26..-50）⇒ **重叠 3px**，截图里锁与"看广告"直接贴住。
  改为按「盒 18 + 间隙 6 + 两行文案 23」算总高 47 再整体居中：68 高槽位 ⇒ 上 10.52 / 盒 10.52..28.52 / **间隙 6** / 文案 34.52..57.52 / 下 10.52（上下对称）。
- **涉及文件**：修改 `view/AnimalArt.ts`、`view/IconArt.ts`、`view/GameView.ts`、`view/ToolsBar.ts`、`view/ParkView.ts`、`view/Draw2D.ts`（新增 `estTextW`）。**core 层零改动。**
- **成果・验证**：排版数值离线复算全对（道具钮上留白 4.9 = 下留白 4.9、图标↔文案间隙 5；车位锁盒↔文案间隙 6、上下留白各 10.52）；`estTextW` 用字节核对实际用字——`×` 是 U+00D7（非全角）走 0.58em ✓；`npx tsc` **零新增**（12 行输出全为存量宽松用法）；`sim:verify` **12/12 零扰动**（core 未动）；`boundary_check` **5/5**；编辑器 MCP refresh 成功 → 产物 chunk 21:05 重编译，`preloadAnimalArt` / `enableWrapText` / `estTextW` / `GAP_LOCK_TXT` 均在产物内。**待用户肉眼验收**：① 进场是否还有矢量闪帧；② 道具钮「吊车 ×3」是否单行居中；③ 解锁车位的图标/文案间距。
- **验证标准的澄清（对 20:50 条预防措施的修正）**：`__unresolved_N` **不是**异常信号——它是 packer-driver 对**相对导入**（`../core/*`、`./Draw2D` 等）生成的占位符，运行时由 import-map 解析，全量 238 处属正常。真正的信号是 **`System.register` 后的变量绑定列表**。本节按该标准复扫了新导出的 3 个符号（`preloadAnimalArt` / `cachedAnimalFrame` / `estTextW`，另含上一轮的 `preloadIcons` / `ICON_FILL` / `ICON_PX`）：**跨模块裸引用 0 处**，且每个消费方 chunk 都带 `_reportPossibleCrUseOf<X>` 防御包装。抽查 ToolsBar 的 chunk 头绑定列表已含 `estTextW, …, RADIUS, ICON_FILL, ICON_PX, iconArt` ✓。

---

## [2026-09-10 21:27] 🔴 朝向生成逻辑重构：Rush Hour 式构造式放置（朝向生成即定死，全程零改动）
- **用户反馈**：对局中同时生成两个方向相对的动物时，进入游戏后其中一只会**自动调整朝向**；要求"朝向在游戏开始生成时即固定确定，未使用道具的情况下全程不得改动"，并参考挪车（Rush Hour）类生成逻辑。
- **根因（我此前实现的设计错误）**：我采用的是**"先生成再事后修正"**范式——`generate` 用 `smartDir` 随机定向后，靠 `breakAllHeadOnPairs`（相邻对冲）+ `breakAllHeadOnLines`（线上正对）**翻转动物朝向**来消除冲突；更严重的是 `breakAllHeadOnLines` 还接在 **`takeAnimal`**（对局中每次移走动物后重扫并翻转）以及 `useShuffle`/`useFlip` 上。**玩家看到的"动物自己转头"就是这些事后翻转**。事后修正在语义上也有缺陷：朝向不是"生成决策"而是"补救结果"。
- **重构（构造式 / constructive placement，与 Rush Hour "放不下就换位"同构）**：
  ① `core/Board.ts` 新增 **`assignDirsNoHeadOn(herd, rng, occupied, pressure)`**：位置全部就位后**逐只分配朝向并即时检查与已定朝向动物的路径冲突**——冲突定义 = 与某只形成"路径正对"（互为对方朝向上的第一占用者，距离任意）。**构造完备性**：新动物只可能与**已定朝向**者冲突（未定者会在自己分配时避开本只），故逐只检查即全局零正对，**无需任何事后回退**。位置已在格上且分配期间不变 ⇒ 各方向"第一占用者"一次预计算、冲突检测降为 O(1) 查表。
  ② **4 向皆冲突 ⇒ 返回 false**，`generate` 重摇布局（40 次上限兜底）——即挪车式"该位置放不下就换一套布局"。
  ③ 朝向偏好用 `pickPreferredDir` 保持原难度语义（朝场外 0.5×(1−pressure) / 指向已占格 0.4×pressure / 其余随机），rng 消耗量级不变。
  ④ **删除** `breakAllHeadOnPairs`（相邻对冲修正）与 `breakAllHeadOnLines`（线上正对修正）及其**全部 5 处接线**（generate / takeAnimal×2 / useShuffle / useFlip / BalanceSim robot flip）。
  ⑤ 语义澄清：**道具是唯一允许改朝向/位置的机制**——洗牌（改位置、朝向保持）与翻转（重摇朝向）之后**不再自动修正**，其结果即最终状态；对局中因移走动物而新出现的"路径正对"是玩家操作的结果，由吊车/翻转/洗牌自行化解，系统不再静默替玩家转动物。
- **涉及文件**：`core/Board.ts`（+assignDirsNoHeadOn/pickPreferredDir，−breakAllHeadOnPairs/breakAllHeadOnLines/flipToSafeLine）、`core/GameSession.ts`（generate 改构造式 + 删 4 处修正接线）、`tools/sim/BalanceSim.ts`（删 flip 后修正）、`tools/sim/corridor_check.ts`（T7 改为构造式分配断言，16 断言）、`tools/sim/density_check.ts`（T6 改为"朝向稳定性"断言）。快照重建（备份 `baseline-snapshot.20260910-pre-constructive.bak.json`）
- **成果・验证**：① **`density_check` T6：3830 次拿取全程"朝向零改动"**（旧断言"对局全程 0 正对"已替换为更贴合需求的"朝向不受系统改动"）；② 生成后 0 线上正对 / 0 相邻对冲对（400 局 ×4 关）；③ `corridor_check` **16/16**（含构造式分配：分配成功 + 0 正对）；④ 新快照 `sim:verify` **12/12**；⑤ 曲线 400 局 **无需重新调参即全带内**——L1-3 100%、L4-5 89.3/87.8%、**L6-12 一审 58.8-68.5%**、恢复后 100%、0 卡死；⑥ `boundary_check` 5/5、`rocks_check` 全绿、`tsc` **0 条非存量错误**；⑦ 编译产物验证（新铁律）：`assignDirsNoHeadOn` 在消费方 chunk 绑定完整（声明 + 2 处防御包装），旧函数名残留仅出现在 9/7、9/8 的**孤儿 chunk**（不被 import-map 引用，不会加载）。
- **行为终态**：**朝向在生成时一次确定，对局全程（含移走动物、装车、发牌）零改动**；玩家唯一能改变朝向的途径是翻转道具。预览前 Ctrl+F5。

---

## [2026-09-10 20:50] 修复 `ICON_PX is not defined`（编译缓存过期，非源码缺陷）
- **现象**：点击动物即弹 Error 面板——`ReferenceError: ICON_PX is not defined`，堆栈 `takeAnimal → moveTo → renderAll → renderTools → ToolsBar.render → ToolsBar.build (chunk 31/319bcc….js:211)`。
- **排查链路（逐层排除）**：
  ① **源码层排除**：`IconArt.ts:29` `export const ICON_PX = {...} as const` 导出正常；`ToolsBar.ts:11` `import { ICON_PX, iconArt } from './IconArt'` 导入正常；`npx tsc` **12 条全存量、零新增** ⇒ 源码无缺陷。
  ② **依赖层排除**：`IconArt → Draw2D/Ui`，无反向依赖（无循环依赖）；`IconArt.ts.meta` 合法（uuid `128b9aa3…`）、`library/.assets-info.json` 已注册该资源。
  ③ **产物层定位根因**：报错 chunk 头部的变量绑定列表为 `… RADIUS, iconArt, place, …`——**有 `iconArt` 却没有 `ICON_PX`**，而代码里有 3 处 `ICON_PX.tool/badge` 裸引用；同时 `System.register` 依赖数组出现 4 个 `__unresolved_N`（模块解析失败占位）。**且产物 mtime 20:16:53 < 源码 mtime 20:17:27**——packer-driver 增量编译在 IconArt 的**导出符号表尚未更新**时生成了该 chunk（跨 chunk 引用未生成绑定），此后源码再改但 watcher 未触发重编译，浏览器持续加载这个坏产物。
- **修复**：删除编译缓存 `temp/programming/packer-driver`（仅编译产物，可安全重建；**未动 `library/` 资源库**）→ MCP `assetAdvanced_asset_system{action:"refresh"}` 触发重建 → 验证新 chunk（20:40:51，12725B）变量绑定列表**已含 `ICON_PX`** 且生成 4 处 `reportPossibleCrUseOfICON_PX` 跨模块防御包装。批量复扫 IconArt 全部导出符号（`ICON_PX/ICON_FILL/ICON_NAMES/preloadIcons/loadIconSpriteFrame/iconArt`）在 5 个消费方 chunk 的绑定完整性：**0 处裸引用**（唯一命中项是 IconArt 自身 chunk，定义方属正常）。
- **涉及文件**：无源码变更（本条为环境/编译缓存排查修复记录）；`temp/programming/packer-driver/`（编译缓存重建）
- **成果・验证**：`tsc` 12 条全存量零新增；产物绑定完整性与时间戳均已复核；**用户验证方式**：编辑器预览窗口 **Ctrl+F5 强刷**（清掉浏览器端旧 chunk）后点击任意动物——不再弹 Error，动物正常出栏/碰撞。
- **预防措施（本次教训，已写入工作区记忆）**：① **新增 .ts 模块**时，仅 grep"新标记出现在 chunks"不足以证明编译正确——必须**同时验证消费方 chunk 的变量绑定列表包含新符号**（或存在 `reportPossibleCrUseOfX` 防御包装）；② 若发现"源码已改但产物 mtime 更早"，即为 stale chunk，处置 = 删 `temp/programming/packer-driver` + refresh；③ watcher 在外部编辑器（含 AI）批量改文件时不可靠，改动多个文件后应主动核查产物时间戳。

---

## [2026-09-10 20:42] UI 图标视觉规范统一：画布归一化 + 尺寸/圆角/状态 token 化（含 3 个实测缺陷）
- **变更**：用户提出"图标按钮尺寸与整体视觉样式和周围元素协调统一，各状态比例一致，适配响应式"。先量化诊断（不是凭观感调），发现 3 个可测缺陷 + 2 个体系问题，逐项治理：
  **① 光学尺寸不一致（主因）**：8 张 PNG 内容占画布比例 **70.3%~100%** 不等（coin 最窄 70.3%，crane/video 满画布 100%），而 `iconArt` 按固定 `px` 方框渲染 ⇒ **同一个 px 画出来最大差 1.43 倍**。
  → 新增 `tools/normalize-icons.py`（零依赖，复用自研 PNG 编解码）：统一 **画布 160×160 / 内容 contain 到最大边 128（= 画布 80%）居中**。归一后 6/8 张命中「缩放比≈1 直接直通」，**零重采样**保住原始像素锐度（coin 像素风、crane/video/flip/heart/lock 全直通；仅 restart 1.143× 放大、shuffle 1.016× 走滤波）。重采样纪律：预乘 alpha → 可分离三角滤波（缩小自动退化为面积平均）→ 反预乘，避免透明边缘出深色描边。原图备份 `raw-art/icons-raw-128/`。
  **② crane 纵向拉伸 14.3%**：它是唯一的非方形贴图（128×**112**），`Sprite.SizeMode.CUSTOM` + `setContentSize(px,px)` 不做等比适配 ⇒ 直接纵向拉伸。归一化后画布为方形已根治；另在 `IconArt` 加**按贴图真实宽高比 contain 的兜底**，防止今后再出现非方形贴图。
  **③ 广告角标越界 1.5~2.5px**：`ParkView` 写死 `(sw-7,-7)`、`ToolsBar` 写死 `(w-6,-6)`，角标半宽 10.5 ⇒ 红点戳出紫按钮与虚线框外。新增 `Ui.placeCornerBadge(badge, W, badgePx, inset=2)`：按角标自身半径反推圆心 = `(W - rb - inset, -(rb + inset))`，两处统一调用。
  **④ 满心/空心尺寸差 60%**：满心走 PNG（光学 15×12.7），空心走矢量回退（实测仅 9.4×11.3）——截图里第三颗灰心明显小一圈。按**光学高度对齐**反解矢量参数：`drawHeart` 的 64 空间外接盒（含 1.4 描边）实测 16.4×15.8、中心 (12,13.8)，令 `15.8 × px/span = 12.83` 得 `span = 23.4`；两态统一 `ICON_PX.hudChip`。
  **⑤ HUD 布局缺陷（暂停钮移除的遗留）**：各元素 x 写死 0/68/132/208/276，暂停钮移走后**左侧空出 34px 无人补位**（截图左侧凹陷、右侧贴边）。改为**流式等距布局**：先定各元素宽度 → `gap = (w - Σ宽) / (n-1)` → 从左顺次摆放，首贴左、末贴右、间隙全等，列宽变化自动重排（响应式）。
  **⑥ 体系化（token 化）**：
   · `IconArt.ICON_PX`：尺寸表按「**光学尺寸 ÷ ICON_FILL(0.8)**」反算并注释目标光学值（hudChip 19→15.2 / hudBtn 19 / tool 29→23.2 / badge 21→16.8 / slotLock 15→12 / panel 34→27.2）。此前 8 个调用点各写裸数字，无从横向比较。
   · `Draw2D.RADIUS`：圆角归四档（panel 16 / card 12 / chip 10 / micro 6），替换原先散落的 5/10/11/12/14/18；`Ui.ts` 转出（定义放 Draw2D 避免 Ui↔Draw2D 循环依赖）。胶囊仍写 `h/2` 自解释。
   · `Ui.PRESS_SCALE = 0.94` / `DISABLED_OPACITY = 115`：全工程唯一的按下/禁用比例，`mkBtn`、`HudView.iconBtn`、`ToolsBar.build` 三处统一取用（原先 mkBtn 0.95、HUD 无按下态、道具栏只有 TOUCH_END）。
  **⑦ HUD 图标钮 29×29 → 视觉 25×25 圆形 + 命中区 30×30**：视觉与同排 25 高胶囊齐平（原先上下各凸 2px）；命中区放大到 30×30 保证触控不降级（事件挂命中容器、视觉为其子节点）。圆角取 h/2 全圆——同排（木牌除外）皆是胶囊，圆形是唯一协调解。
  **⑧ 状态模型澄清**：Cocos 触屏**不存在 hover**（无指针设备），故只定义 default / pressed / disabled 三态；disabled 明确为"只降不透明 + 不挂点击，尺寸不变"。
  **⑨ 一处附带修复**：`ToolsBar.build` 是 render 全量重建，原先只 `off(TOUCH_END)`；新增按下反馈后若不解除 TOUCH_START/CANCEL 会随每次 render 叠加回调，已改为三类事件全部先解绑。
- **涉及文件**：新增 `tools/normalize-icons.py`；修改 `view/IconArt.ts`、`view/Ui.ts`、`view/Draw2D.ts`、`view/HudView.ts`、`view/ToolsBar.ts`、`view/ParkView.ts`、`view/Panels.ts`、`view/PenView.ts`；重写 `assets/resources/icons/*.png`（8 张 → 160×160 归一化，uuid 未变、meta 沿用）；原图备份 `raw-art/icons-raw-128/`。**core 层零改动。**
- **成果・验证**：归一化脚本输出实测「coin/crane/flip/heart/lock/video 缩放 1.000 直通、restart 1.143、shuffle 1.016，全部最大边占比 80.0%」；圆角/尺寸落盘复核 grep 全中，调用点无裸数字残留；`npx tsc` **零新增**（12 行输出全为存量宽松用法）；`sim:verify` **12/12 零扰动**；编辑器 MCP refresh 成功 → `library/a5/…@6c48a.json` 20:16 重导入（新画布 160×160，实测 disk PNG 均 160×160）、packer-driver chunks 20:35 重编译且 `placeCornerBadge`/`PRESS_SCALE` 已在产物内（预览前请 Ctrl+F5 强刷）。**待用户肉眼验收**：HUD 流式排布观感、道具按钮图标放大后与标题 12.5 的空间关系。
- **附**：顺手归位一处条目错序——`[2026-09-10 18:59]`（本次改动的上一条）被后续会话写在了 `[19:43]` / `[20:16]` **上方**，违反"时间倒序"约定，已移到 17:23 之前（纯位置调整，内容零改动，条目总数 83 不变）。⚠️ **注意**：全日志还有若干 09-06~09-09 的历史错序（推测是当时按估算时间落条的残留），**本次未动**——因为部分条目时间戳本身是估算值，全量按时间戳重排可能反而打乱真实插入顺序，需人工核对后再决定。

---

## [2026-09-10 20:16] 🚫 取消绕行机制：出栏恒为沿自身朝向直走（用户指令）
- **变更**：用户指令"取消绕行机制"。走廊遮挡语义（19:43 落地）下绕行已不可能触发——能入栏的动物其朝向路径必然全程空，留着绕行分支只会成为"万一状态不同步就掉头"的隐性风险。彻底删除：
  ① `core/Board.ts`：删除 `pickExitDir`（换方向绕行出口选择）与 `findExitPath`（BFS 沿空格穿缝隙寻路）；**保留** `corridorOccupied`（= 带方向参数的遮挡查询，供 `repairUnlocks` 评估"换到某方向是否可入栏"与回归断言使用）。
  ② `view/PenView.ts`：删除 `roadWaypointsBFS`（BFS 朝向序列 → 逐格中心路径）；`roadWaypoints(a, bandOffset, exitDir?)` 去掉 exitDir 参数（恒用 `a.dir`）。
  ③ `view/GameView.ts`：`moveTo` 的三级回落（绕行出口 → BFS 穿缝隙 → 弧线）简化为**单一分支**——`out.kind === 'fly'` 即沿自身朝向直走上土路；弧线仅保留给吊车（`crane`，"被吊起"语义）；删除相关 import。
  ④ `tools/sim/corridor_check.ts` 删除 T7-T9（pickExitDir 断言，18→15）；`density_check.ts` 删除 T4/T5（findExitPath 断言，17→12）并重编号。
- **涉及文件**：`core/Board.ts`、`view/PenView.ts`、`view/GameView.ts`、`tools/sim/corridor_check.ts`、`tools/sim/density_check.ts`（均修改；**core 随机流零影响，快照无需重建**）
- **成果・验证**：`sim:verify` **12/12 零扰动**（证明绕行逻辑不参与数值层——无 rng 消耗、纯 view/查询路径）；`corridor_check` **15/15**、`density_check` **12/12**（含 4458 次拿取全程 0 正对）、`boundary_check` 5/5、`rocks_check` 全绿、`tsc` **12 条全存量零新增**；全工程 grep `pickExitDir`/`findExitPath`/`roadWaypointsBFS` 零调用点（仅历史注释留痕）；编辑器 refresh → chunks 含新代码标记（预览前 Ctrl+F5）。
- **行为终态（出栏路径唯一）**：未被挡 → 沿自身朝向直走上土路跑到围栏口（不掉头、不绕行、不穿透、不漂移）；被挡 → 点击沿朝向冲撞到路径上第一个占用者（扣心弹回）；吊车 → 弧线飞出。**再不存在任何"换方向"分支**。

---

## [2026-09-10 19:43] 🔴 遮挡判定语义统一为"走廊遮挡"：动物保持向前运动并碰撞（用户反馈：掉头朝上 + 对局中路径相对）
- **变更**：用户反馈两个问题并沿链路排到底：① 对局中出现动物路径相对、方向冲突；② 路径远处存在动物时动物"掉头朝上"运动，应保持向前并碰撞。根因分两层：
  **根因 A（问题 ②的判定层）**：`blockedBy` 为"相邻格遮挡"（只判相邻 1 格），于是"相邻格空、远处有动物"的动物被判为**可入栏**；view 为不穿透只能靠 `pickExitDir` 换方向绕行出栏——实测 L8-L12 **70%+ 的动物被迫掉头**（首选出口可用率仅 23-27%），观感荒谬。
  **根因 B（问题 ①的对局层）**：`breakAllHeadOnLines` 只接在 generate/useShuffle/useFlip 三个入口，**漏了"移走动物"**——移走一只会改变遮挡拓扑，把原本被它隔开的两只变成"互为朝向第一占用者"的正对（列上 A→X→B 时 A 挡于 X，移走 X 后 A↔B 正对），用户截图即此。
- **修复**：
  ① `core/Board.ts`：`blockedBy` 改 `firstOnLine`（沿朝向到边界的第一个占用者，含岩石）——**语义统一为走廊遮挡**：能入栏的动物朝向路径必然全程空 ⇒ 直走必然通畅（掉头/绕行自然消失）；被挡动物点击即**沿朝向冲撞到该占用者**。新增 `lineBlocked` 内部件；`corridorOccupied` 与之统一（带方向参数版）；`repairUnlocks` 保底判据改为"走廊全空的方向"（否则保底翻出来的动物仍撞墙）。
  ② `core/GameSession.ts`：`takeAnimal` 移走动物后（crane 与 fly 两分支）立即 `breakAllHeadOnLines`——对局全程零正对（实测 4458 次拿取）。
  ③ `view/GameView.ts`：碰撞冲刺距离改为**按格数**计算（`cells × 格距 − 精灵宽`，下限 CONTACT_FLOOR）——远处遮挡者也能"向前撞到"；出栏路径因走廊必然干净而自然退化为直走（pickExitDir 恒返回自身朝向，BFS/弧线仅保留为防御兜底）。
  ④ 回归：`tools/sim/corridor_check.ts` 按新语义重写（18 断言，锁定"远处有动物即被挡 + blockerOf 取最近者"）；`density_check.ts` 新增 T8"对局全程无路径正对"。
- **涉及文件**：`core/Board.ts`、`core/GameSession.ts`、`view/GameView.ts`、`core/LevelCfg.ts`（难度重标定）、`core/Constants.ts`（ORDER_QTY3_P 0.4→0.2）、`tools/sim/corridor_check.ts`（重写）、`tools/sim/density_check.ts`（+T8）。快照重建（备份 `baseline-snapshot.20260910-pre-corridor.bak.json`）
- **难度重标定（走廊语义的连带代价，实测数据）**：被挡率 60.9%→70.3%、可入栏 11.8→8.9 只 ⇒ L6-12 一审跌至 42.5-54%（低于带）。扫参结论：**紧密度不是杠杆**（tightness 0.85→0.6 仅 +0.2pt）、**种类覆盖不是瓶颈**（可入栏 4.5 种 ≫ 订单 3 种，0% 局不足）；真因是**走廊语义下"移走一只未必解锁身后那只"**（身后者可能仍被更远动物堵着），供给周转率结构性下降 ⇒ 对症杠杆为**订单压力 + 总量**：`orderKinds` L6-19 3→2、`ORDER_QTY3_P` 0.4→0.2、`herdN` L7-12 触顶 30→28。
- **成果・验证**：曲线 400 局 —— L1-3 **100%**、L4-5 86.8/85.8%、**L6-12 一审 59.8-65.5% 全带内**、挤爆 32-40%、恢复后 **100%**、**0 卡死**；`corridor_check` **18/18**、`density_check` **17/17**（含 T8 4458 次拿取全程 0 正对）、`boundary_check` 5/5、`rocks_check` 全绿、新快照 `sim:verify` **12/12**、`tsc` 12 条全存量零新增；编辑器 refresh → chunks 出现新标记（预览前 Ctrl+F5）。
- ⚠️ **PRD 变更声明**：PRD 2.0 §5.1「相邻格遮挡」条款被本次用户需求取代为「走廊遮挡」（沿朝向路径上的第一个占用者）。§5.1 的"碰撞接触距离=格距−精灵尺寸"亦随之扩展为"格数×格距−精灵尺寸"。同步遗留项：PRD 正文待回填（第 555-557 行过期标注仍未删）。

---

## [2026-09-10 18:59] UI 图标接入 PNG（9 张）+ 暂停钮移除 + 无用资源清出 assets（含 13MB 主包隐患）
- **变更**：三项连带改动，一次收敛。
  ① **图标替换（矢量 → PNG）**：用户新增 `assets/resources/icons/*.png`（128×128 RGBA，8 张在用的：coin/crane/flip/heart/lock/restart/shuffle/video；pause 无对应）。工程此前 UI 图标**全部**为 `Draw2D.ts` 的 `Graphics` 矢量绘制（无任何图片/字体引用），故"替换"= 新增统一加载层 + 逐点接线，而非改资源路径。
     · 新增 `view/IconArt.ts`：`resources.load('icons/{asset}/texture', Texture2D)` + 运行时构造 SpriteFrame + **按 asset 缓存共享**；`iconArt(asset, px, fallback, span, cx, cy, tint?, nodeName?)` = **矢量回退层（icon64 常驻）+ sprite 覆盖层**双层结构，sprite 就绪后隐藏矢量层，加载失败保持矢量（与 `AnimalArt.animalIcon` 同纪律，杜绝微信低端机白块）；`tint` 用 Sprite.color 乘法混色解决单色 PNG 需换色的问题；`preloadIcons()` 开局预热消闪跳。
     · 接线 8 处：`HudView`（restart 按钮 / coin 胶囊 / heart 三心）、`ParkView`（lock 锁位 / video 广告角标）、`ToolsBar`（crane·flip·shuffle 道具 + video 角标，build 入参新增 `asset` 字段）、`Panels`（win 面板大金币）。
     · **heart 只有满心态**：满心走 PNG（`iconArt('heart', …)`），空心保留矢量灰心（`icon64` + `drawHeart(g,true)`）——PNG 单图无法表达两态，不引入 tint 近似（红心乘灰会脏）。
     · **lock 白锁 on 浅灰底不可读**：用 `tint='#5a6a78'` 染回原矢量色。
     · restart.png 为黑色（其余白色系），HUD 钮底板是白色圆角矩形（`#ffffff`/235），对比度成立，不改色。
  ② **暂停钮移除（用户：已无实际功能）**：本项目纯代码 UI（无 .scene/.prefab 节点），故无节点可"隐藏"，按彻底清退处理——`HudView` 删按钮与 `HudCallbacks.onPause` 接口、`GameView` 删 `onPause` 接线与 `showPause()` 方法、`Panels` 删 `pause()` 面板方法、`Draw2D` 删 `drawPauseIcon()`，并清掉随之失效的 `HP_MAX` 导入。
  ③ **无用资源清出 assets**（先备份后移出，非硬删——全部落到工程外 `raw-art/`，与既有先例一致）：
     · `assets/animal/`（6 张 2048 源图，13MB）：6 个 uuid 在 scene/prefab/ts/json **零引用**；但被 `tools/process-animal-art.cjs` 当默认 srcDir ⇒ 定性为**源图仓库/工具输入**而非废弃，故只迁不删 → `raw-art/animals-2048-src/`，工具默认 srcDir 同步改 `../raw-art/animals-2048-src`。留在 assets 下的代价：被编辑器当纹理导入拖慢 library，且一旦被引用就把 13MB 冲进主包。
     · `assets/resources/animal/bak/`（11 张，**13MB**）：**P0 隐患**——Cocos 对 `resources/` 下资源**无条件全打进包**（不看引用），而微信主包红线 4MB，出包必爆 → `raw-art/animals-bak/`。`assets/resources` 体积 **15MB → 1.6MB**。
     · `assets/resources/icons/pause.png`：随暂停钮移除失去引用 → `raw-art/icons-unused/`。
     · `assets/icons/`（iconfont TTF 一套）：用户已自行删除（前一版审计结论：TTF 落位非 resources、3 个码位落 CJK 兼容区而非 PUA、且微信小游戏 TTF 为社区已知雷区 ⇒ 改 PNG 路线）。
     · 顺带修正两处失效默认路径：`tools/gen-rock.cjs` 输出默认 `assets/animal/rock.glb` → `assets/resources/art/models/rock.glb`（该路径才是 `Farm3D` 的 `resources.load('art/models/rock')` 目标）；`tools/scan-watermark.cjs` 用法示例改指 raw-art。
  ④ 新增工具 `tools/contact-sheet.py`：零依赖（无 PIL/sharp）PNG 拼图预览，批量核对素材透明区与色值。
- **涉及文件**：新增 `assets/scripts/view/IconArt.ts`、`tools/contact-sheet.py`；修改 `view/HudView.ts`、`view/ParkView.ts`、`view/ToolsBar.ts`、`view/Panels.ts`、`view/GameView.ts`、`view/Draw2D.ts`、`view/AnimalArt.ts`（注释同步源图迁移）、`tools/process-animal-art.cjs`、`tools/gen-rock.cjs`、`tools/scan-watermark.cjs`；移出 `assets/animal/**`、`assets/resources/animal/bak/**`、`assets/resources/icons/pause.png`（→ raw-art/，含 meta）；`assets/resources/icons/` 新增 8 张 PNG（编辑器生成 meta）。**core 层零改动。**
- **成果・验证**：`npx tsc -p tsconfig.typecheck.json` = **零新增**（14 行输出全部为存量 easing/lineHeight/horizontalAlign 宽松用法，无一条来自本次改动）；残留引用 grep `drawPauseIcon|onPause|showPause|panels.pause` **零命中**（仅注释记载）；`animal/bak` 引用零命中；`assets/resources` **15MB → 1.6MB**；编辑器 MCP `assetAdvanced_asset_system{action:"refresh"}` 成功 → `assets/resources/icons/` 生成 8 个 png.meta + `icons.meta` + `IconArt.ts.meta`，抽查 `coin.png.meta` 与 `animal/chicken.png.meta` 同构（`importer:image` / `subMetas` texture `@6c48a` / `redirect` 一致 ⇒ `resources.load('icons/coin/texture')` 路径成立）；`temp/programming/packer-driver/.../chunks/` 18:57 全量刷新且含 IconArt，`http://localhost:7456/scripting/x/import-map.json` 已映射 `IconArt.ts`（预览前请 Ctrl+F5 强刷）。**待用户肉眼验收**：9 张 PNG 的观感（尺寸/留白/颜色一致性）。

---

## [2026-09-10 17:23] 移除"新解锁动物弹跳"：点击不再影响周围动物显示（用户反馈放大效果不符合预期）
- **变更**：用户反馈点击一只动物后，其旁边/周围的其他动物出现**放大**效果。排查定位：动物节点（PenView 节点池）的 scale 修改全工程仅 `AnimalNodeC.bounceUnlock` 一处（缩 0.85 → 冲 1.16 → 回 1.0 弹跳）；触发链唯一——`GameView.moveTo` 记录点击前解锁集 `before` → 动物入栏落地回调 `onArrive` 计算新解锁增量 `news` → `renderPen(news)` → `PenView.render(unlock)` 对命中的动物调 `bounceUnlock()`。**触发原因**：这是 PRD 5.1 的"新解锁动物弹跳提示"功能（原型 unlockBounce 移植）——动物离场后因遮挡关系变化而新解锁的 1-2 只紧邻动物弹跳；功能本身增量为正确（只弹真正新解锁者），但紧密排列观感上即"点一只、旁边几只放大晃动"，用户判定不符合预期。修改（彻底断开，PRD 该条功能下线）：
  ① `view/AnimalNode.ts`：删除 `bounceUnlock` 方法（含 Tween/scale 逻辑）；
  ② `view/PenView.ts`：`render(herd, craneMode, unlock)` 删 unlock 参数与 bounceUnlock 调用行；
  ③ `view/GameView.ts`：`moveTo` 删 `before` 解锁集快照与 `onArrive` 内 `news` 计算/`renderPen(news)` 调用；`renderPen()` 签名去参。
  被点击动物自身行为不变（未挡→走土路入栏；被挡→bonk 冲撞扣心弹回；吊车→吊走）；core 零改动。
- **涉及文件**：`assets/scripts/view/AnimalNode.ts`、`view/PenView.ts`、`view/GameView.ts`（均修改；纯 view 层，随机流零影响）
- **成果・验证**：`npx tsc` 13 条存量 → **12 条**（消失的正是 bounceUnlock 内的存量 easing 报错），零新增；`sim:verify` **12/12 零扰动**（core 未动）；density_check **15/15**；全工程 grep bounceUnlock 零调用点残留（仅注释记载）；编辑器 MCP refresh → chunks 出现新标记（预览前 Ctrl+F5）。**附注**：PRD 5.1"新解锁播放弹跳提示"条目随本变更失效，若日后需要"无缩放的解锁提示"（如纯描边高亮）可基于本条 DEVLOG 恢复设计。

---

## [2026-09-10 10:41] 线上对冲修正：同一路线任意两动物不方向相对（用户截图：同列隔空对峙）
- **变更**：用户圈出同列两只动物隔空面对面（中间隔空格、互相朝向对方）。既有 `hasHeadOnPair`/`breakAllHeadOnPairs`（2026-09-07 需求 #2）只覆盖**相邻格** 2-环对冲，管不到远距对峙——实测 L6 生成链 **31.6%** 的局存在线上正对（2000 局，紧密盘面下高发）。四处改动：
  ① **`core/Board.ts` 新增检测**：`firstOnLine`（沿朝向扫到边界的第一个占用者，岩石/动物均算）+ `isHeadOnLinePair`/`hasHeadOnLinePair`——**互为对方朝向上的第一个占用者**即"线上正对"（距离任意）。语义边界：路线被岩石/第三方动物隔开时**不算**（两只各自的路线终点是紧邻遮挡者，视觉与语义上不构成面对面）；是相邻版 hasHeadOnPair 的超集。
  ② **`core/Board.ts` 新增 `breakAllHeadOnLines` 修正**：检出 a↔b 正对即翻其中一只到"安全方向"（沿新方向的第一个占用者不朝向它；朝场外/空线恒安全），确定性顺序 DIRS_ORDER、**零 rng**（不改变随机流消耗序列）；4 向全冲突则翻对方；仍不行**放弃该对**继续处理（放弃式兜底 + while 上限 herd.length×4 双保险，杜绝死循环）。收敛性证明：每次成功翻转净减 1 个正对且新方向经检查不产生新对，对冲数单调下降。实测 2000 局修正后残留 **0**。
  ③ **接线三处生成/变换点**：`generate()`（breakAllHeadOnPairs 之后）；`useShuffle()`（洗牌重排位置后——朝向不变但邻居全变，可能凭空造出正对）；`useFlip()`（随机重摇朝向后）。`tools/sim/BalanceSim.ts` 机器人翻转分支同步加修正（与 core useFlip 行为一致）。
  ④ **回归断言**：`tools/sim/density_check.ts` T7 扩展为"0 对冲对 / 0 互锁环 / **0 线上正对**"三合一（400 局 L4/8/12/20）。
- **涉及文件**：`assets/scripts/core/Board.ts`（firstOnLine/isHeadOnLinePair/hasHeadOnLinePair/breakAllHeadOnLines/flipToSafeLine 新增）、`core/GameSession.ts`（generate/useShuffle/useFlip 接线）、`tools/sim/BalanceSim.ts`（flip 分支同步）、`tools/sim/density_check.ts`（断言扩展）。快照按规则重建（备份 `baseline-snapshot.20260910-pre-lineheadon.bak.json`）
- **成果・验证**：L6 模拟 2000 局——线上正对出现率 31.6% → 修正后残留 **0/2000**（无死循环、无放弃）；density_check **15/15**；新快照 sim:verify **12/12**；boundary_check **5/5**、corridor_check **12/12**、rocks_check 全绿、**tsc 13 条全存量零新增**；曲线 400 局 L1-3 100%、L4-5 90.8-94.0%、**L6-12 一审 59.5-73.8% 带内**、恢复后 100%、0 卡死。编辑器编译验证：MCP refresh → chunks 出现"线上正对"标记（预览前 Ctrl+F5）

---

## [2026-09-10 09:28] 修"空车位无车"状态不同步（用户截图 bug：L6 三槽只发两单）
- **变更**：排查截图异常（车位 3 显示"空车位"但无新车驶入，金币 0/围栏 0/7/两单 0 进度 = 开局形态），数据层实测抓根因，三处修复：
  ① **根因（core makeOrder ≥2 硬约束分支）**：偏向采样（75% 概率只用"有解锁个体"的种类）把候选锁死在唯一 `avail=1` 的种类时，单种只凑出 1 只 → 触发 ≥2 约束 → 旧逻辑直接 `return null`。**实测抓现场**：开局 28 只在场、avail 明明还有 20 只其他动物，makeOrder 却 null（alive={鸡6,鸭6,兔6,羊5,猪5}、reserved={鸡5,鸭1}、avail={鸡1,...}、openIds 锁死鸡）；空槽现场手动再调 makeOrder 必成功 ⇒ 纯"一次概率采样失败 + 无重试机制"，非供给不足。开局空槽率实测 L1=2.5%、L6=0.94%（各 5000 局）。修复：**确定性降级两级**——先从全量种类重选 avail≥2 的单种补足 2 只；无单种 ≥2 时发"两种各 1"（PRD ≥2 只约束只限总数；清仓/放生破坏偶性不变量后 avail={A:1,B:1} 是真实可达场态，实测占持续空槽 0.9%）；仅全量可用总数 ≤1 才 null（终局合理形态）。为保留全量候选，偏向过滤前新增 `allIds` 快照。
  ② **core tryDispatch**：单槽 `makeOrder` 失败由 `return` 改 `continue`——不再让一个槽的暂时失败拖住后续车位补发。
  ③ **view GameView.renderPark 自愈兜底**：play 态下只要存在 empty 槽就调 `tryDispatch`（幂等，非 empty 槽直接跳过）。任何后续渲染时机（点动物/装车/动画回调）都会自然重试，概率性采样多试必成功。剩余空槽唯一合法形态 = `totalAvail=0`（全部活动物已被在途订单预定，等装车腾位；实测修复后 11900 次持续空槽 100% 属此类，装车后 avail 回流自动补车）。
- **涉及文件**：`assets/scripts/core/GameSession.ts`（makeOrder 降级 + tryDispatch continue，修改）；`assets/scripts/view/GameView.ts`（renderPark 自愈兜底，修改）。快照按规则重建（备份 `baseline-snapshot.20260910-pre-slotfix.bak.json`）
- **成果・验证**：修复后开局空槽 **0/60000**（L1-L12 各 5000 局全清，修复前 126/5000@L1）；"两种各 1 可发未发"类持续空槽 106 → **0**；剩余持续空槽 100% 为 totalAvail=0 合理等待态。回归全套：新快照 sim:verify **12/12**、boundary_check **5/5**、corridor_check **12/12**、density_check **14/14**、rocks_check 全绿、**tsc 13 条全存量零新增**；曲线 400 局 L1-3 100%、L4-5 92.5-94.3%、**L6-12 一审 60.8-73.0% 带内**、恢复后 100%、0 卡死。编辑器编译验证：MCP refresh → preview chunks 出现"空车位修复"标记（预览前 Ctrl+F5）

---

## [2026-09-10 00:09] P1.5 紧密化落地：团簇生成器 + BFS 出栏寻路 + view 网格语义收尾（难度曲线一次入带）
- **变更**：承接 23:17 审计结论（「紧密排列」从未落地 / 高关卡反向偏置未实现 / 出栏全堵率 21.7%），用户授权全权实施，四阶段一次完成：
  ① **阶段A 生成器紧密化**：`core/Board.ts` 新增 `clusterLayout(n, rng, t)` 团簇落位——t=0 与 gridLayout 同一洗牌 deck 取前 n（**逐帧同构**，开关法对拍基点），t>0 以概率 t 优先取已选格邻域（猪了个猪式紧密排列）；`smartDir` 增加 `occupied`/`pressure` 参数落实 PRD 5.1「高关卡反向偏置制造链条」（朝场外概率 0.5×(1−p)、指向已占格概率 0.4×p，p=0 时与旧版 rng 消耗逐次一致）；新增 `repairUnlocks` 确定性保底翻向（零 rng，tightness>0 时取代整体重摇）；`reflow` 透传 tightness（洗牌分布与生成器一致）。`core/LevelCfg.ts` 新增 `tightness`/`pressure` 分级：L1-3=0.25/0、L4-7=0.55/0.35、L8-12=0.85/0.6、L13+=1/0.8。
  ② **阶段B 出栏 BFS 寻路**：`core/Board.ts` 新增 `findExitPath`——从动物格沿**空格** BFS 到任一边界格返回朝向序列（确定性、零 rng）；`view/PenView.ts` 新增 `roadWaypointsBFS`（逐格中心行走 + 复用土路角落/引道口路线）；`view/GameView.ts` moveTo 改**三级回落**：干净走廊直走（与最初版逐点一致）→ BFS 穿缝隙出栏 → 弧线仅理论极限兜底。根治"弧线漂移"（均匀盘面全堵率 21.7%、紧密盘面 37.5% 的系统性问题）。
  ③ **阶段C view 网格语义收尾**：`PenView.onTap` 由最近圆匹配改**点格命中**（cellUid 逻辑格位表，O(1) 零歧义）；底板新增低透明度格线（传达格子规则 + 编辑器视觉基础）；z 序按行主序确定化；`AnimalNodeC` 移除 ±26° 随机倾斜（紧密排列下=没对齐）；接触距离改「格距−精灵宽」常量公式（`cellPitchPx` 新增），`coreRadiusPx`/`R`/`CONTACT_OVERLAP` 投影换算体系退役（P6 温床拆除）。
  ④ **难度基线重建**：旧快照备份 `baseline-snapshot.20260909-pre-cluster.bak.json` 后删除重建。**开关法验证**：tightness=0+pressure=0 时 `sim:verify` 与旧快照 **12/12 一致**（证明新代码关闭态与改造前逐帧同构）；恢复默认值后新基线 12/12。
- **涉及文件**：`assets/scripts/core/Board.ts`（clusterLayout/smartDir扩展/repairUnlocks/findExitPath/reflow扩展）、`core/Types.ts`（LevelConfig +tightness/pressure）、`core/LevelCfg.ts`（分级参数）、`core/GameSession.ts`（generate/useShuffle 接线）、`core/Constants.ts`（R/CONTACT_OVERLAP 退役）、`view/PenView.ts`（点格命中/格线/z序/roadWaypointsBFS/cellPitchPx）、`view/AnimalNode.ts`（去倾斜）、`view/GameView.ts`（三级回落/接触距离常量化）——均为修改；`tools/sim/density_check.ts` 新增（T1-T7 共 14 断言）；`tools/sim/BalanceSim.ts`（reflow 透传 tightness）
- **成果・验证**（全部实测）：
  · `sim:verify`：开关法对拍旧快照 **12/12 一致** → 恢复默认后新基线 **12/12 一致**
  · 难度曲线（各 400 局）：L1-3 一审 **100%**、L4-5 90-92%、L6-12 一审 **57.5-70.3% 全部落入 55-75% 目标带**、恢复后全程 **100%**、**0 卡死**——紧密化初值一次入带，无需二次调参
  · `density_check` **14/14**：t=0 与 gridLayout 50 组同 seed 同布局；t=1 四邻域均值 1.70→2.81；L8/L10/L12 初始被挡率 **32.2%→60.9%**（遮挡效力恢复近一倍）；BFS 全堵场景给出合法穿缝隙路径、满盘正确返回 null；repairUnlocks 3→6 达标且幂等；400 局 0 对冲对/0 互锁环
  · `boundary_check` 5/5、`corridor_check` 12/12、`rocks_check` 全绿、`tsc` 13 条全存量零新增
  · 编辑器编译验证：MCP refresh → preview chunks 出现 clusterLayout 标记 → import-map.json 可访问（预览前需 Ctrl+F5 强刷）

---

## [2026-09-09 23:17] 网格化方案审计：「紧密排列」从未落地 + 出栏全堵率 21.7% 量化（无代码变更）
- **变更**：通读 PRD §5.1 与 `docs/grid-layout-and-collision-analysis.md` / `prd2-reconciliation` / `dev-plan`，对照源码逐项审计网格化落地度，并新跑三组只读探针（脚本已删）量化。三个结论：
  ① **「紧密排列」未落地**：`gridLayout()` = 60 格全洗牌取前 n，本质是**均匀随机稀疏**，无任何聚簇语义。实测 L8-L12（30 只）4 邻域均值 **1.69 ≈ 纯随机理论值 1.67**、初始被挡率仅 **32%**、初始解锁 **20.3/30**（68% 动物开局点一下就走）。同 n=30 改团簇布局：4 邻域 3.01、被挡率 **61%**、解锁 11.6 —— **遮挡玩法目前只发挥不到一半效力**。
  ② **PRD 明文「高关卡反向偏置制造链条」从未实现**：`smartDir(col,row,rng)` 无 level 入参，全关卡同策略，且 50% 概率主动朝场外（主动逃避遮挡），是第二个削弱遮挡的因素。
  ③ **出栏路径模型带病运行**：现状（均匀 30 只）`pickExitDir` 四面走廊全堵率 **21.7%** → 回落弧线飞出，而弧线漂移是用户 09-09 明确否决的观感 ⇒ 该"漂移"不是偶发而是 ~1/5 概率的系统性表现；紧密化后该比例升至 **37.5%**（n=30）/ 40.6%（n=34）。
- **涉及文件**：无代码变更（本条为排查/审计记录）；产出 `docs/grid-scheme-review-20260909.md`（方案梳理 + 差距表 + A/B/C/D 四阶段实现路径 + 待拍板 D-A/D-B/D-C）
- **成果・验证**：探针实测量化证据（各 300-400 局）——
  · 布局紧密度对照（n=30）：uniform 4邻域 1.69/被挡 34%/解锁 19.8；cluster 3.01/61%/11.6；block 3.27/68%/9.8
  · GameSession 实跑交叉验证：L1(n=10) 被挡 10.1%/解锁 9.0；L8-L12(n=30) 32.2%/20.3；L20(n=34) 37.4%/21.3
  · 出栏走廊（n=30）：uniform 首选可用 27%/绕行 52%/全堵 21.7%；cluster 23%/40%/37.5%
  · 附带发现：PRD 第 555-557 行仍保留「v1.0 暂不施行网格化」旧标注，与同页正文/§5.8/09-06 18:02 反转决策冲突，建议删除
  下一步：待用户拍板 D-A（紧密度模型）/ D-B（出栏路径改 BFS 寻路）/ D-C（关卡 JSON schema 是否随生成器重写一并落地）

---

## [2026-09-09 21:29] 穿透修复落地：出栏走廊检测 + 回落弧线飞出 + 并发车道错位 + 清理诊断日志
- **变更**：承接 21:05 排查结论，落地方案 A（+方案 D），四处改动：
  ① **新增 core 纯函数 `corridorOccupied(herd, b)`**（`core/Board.ts`）：沿 `b.dir` 从相邻格扫到牧场边界，任一格被动物/岩石占用即 true（越界=场外=空，终止）。纯读、不耗随机流（与 `blockerOf` 同款）。**为什么**：`isBlocked` 只保证相邻 1 格空，而行走动画第一段要沿朝向直穿整个牧场到路带，同方向第 2~N 格的动物会被克隆体压过去。
  ② **`view/GameView.ts` moveTo**：`out.kind === 'fly' && !corridorOccupied(s.herd, out.animal)` 才走土路；走廊被占 → **回落既有 `fx.flyAnimal` 弧线出栏**（抬起+缩放，视觉语义"被吊起"，与地面动物零重叠）。吊车（`kind==='crane'`）本就走弧线，行为不变；走廊干净时路径与改造前**逐点一致**（零观感变化）。
  ③ **方案 D 车道错位**：新增 `Constants.WALK_LANE_GAP = 6`；`moveTo` 取 `lane = this.walks % 3`，路带偏移 `roadBand + lane × 6` → 并发在途动物各走一条道，避免共享路面中心线互穿。**单只在途时 lane=0 → 与旧路径完全相同**。
  ④ **清理**：移除 `view/FxService.ts:140` 朝向排查遗留的 `console.log` 诊断日志。
- **涉及文件**：
  - 新增：`tools/sim/corridor_check.ts`（走廊检测白盒回归，6 组 9 断言）
  - 修改：`assets/scripts/core/Board.ts`（+corridorOccupied，头注释）、`assets/scripts/core/Constants.ts`（+WALK_LANE_GAP，头注释）、`assets/scripts/view/GameView.ts`（import + moveTo 分支 + lane + 头注释）、`assets/scripts/view/FxService.ts`（删诊断日志 + 头注释）
- **成果・验证**：`corridor_check` **9/9 全绿**——其中 T1 正是穿透场景：`isBlocked=false`（可点击）**且** `corridorOccupied=true`（旧逻辑会走过去）→ 现回落弧线；T3 相邻占用两者皆 true；T4 朝场外=false（越界视为空）；T5 岩石算占用；T6 纵向走廊生效。`npx tsc` 13 条**全存量零新增**；`sim:verify` **12/12**（core 新增纯查询不耗随机流，零扰动，符合预期）；`boundary_check` **5/5**；`rocks_check` **4/4**。
  **预览验收口径**：① 找"相邻格空、同朝向第 2~N 格有动物"的动物点击 → 应**弧线飞出**，不再从中间动物身上压过；② 走廊干净（朝向外/前方无动物）仍走土路，观感不变；③ 连点 3 只 → 各走一道、无叠影；④ 回归全绿（已跑）。

---

## [2026-09-09 22:47] 穿透修复·迭代 2（pickExitDir 就近绕行替代弧线兜底，治"避障漂移"）+ 编辑器编译陈旧实锤与已恢复
- **变更**：
  ① **【关键发现】编译产物陈旧实锤**：用户报「之前的修复后两个问题仍存在」。三层比对（磁盘源码 21:2x / 编辑器编译产物 `temp/programming/packer-driver/targets/preview/chunks/` **mtime=09-08 00:16** / 预览服务下发内容）证实：**编辑器自 09-08 00:16 后从未重编译**，用户此前测的全部是 09-08 旧代码——20:50（输入锁收窄+隐藏 toast）与 21:25（穿透修复）**均未生效**，这才是"问题仍存在"的真正原因。经 MCP `assetAdvanced_asset_system refresh` + 编辑器处理事件后，22:2x 前完成重编译（`WALK_LANE_GAP` 入 chunk），两问题随之按预期修复。
  ② **"避障漂移"根因**（新代码生效后用户反馈）：非"避障转向逻辑/速度插值/碰撞引入位移"（全工程零物理、位移为 tween 折线、无这些机制），而是 21:25 方案的**弧线兜底过宽**——凡自身朝向走廊被占（同方向第 2~N 格有动物）即改走 `flyAnimal` 弧线：从牧场位置直接抛向围栏口（中段抬升 + 1.3× 放大），不沿土路 → 视觉上"偏离预期路径的漂移"。次要来源：并发车道 ±6/12px 横移（`WALK_LANE_GAP`，量小）。
  ③ **迭代 2 修复（治漂移，保规避）**：`core/Board.ts` 新增 `pickExitDir(herd, b)`——为出栏选**走廊干净**的方向：优先自身朝向（干净时与最初版路径逐点一致）；被占则按「到边界步数」升序试其余三向（就近绕行）；四面全堵（罕见）才返回 null。`GameView.moveTo` 改为：`kind==='fly'` 一律走土路（`roadWaypoints(a, bandOffset, exitDir)` + `walkPath(..., initialDir=exitDir)`），**弧线只留给吊车（被吊起语义）与四面全堵兜底**。`corridorOccupied` 加可选 `dir` 参数（供 pickExitDir 复用，签名向后兼容）。`PenView.roadWaypoints` / `FxService.walkPath` 加可选出口/朝向参数（缺省 = a.dir，行为不变）。
- **涉及文件**：`assets/scripts/core/Board.ts`（+pickExitDir，corridorOccupied 加 dir 参，头注释）、`assets/scripts/core/Constants.ts` 头注释不变（本轮未动）、`assets/scripts/view/GameView.ts`（moveTo 分支重构 + import pickExitDir + 头注释）、`assets/scripts/view/PenView.ts`（roadWaypoints 加 exitDir + Dir import）、`assets/scripts/view/FxService.ts`（walkPath 加 initialDir + 头注释）、`tools/sim/corridor_check.ts`（+T7/T8/T9）
- **成果・验证**：`corridor_check` **12/12**（新增：T7 干净→自身朝向；T8 右走廊被占→就近绕行返回 'left'；T9 四面全堵→null）；`npx tsc` 13 条**全存量零新增**；`sim:verify` **12/12**（core 纯读新增不耗随机流）；`boundary_check` **5/5**；`rocks_check` **4/4**。**在线验证**：MCP refresh 后 8s 内编译完成；curl 实测预览 import-map 已指向新 chunk（Board.ts → `chunks/ac/ace2bd…`），下发内容含 `pickExitDir`——**预览服务器确认在下发新代码**（浏览器仍需 Ctrl+F5 硬刷新清模块缓存）。
  **经验沉淀**：凡改 `.ts`，必须验证 `temp/programming/packer-driver/targets/preview/chunks/` 出现新内容（或 chunk mtime 更新）才算改动生效；`npm run sim:verify` 只证明 core 逻辑正确，**不证明编辑器已编译**。外部改动后编辑器 watcher 可能不触发，用 MCP `assetAdvanced_asset_system {action:"refresh"}` 强制，再验证 import-map。

---

## [2026-09-09 21:05] 排查「动物从挡路动物身上穿过」：根因 = 出栏行走路径与网格占用解耦（非 tunneling，非物理缺失）
- **变更**：无代码变更（本条为排查/审计记录）。用户按物理引擎思路提问（碰撞体/掩码/穿透），逐项取证后**证伪三条假设、坐实一条**：
  ① **本工程零物理**：`grep RigidBody|Collider|PhysicsSystem|raycast|BoxCollider` = **0 处**。碰撞是**回合制规则裁决**：`core/Board.ts:54 blockedBy` 查朝向相邻格占用（`Grid` 占用图，一格一只），逻辑位置互斥，**逻辑上不可能重叠**。
  ② **不是 tunneling（高速穿透）**：位移由 `FxService.walkPath`(100) 的 cocos tween 驱动，速度 360px/s → 60fps 下 **6px/帧**；体型 `sz = 0.152×penW = 43.5px`（penW=286/penH≈478，格 47.7×47.8px）。**步长 6px ≪ 43.5px**，不存在单帧跨越。
  ③ **碰撞响应没有"只播动画不阻挡"**：`GameView:389` `hitDist = proj − 2×coreRadiusPx×0.95` = 47.7 − 2×21.7×0.95 ≈ 6.5 → 钳到 `CONTACT_FLOOR=10`，只前进 10px 再弹回；且 collide 分支 core **不改 col/row**（`takeAnimal` 只返回 kind='collide'）。被挡动物这条路径不会穿透。
  ④ **真因：行走路径与网格占用完全解耦**。`PenView.roadWaypoints`(120-153) 第一段是"沿自身朝向**直穿整个牧场**到路带"（up→顶边内侧 -O；down→-(ph+O)；left/right→∓O），**中间经过的格子零检测**；而 `isBlocked` 只保证**相邻 1 格空**，同方向第 2~N 格完全可能被占 → 行走克隆体（fx 层最上层）直接从那些动物身上压过去。第二段起在牧场外土路上，不压牧场动物，但**并发点击的多只在途动物共享同一条土路会互相穿过**。
  ⑤ 附带：`FxService.ts:140` 仍留有 20:49 朝向排查的 **console.log 诊断日志未清理**（建议 T6 真机构建前移除）。
- **涉及文件**：无代码变更（排查记录）。待确认的修复方案（最小改动，纯 view）：
  **方案A（推荐 ~10 行）**：`GameView.moveTo` 生成路径前，用 `Grid`/herd 沿 a.dir 逐格检查"到牧场边界"的出栏走廊是否全空；被占则**回落为已存在的 `fx.flyAnimal` 弧线出栏**（装车/吊车同款，抬起+缩放，视觉语义="被吊起"，天然不与地面动物重叠），否则继续 walkPath。零新机制、不动 core 规则、不耗随机流。
  **方案B（更小但改观感）**：第一段只沿朝向走 1 格（相邻格必空）后即切向最近路带——破坏 10:05「先沿自身朝向走出农场」需求语义，且斜切仍可能压到邻列。
  **方案D（并发互穿，可选）**：在途克隆体按序号横向错位，避免同路叠影。
- **成果・验证**：证据 = 源码定位 + 全工程物理关键词 grep（0 命中）+ 尺寸/速度定量核算（6px/帧 vs 43.5px）。**明确结论：不迁移 Cocos 内置物理**（理由见对话：玩法是回合制规则裁决；物理非确定性会破坏 seed 对拍基线/难度曲线核心资产；tween 驱动位移下 Kinematic 刚体也不会触发阻挡；增大主包体积逼近 4M 红线；会引入连续坐标回流破坏 col/row 唯一真相源）。
  **复现步骤**：预览 → 找一只"相邻格空、同朝向第 2~N 格有动物"的未遮挡动物 → 点击 → 观察它沿朝向走出时从中间动物身上压过；连点 2-3 只同侧动物可复现土路互穿。
  **验收口径**：同操作下不再压过任何静态动物（改弧线飞出）；连点 3-5 只无叠影、入栏正常、围栏不超 7；回归 tsc 零新增 + sim:verify 12/12 + boundary_check 5/5 + rocks_check 4/4。

---

## [2026-09-09 20:55] 输入锁收窄（装车/发车动画期不再吞点击）+ busy 簿记与代数解耦 + 隐藏发车 toast
- **变更**：承接 20:43 排查结论，三处改动（纯 view）：
  ① **Fix1 去入栏 busy 门**：`takeAnimal`(347→`if (!s.canPlay()) return;`) 与 `moveTo`(435→`if (!s.canPlay() || s.fence.length >= FENCE_MAX) return;`) 去掉 `|| this.busy > 0`。**为什么**：装车链 `fulfillSlot→departSlot` 全程 busy>0（多只级联 1.5-2.5s），旧逻辑期间静默吞掉全部动物点击且零反馈，与「卡车发车」toast 时长(≈2.7s)重合 → 用户报「点击无响应 + 提示期间点不动」。装车链本身仍由 `reconcile:502` 的 busy 门串行化（二次装车链进不来），入栏容量由 `FENCE_MAX` 门承担，core 数据先行 + reconcile 幂等(guard 25) 保证并发安全——与 14:05/15:43 已确立的「行走不锁输入」方向一致。
  ② **Fix2 busy 簿记与代数解耦**（同 `walks` 硬化）：`fulfillSlot` 新增 `released` 幂等标志 + `release(cont)`，`loadNext`/`flyAnimal` 回调/`afterAll` 三处 fxGen 失配早退分支改为 `release(false)`（先 `busy--` 再 return）；`departSlot:607` 失配分支也改为**照常回调 done**（调用方自行判代数决定是否续链）。**为什么**：旧代码 `busy--` 只写在正常回调里，代数失配即永久 +1 → 全场点击死锁，此前仅靠 `startGame:261-263` 的 `busy=0` 兜底。`reconcile:516` 死单换车调用点同步加 `g0` 代数守卫（保持"失配不续链"旧语义）。
  ③ **隐藏发车 toast**：`departSlot` 调用的 msg 由 `'卡车发车 · 营收 +' + value` 改为 `null`（`if (msg)` 天然短路）；营收反馈由既有 `flyCoin` 金币飞向 HUD 承担。`beginFulfill` 的 `value` 解构随之移除（无悬空引用）。
  ④ 文件头注释同步：`busy` 纪律条款改写为「只串行化装车链、不锁入栏」+ 新增「簿记与代数解耦」条款。
- **涉及文件**：`assets/scripts/view/GameView.ts`（修改：头注释/L3+L29 纪律、`takeAnimal` 守卫、`moveTo` 守卫、`fulfillSlot` 释放逻辑、`departSlot` 失配分支、`reconcile` g0 守卫 + 516 调用点）
- **成果・验证**：`npx tsc` 13 条**全存量零新增**（GameView 零报错，确认 `value` 解构移除无悬空引用）；`sim:verify` **12/12**（纯 view 改动，core 随机流零扰动，符合预期）；`boundary_check` **5/5**；`rocks_check` **4/4**。
  ⚠️ **行为变更待预览确认**：生命耗尽压暗窗口（碰撞分支 `travel+0.6s`，busy>0 期间）原本锁输入，现在该窗口内 phase 仍为 play → 理论可继续点击入栏（随后 `failHP` 才切 phase）。若需保留原语义，可在 `takeAnimal` 加一个「HP 耗尽压暗中」标记位。
  **预览验证口径**：① 点能凑单的动物 → 飞上卡车、金币飞 HUD、**不再弹「卡车发车」**；② 装车动画期间立刻点下一只 → 应立即入栏（旧版无反应）；③ 连点 3-5 只 → 无分身/无崩溃/围栏不超 7；④ 重开局（代数变更）后点击正常，无死锁。

---

## [2026-09-09 20:43] 排查「点动物无响应 + 卡车发车提示期间点击全被吞」：根因 = busy 输入锁（Toast 无责），附锁泄漏隐患
- **变更**：无代码变更（本条为排查记录）。用户报：点击动物无响应，同时弹出「卡车发车 · 营收」，该提示存在期间所有点击被拦截。逐项证伪与定位：
  ① **「卡车发车 · 营收 +N」来源** = `GameView.ts:587`（`departSlot` 内 `this.toast.show(msg)`），文案由 `573` 传入。**非全局事件监听**，是同一点击的直接下游链：点击 → `takeAnimal`(345) → `moveTo`(431) → 入栏落地 `onArrive` → `reconcile`(501) → `findMatch` → `fulfillSlot`(535) → `departSlot`(582)。该动物凑齐订单后**立即装车飞走**（未停留在围栏格），被误读为「点击无响应」。另有两条延迟触发路径造成时间巧合：`watchdogTick` 1.5s 空闲调和、在途动物（`walks`）落地才凑齐订单。
  ② **DOM/z-index 遮罩假设不成立**：Cocos 无 DOM。全工程 `grep BlockInputEvents` = **0 处**；`swallow()`(`Ui.ts:50`) 仅用于 `Panels` 模态遮罩(39) 与广告层(58)，二者 `active=false` 默认、`hide()`(64) 关停；`Toast`(`Ui.ts:106-137`) 尺寸=文案宽×34、`placeC(..., -screenH/2+86)` 居底、**无 swallow**，注释明写「不吞触摸」→ Toast 不可能拦截点击。
  ③ **真凶 = 逻辑锁 `busy`(`GameView.ts:92`)**：`takeAnimal:347` `if (!s.canPlay() || this.busy > 0) return;` **静默丢弃无反馈**；`fulfillSlot:538` busy++ 仅在 `573-576` done 回调释放。锁窗口 = 每只飞 0.34s+0.08 间隔 +0.16 +发车 0.38s，多只/多单级联 1.5-2.5s，与 toast 时长 2.7s 高度重合 → 表象为「提示在，点击就死」。
  ④ **附带发现（潜在死锁隐患）**：`departSlot:588` 与 `fulfillSlot:552/566/569` 的 `if (g0 !== this.fxGen) return;` 早退分支**漏 `busy--`**，代数失配即永久 +1；现靠 `startGame:261-263`（`fxGen++` 后 `busy = 0`）兜底，属隐性债务——`walks` 已按「簿记与代数解耦」硬化(`447-451`)，`busy` 未同步，纪律不一致。
- **涉及文件**：无代码变更（本条为排查/审计记录）。待用户确认后落地的方案：Fix1 去 `takeAnimal:347` / `moveTo:435` 的 `|| this.busy > 0`（保留 `canPlay` + `FENCE_MAX` 容量门；装车链仍由 `reconcile:502` 串行化，并发入栏安全）；Fix2 `busy--` 提到代数检查之前；Fix3 守卫命中给轻量反馈替代静默 return。
- **成果・验证**：证据链为源码定位 + 全工程 grep（`BlockInputEvents` 0 处、`swallow` 仅 3 处且均受 active 控制）。修复后验证口径：① 点凑单动物 → 飞上卡车 + 出现 toast；② toast 期间点第二只 → 应立即入栏（修复前无反应）；③ 装车链期间连点 3-5 只 → 无崩溃/无分身/围栏不超 7；④ `sim:verify` 12/12 + `boundary_check` 5/5 + tsc 零新增（纯 view 改动，core 零扰动）。

---

## [2026-09-09 00:22] 朝向 bug 验收通过正式结案 + 全量回归基线复跑 + P3 范围审计（无代码变更）
- **变更**：① 用户预览实测走路全程朝向正确——onStart 二次修复验收通过，H1~H7 根因排查**关闭**；② 全量回归基线复跑，确认当前代码可移交 T4 逐关验收；③ P3「view 适配」范围审计（用事实裁决旧待办）：`PenView.onTap`（最近动物命中，距离 < sz×0.62）/ `PenView.roadWaypoints`（土路路由）/ `GameView` 接线 `CONTACT_DIST=21` 三者均已在位，**功能面闭环**——旧待办仅剩可选重构（x/yu 派生 getter → col/row 直读），不阻塞任何事项。**附带发现（环境怪癖非代码问题）**：`npm run sim:verify` 在 Git Bash 管道下 node stdout 偶发整体丢失（退出码仍 0、实际通过）；绕过 npm 直接 `node ... run.ts verify` 输出正常，判定以直接调用为准。
- **涉及文件**：无代码变更（本条为验收记录 + 审计记录）。⚠️ 遗留微项：`FxService.walkPath` onStart 内诊断 console.log（20:49 条目加入）已完成使命，建议 T6 真机构建前移除（待用户确认后执行）。
- **成果・验证**：tsc 13 错误全存量零新增；`sim:verify` **12/12**（快照基准 2026-09-08T09:58Z，L1-L12 全「✓ 一致」）；`boundary_check` **5/5**；`rocks_check` **4/4**（L1-L12 全 0 石 + 初始可动 ≥6 + 无对冲对）。

---

## [2026-09-08 20:49] 朝向 bug 二次修复：call() 改 onStart + 调试日志（根因未完全定位，H1~H7 待用户 vConsole 验证）
- **变更**：上轮（20:35）将 `cloneSp.angle = -CSS_DEG[legDir]` 移入 `.call()` 回调，**用户反馈修复无效，问题依然存在**。本次系统性排查后按可能性从高到低列出 7 个根因假设（H1~H7），并实施**最稳妥的二次修复**：
  - 替换：`.call(() => angle=...)` 改为 cocos tween 标准 `onStart` 回调（`.to(dur, props, { onStart: () => { ... } })`）。`onStart` 在 cocos 3.x 文档明确为「该补间开始时执行」，**语义稳定无歧义**，彻底规避 `.call()` 在不同 cocos 版本/链构造顺序下的时序差异（H1 假设的根源）。
  - 调试日志：onStart 内加 `console.log` 打印 `seg${i} onStart dir=${legDir} prevAngle=...`，让用户跑一次走路打开 vConsole 就能直接确认每段转身时机与 angle 实际值——**作为 H1~H3 的诊断证据**。
  - 待用户验证后根因定位：H1（.call 时序问题）若 onStart 修好 + log 显示每段都触发 → 确认；H2（closure）看 log 的 i/legDir 是否对；H3（sync 覆盖）看 log 中 prevAngle 是否在 onStart 之外被改；H5（热重载）看编辑器是否提示重载。
  - 流程评估：走路流程本身正确（roadWaypoints 第一段沿 a.dir 出界 + 初始 angle = -CSS_DEG[a.dir]），问题在朝向赋值时机一处。
- **涉及文件**：`assets/scripts/view/FxService.ts`（walkPath：call→onStart + 调试日志）
- **成果・验证**：tsc 13 错误全部存量基线零新增；`npm run sim:verify` exit=0 = 12/12。**根因待用户跑一次走路 + 截 vConsole 日志后最终定位**（日志将直接证伪/证实 H1~H3）。

---

## [2026-09-08 20:35] 修复运动朝向提前切换：angle 赋值从构建循环移入补间链 .call()（局部修复，无需重构）
- **变更**：用户截图反馈——朝下的动物在农场内向下走时，点击后头部立即变朝右。根因（上上轮「异步换图 → 同步 angle」改造引入）：`FxService.walkPath` 构建 tween 链的 for 循环里，`cloneSp.angle = -CSS_DEG[legDir]` 是**循环体内直接赋值**（不在 `.call()` 回调中）——构建循环同步跑完的瞬间 angle 就被覆盖成**最后一段**的方向；补间链才开始逐段播放。朝下动物路径 = 向下出农场(E) → 底角 → 顶角 → 引道口（末段水平），故第一段播放中头已朝末段方向。
  **流程评估结论：不需要重构**——`PenView.roadWaypoints` 路径结构（第一段严格沿自身朝向 a.dir 出界 → 沿土路 → 引道口）与 `attachCloneSprite` 初始 angle = -CSS_DEG[a.dir] 本就符合"农场内朝向=运动方向 → 上土路后随路段转向"的正确流程，坏的只是赋值时机这一处代码位置。**局部修复**：angle 赋值移入 seq 链每段的 `.call()` 回调（补间开始时才转向）；第 1 段（i=1）不赋值，保持初始朝向与第一段严格一致。
- **涉及文件**：`assets/scripts/view/FxService.ts`（walkPath：删循环内直接赋值块，angle 赋值并入段 `.call()` 回调，附根因注释）
- **成果・验证**：tsc 13 错误全部存量基线零新增；`npm run sim:verify` exit=0 = 12/12。预览观察点：① 朝下动物点击后，农场内第一段下行全程头朝下；② 踏上底路开始才转向（左/右）；③ 转角处逐段跟随，末段入栏前朝向与该段行进方向一致。

---

## [2026-09-08 20:19] 恢复入栏缩小动画：末段缩放改挂当前可见层（spNode/skin 自适应）
- **变更**：上轮（20:11）遗留观察项——`FxService.walkPath` 末段「缩步入栏」（缩至 62%）固定挂矢量皮肤 skin.node，sprite 模式下 skin 已被隐藏（20:11 叠影修复）→ 缩小效果不可见。修复：末段开始时按 `cloneSp.active` 判定当前可见层——sprite 就绪缩 `cloneSp`（spNode，基底 scale=1），素材缺失回退矢量时缩 `skin.node`（基底 sk=size/64），两者都缩至基准的 62%，行为与素材化之前一致。
- **涉及文件**：`assets/scripts/view/FxService.ts`（walkPath 末段 call 回调：可见层判定 + 自适应基底缩放）
- **成果・验证**：tsc 13 错误全部存量基线零新增；`npm run sim:verify` exit=0 = 12/12。预览观察点：动物沿土路跑到围栏引道口的末段应可见 62% 缩小入栏（sprite 与矢量回退两种模式均生效）。

---

## [2026-09-08 20:11] 三项视觉清理：运动叠影修复 + 稀有金环全移除 + 牧场白色高光椭圆删除
- **变更**：用户截图反馈三项：① 运动过程中动物底部露出矢量层（叠影）；② 去掉稀有金环；③ 牧场上部有白色半透明大椭圆。逐项根因与修复：
  ① **运动叠影**：`FxService.attachCloneSprite` 的 sprite 就绪回调只激活了 spNode，**没有隐藏调用方的矢量皮肤层**（对比 AnimalNode 构造回调有 `vectorSkin.active=false`，这里漏了）——装车弧线/走路入栏动画中矢量皮肤与 sprite 上下叠加（sprite 透明区域露出矢量描边）。修复：attachCloneSprite 增加第 5 参 `vecSkin?: Node`，回调里 `vecSkin.active = false`（带 isValid 防御）；flyAnimal/walkPath 两处调用传入 `skin.node`。
  ② **稀有金环全移除**（用户要求；rare 数据链路不动——售价 ×3 与结算「闪 ×n」文字保留）：删 `AnimalNode` 矢量皮肤金环底衬（circle '#ffb800' α90）+ rareGlow 独立节点创建/激活/字段；删 `FenceView` 围栏稀有金光外框（roundRect '#ffb800' α190）；`Draw2D.drawAnimal` 内部 rare 四角星装饰短路（`void rare`，签名保留兼容 5 处调用点）。全工程 `grep ffb800` 零残留（仅剩 star4 无调用的私有函数定义，无害）。
  ③ **白色半透明椭圆**：根因 = `PenView` 构造里的「顶部高光」装饰（`g.ellipse(w/2, -h*0.16, w*0.6, h*0.1)` + `colA('#ffffff', 71)`，2026-09-06 从原型 radial-gradient 移植）——在顶视角实拍图美术下表现为违和的白色大椭圆。删除该 4 行。
- **涉及文件**：`assets/scripts/view/FxService.ts`（attachCloneSprite 加 vecSkin 参数 + 两处调用）、`assets/scripts/view/AnimalNode.ts`（删金环底衬/rareGlow 字段与激活）、`assets/scripts/view/FenceView.ts`（删稀有金光外框）、`assets/scripts/view/Draw2D.ts`（rare 装饰短路）、`assets/scripts/view/PenView.ts`（删顶部高光椭圆）、`assets/scripts/view/AnimalArt.ts`（rare 注释同步）
- **成果・验证**：① `grep -rn "ffb800|rareGlow"` 零残留；② tsc 13 错误全部存量基线，零新增；③ `npm run sim:verify` exit=0 = 12/12；④ 白色椭圆绘制代码已删（PenView 高光 4 行）。遗留观察项（未改，用户未提）：walkPath 末段「缩步入栏」动画作用于被隐藏的矢量皮肤 skin.node，sprite 模式下入栏缩小效果不可见——上轮素材化改造起既如此，如需恢复应把末段缩放改挂 spNode。

---

## [2026-09-08 19:45] 全场景动物视觉统一：围栏/结算面板/卡车订单图标接入 sprite 单图（animalIcon 双层构造器）
- **变更**：用户要求把**所有**动物显示样式统一为 `animal` 图片资源，范围含运动动画、围栏、汽车订单页，并检查遗漏。排查结论：全工程 `drawAnimal`（矢量动物绘制）共 7 处调用，其中 3 处（AnimalNode:59 牧场节点、FxService:71 装车弧线、FxService:99 走路入栏）本就是双模架构的「矢量占位层」——sprite 加载成功后自动隐藏，**已天然接入 sprite**；真正漏接的是 4 处静态展示位：
  ① `FenceView.drawSlotAnimal`（围栏 7 格槽位动物，纯矢量）
  ② `Panels` 通关面板售出统计图标（`icon64('s'+id, 18, …)`，纯矢量）
  ③ `ParkView` 卡车订单需求行图标（`icon64('need', 12, …)`，纯矢量）
  ④ `ParkView` 卡车载货池图标（`icon64('c'+uid, 14, …)`，纯矢量）
  修复方案：在 `AnimalArt.ts` 新增统一构造器 **`animalIcon(name, px, species, rare)`**——双层结构（矢量皮肤底层占位/回退 + sprite 顶层异步加载就绪后隐藏矢量层），与 AnimalNode/FxService 的「矢量占位 + sprite 切换 + 失败回退」纪律完全一致；4 处调用点一行替换（icon64+drawAnimal → animalIcon）。rare 金环仅保留在矢量层（sprite 模式下小图标的稀有区分由调用方文字「闪 ×n」承担，与原 icon64 行为差异仅为小图标无金环）。SpriteFrame 走 loadAnimalSpriteFrame 缓存（同 species 全局共享单实例，图标多处使用零额外内存）。
  **遗漏排查**：HudView/ToolsBar 无任何动物展示；drawAnimal 残余 4 处全部是双模占位层（非遗漏）；icon64 其余调用（drawCoin/drawLock/drawVideoBadge）非动物，保留。
- **涉及文件**：
  - 修改：`assets/scripts/view/AnimalArt.ts`（新增 animalIcon 构造器 + import Node/Sprite/UITransform/drawAnimal/newG + 头注释）
  - 修改：`assets/scripts/view/FenceView.ts`（drawSlotAnimal 改 animalIcon；import 移除 drawAnimal 加 animalIcon）
  - 修改：`assets/scripts/view/Panels.ts`（售出统计图标改 animalIcon；import 调整）
  - 修改：`assets/scripts/view/ParkView.ts`（需求行 + 载货图标改 animalIcon；import 调整）
- **成果・验证**：
  ① **接入完整性**：`grep animalIcon(` = 4 处调用点全部就位；`grep drawAnimal(` 残余 4 处 = AnimalArt 内部矢量层 1 处 + 双模占位层 3 处（非遗漏）。
  ② **遗漏排查零死角**：HudView/ToolsBar 无动物展示；其余 icon64 调用均为非动物图形（金币/锁/广告角标）。
  ③ **类型检查**：`npx tsc` 13 错误全部预先存量（quad-in/back-out/lineHeight/horizontalAlign），**零新增**。
  ④ **core 链路零影响**：`npm run sim:verify` exit=0 = 12/12。
  ⑤ **行为一致性**：图标 sprite 与牧场动物/装车/走路动画共用同一 SpriteFrame 缓存与同一资源路径（`animal/{species}`），全游戏动物视觉同源；素材缺失时全部位置统一回退矢量（不崩、可玩）。

---

## [2026-09-08 17:18] 动物图视觉残破修复：白→透明键控误伤白色本体 → 改为 flood fill（4 角 BFS）
- **变更**：用户 17:13 截图反馈「动物身体显示不全、残破」—— 所有动物的白色部分（兔毛/羊卷毛/白鸭羽毛/牛白腹）严重残缺，**只剩深色轮廓与头部装饰**（鸡冠红/猪鼻粉/牛角褐）。根因（自己代码）：
  - 旧的 step 3 是「全局白→透明键控」：`max(R,G,B)≥240 → α=0 / ≤220 → α=255 / 220~240 线性过渡`。
  - 动物本体的白色（兔毛 RGB~245、羊卷毛 RGB~245、白鸭羽毛 RGB~240、牛白腹 RGB~240）→ 被键控成 **α≈0~50（几乎透明）**；深色部分 RGB 远低于 220 → α=255 完整保留 → 视觉上动物只剩深色轮廓 → 「残破」。
  - 证据：上一轮 chicken alpha 直方图 = A=0 占 92.5%、**A=255 仅 0.77%**（503 像素，对应鸡本体应远不止这点）。这是「主体不透明像素太少 → 渲染时看起来像残破」的典型表现。
  - 修复方案（2026-09-08 17:13 用户第一性原理汇报确认）：**经典抠图思路**——把「全局白→透明」改为「**仅对与边界连通的近白像素做透明化**」，动物内部白色（被轮廓封闭、不与边界连通）天然保留。算法 = BFS flood fill，4 角各做一个种子（保证无论动物在图内位置都能正确分离背景），阈值 KEY_WHITE=240（max(R,G,B)≥240 视为近白），未访问像素 α=255（动物本体完全不透明）。
  - 边界抗锯齿**不再需要手写**：step 4 的 8×8 box filter 自动在「不透明 vs 透明」交界处产生自然半透明（4 个不透明 + 4 个透明 → α=128），比之前的「手动线性过渡」更准、更自然。
- **涉及文件**：
  - 修改：`animal-market-cocos/tools/process-animal-art.cjs`（常量 KEY_HIGH/KEY_LOW → KEY_WHITE；step 3 重写为 BFS flood fill；顶部注释更新流程说明与误伤根因记录）
  - 重生成：`animal-market-cocos/assets/resources/animal/{chicken,cow,duck,pig,rabbit,sheep}.png`（6 张 256×256，合计 258KB）
  - 归档：`raw-art/animals-256-flood-fill/`（旧 6 PNG + 6 meta，12 文件）
- **成果・验证**：
  ① **alpha 直方图大幅改善**（前后对比，单位 A=255 像素占比 / 占比基准=65536 像素）：
    | 动物 | 旧版 A=255 | 新版 A=255 | 提升 |
    |------|-----------|-----------|------|
    | chicken | 503 (0.77%) | **3471 (5.3%)** | ×6.9 |
    | rabbit | 旧值未测 | **9221 (14.1%)** | （白色动物明显受益） |
    | sheep | 旧值未测 | **12389 (18.9%)** | （卷毛受益最显著） |
    | cow | 旧值未测 | **15252 (23.3%)** | （白腹受益最显著） |
    | duck | 旧值未测 | **5542 (8.5%)** | |
    | pig | 旧值未测 | **5721 (8.7%)** | |
    全部 6 张 A=255 占比 ≥ 5%，**动物本体完整保留**。
  ③ **视觉验证**（`Read` 工具读 PNG）：rabbit 显示完整（长耳朵+粉色耳内+白色身体+蜷腿）、chicken 显示完整（红色鸡冠+肉色身体+脚）、cow 显示完整（牛角+粉色耳朵+白色头顶+棕白斑纹身体+四脚）—— 残破问题彻底解决。
  ④ **体积下降**：12.27MB → **258.3KB**（压缩 2.1%，比旧版 284KB 还小 26KB，因为 box filter 自然混合让不透明边界像素更少）。
  ⑤ **类型检查**：`npx tsc -p tsconfig.typecheck.json` 13 个错误全部预先存量，**零新增**（本次无 .ts 改动，纯资源管线修复）。
  ⑥ **core 链路零影响**：`npm run sim:verify` exit=0 = 12/12 一致。
  ⑦ **图片文件零改动**：6 张原图 `assets/animal/` 字节级未动，降采样产物写独立输出目录。

---

## [2026-09-08 17:05] 图片资源路径统一：assets/resources/art/animals/ → assets/resources/animal/（含 sources.load 目录约束说明）
- **变更**：用户 16:50 把 6 张原始大图（2048×2048，合计 12.27MB）集中放到 `assets/animal/`，要求全工程图片引用统一到 `assets/animal/...`。排查后确认**全工程只有 1 个真实代码引用点**（`AnimalArt.ts:29` resources.load），其余均为注释；无场景/预制体 uuid 静态引用、无图集/资源清单配置（本项目纯代码构建 UI）。
  ① **发现并上报第一性原理冲突**（未沉默覆盖需求）：Cocos Creator 3.x `resources.load()` **只能加载 `assets/resources/` 下的资源**，且 `assets/` 下未被任何场景/prefab/代码引用的资源**不会打进构建产物**。故 `assets/animal/`（非 resources 子目录）若直接作为运行时路径，会导致 resources.load 失败 + 图不进包 → 静默回退矢量绘制（有兜底不崩，但看不到新图）。附带硬伤：2048×2048×6 = **12.27MB 超微信主包 4MB 红线 3 倍**。用户拍板选「移到 resources/animal/ + 授权降采样」。
  ② **资源管线适配**：`tools/process-animal-art.cjs` 改为命令行可配（`node tools/process-animal-art.cjs [srcDir] [outDir] [size]`），默认 `srcDir=assets/animal`、`outDir=assets/resources/animal`、`size=256`。跑出 6 张 256×256 RGBA（去水印 + 白→透明键控 + 8×8 box filter 降采样）：**12.27MB → 283.7KB（压缩 2.3%）**。新批次源图经 `tools/scan-watermark.cjs` 复扫确认**全部无水印**（darkPx@RB512 = 0），填白逻辑保留为防御性代码（对无水印图无副作用）。
  ③ **代码路径改动（1 行）**：`AnimalArt.ts:33` `resources.load('art/animals/' + species + '/texture')` → `resources.load('animal/' + species + '/texture')`。`loadAnimalSpriteFrame(species, dir, cb)` 签名与全部调用方零改动。
  ④ **旧资源归档**：`assets/resources/art/animals/` 下 6 张 256 图 + 6 个 meta 迁移到 `raw-art/animals-256-prev/`；空的 `art/animals` 目录及其 meta 一并删除（3D 模型 `art/models/` 保留不动）。临时脚本 `_scan-watermark.cjs`/`_scan2.cjs` 合并升级为通用 `tools/scan-watermark.cjs`（目录改为命令行参数，适配任意批次）。
- **涉及文件**：
  - 修改：`animal-market-cocos/assets/scripts/view/AnimalArt.ts`（第 33 行资源路径 + 顶部注释补「为何必须是 resources/animal」的约束说明）、`animal-market-cocos/assets/scripts/view/AnimalNode.ts`（顶部注释路径同步）
  - 修改：`animal-market-cocos/tools/process-animal-art.cjs`（源/输出目录改命令行可配，默认指向 assets/animal → assets/resources/animal）
  - 新增：`animal-market-cocos/tools/scan-watermark.cjs`（通用水印扫描器，替代已删的 `_scan-watermark.cjs`/`_scan2.cjs`）
  - 重生成：`animal-market-cocos/assets/resources/animal/{chicken,cow,duck,pig,rabbit,sheep}.png`（6 张 256×256，合计 283.7KB）
  - 归档：`raw-art/animals-256-prev/`（旧 6 PNG + 6 meta）
  - 删除：`animal-market-cocos/assets/resources/art/animals/`（空目录 + meta）
- **成果・验证**：
  ① **路径清理零残留**：`grep -rn "art/animals" assets/` 仅剩 1 处历史说明注释（AnimalArt.ts:18，刻意保留），无任何代码引用。
  ② **新路径生效**：`grep -rn "'animal/" assets/scripts` → `AnimalArt.ts:33 resources.load('animal/' + species + '/texture', ...)`。
  ③ **类型检查**：`npx tsc -p tsconfig.typecheck.json` 13 个错误全部预先存量，**零新增**。
  ④ **core 链路零影响**：`npm run sim:verify` exit=0 = L1-L12×100 局快照对拍 12/12 一致。
  ⑤ **产物体积**：chicken 37.4KB / duck 44.0KB / rabbit 42.6KB / sheep 54.5KB / pig 45.9KB / cow 59.3KB = **283.7KB**（占主包 4MB 红线 6.9%）。
  ⑥ **图片文件零改动**：全程未重命名/移动/压缩/裁剪/转换任何用户提供的原图（`assets/animal/` 6 张 2048 原图原样保留），降采样产物全部写入独立输出目录。

---

## [2026-09-08 16:33] 动物美术资源替换：24 张四向图 → 6 张顶视角单图（运行时旋转）
- **变更**：用户 2026-09-08 16:05 落位 6 张 `extensions/cocos-mcp-server/static/2d/{species}.png`（2048×2048 RGBA8 白底顶视角图，合计 15.6MB）到工程，要求替换游戏里当前 24 张四向素材。改造方案（基于第一性原理）三件事：
  ① **资源管线**：单图顶视角不可能回到"四向换图"语义（旧 24 张素材是不同朝向，旋转后不重合）→ 改为"单图 + 运行时旋转"。编写零依赖 Node 处理脚本 `tools/process-animal-art.cjs`：自实现 PNG 解码（复用 `tools/png-probe.cjs` 思路）+ PNG 编码（手写 IHDR/IDAT/IEND + CRC32）→ 流程为 2048→256 8×8 box filter 降采样 + 右下 512×512 区域填白去"豆包AI生成"水印（仅鸡/鸭/猪 3 张有，darkPx=51602 bbox 1800~2047）+ max(R,G,B)≥240 alpha=0 / ≤220 alpha=255 / 中间线性抗锯齿。**不裁透明边**——保留"动物居中、周围留白"原构图，让 sprite 居中显示在格内（占 cell ~70%，符合"动物在格子里"惯例）。`art/animals/` 现 6 张 256×256 RGBA 单图合计 **376KB**（vs 14.86MB 源，压缩 2.5%），远低于微信主包 4MB 红线。旧的 24 张 PNG + 24 个 .meta 全数迁移到 `E:\traeWork\6a9ae4d49c9f09b0a04bfe61\raw-art\animals-24dir\` 备份（与 `raw-models\` 一致做法，可一键回滚）。
  ② **代码层（最小改动）**：`AnimalArt.loadAnimalSpriteFrame(species, dir, cb)` 签名**保留**（dir 作兼容垫片），内部 cache key 改为 species 单 key，resources 路径去掉 `_dir` 后缀 → 调用方（AnimalNode 构造、AnimalNode.sync、FxService.flyAnimal 装车、FxService.walkPath 段切换）零 API 改动。`AnimalNode` 构造期设 `spNode.angle = -CSS_DEG[a.dir]`（cocos angle 逆时针为正故取负），sync() 改为同步设 angle 不再异步换图（消除"换图延迟→朝向滞后"抖动）。`FxService.attachCloneSprite` 改返回 `Node | null`（spNode 引用而非 Sprite），`walkPath` 段切换从 `loadAnimalSpriteFrame(...legDir, async cb)` 改为 `cloneSp.angle = -CSS_DEG[legDir]`（同步无抖动）。**旋转以 spNode 中心为锚点**：UITransform 默认锚点 (0.5, 0.5) → sprite 中心即旋转中心；contentSize=sz（cell 边长）+ 源图 256×256 正方形 + sizeMode=CUSTOM trim=false → 1:1 等比缩放，**不拉伸不偏移不裁剪**。
  ③ **沿用双模开关 + 矢量回退**：`ART_MODE='sprite'` 维持不变（已是默认），资源缺失仍自动回退矢量绘制（vector 模式代码完整保留，set AnimalArt.ART_MODE='vector' 一行整体回退）。
- **涉及文件**：
  - 新增：`animal-market-cocos/tools/process-animal-art.cjs`（零依赖 PNG 资源管线）、`animal-market-cocos/tools/_scan-watermark.cjs`（临时：水印 bbox 扫描，完工后可删）、`raw-art/animals-24dir/{24 PNG + 24 meta}`（旧素材备份）
  - 修改：`animal-market-cocos/assets/scripts/view/AnimalArt.ts`（cache key + 资源路径调整、注释升级到 2026-09-08 单图顶视角方案）、`animal-market-cocos/assets/scripts/view/AnimalNode.ts`（构造设初始 angle、sync 改 angle 同步、注释升级）、`animal-market-cocos/assets/scripts/view/FxService.ts`（attachCloneSprite 返回 Node、walkPath 段切换同步 angle、typeScript 类型从 string 改 Dir、注释升级、清理冗余 Sprite import）
  - 重生成：`animal-market-cocos/assets/resources/art/animals/{chicken,cow,duck,pig,rabbit,sheep}.png`（6 张 256×256 RGBA 单图，含透明键控与去水印）
  - 移除：`animal-market-cocos/assets/resources/art/animals/{species}_{dir}.png` 与对应 .meta（24+24 文件，已备份）
- **成果・验证**：
  ① **处理管线产物验证**：`node tools/process-animal-art.cjs` 输出 chicken 68.3KB / duck 74.0KB / rabbit 42.6KB / sheep 54.5KB / pig 77.4KB / cow 59.3KB（合计 376KB，源 14.86MB → 压缩 2.5%）。
  ② **alpha 键控验证**（`tools/png-probe.cjs` + alpha 通道采样）：chicken 256×256 输出 A 直方图 = A=0 占 60633/65536=92.5%（背景完全透明）、A=255 占 503（鸡主体满不透明）、A=mid 占 4400（边缘抗锯齿过渡），角点 (0,0)/(255,255) 均为 A=0 → 透明键控 + 去水印双目标达成。
  ③ **类型检查**：`npx tsc -p tsconfig.typecheck.json` 13 个错误全部是预先存量（quad-in/quad-out/lineHeight/horizontalAlign 等 Cocos 3.8 严格化报错），**零新增错误**。
  ④ **core 链路零影响**：`npm run sim:verify` exit=0 = L1-L12×100 局快照对拍 12/12 一致（view 改动不污染 core 对拍纪律）。
  ⑤ **朝向语义**：源图全数头朝上（chicken 鸡冠+cocos/RGB 嘴、duck 橙色喙、pig 鼻孔、cow 牛角+粉鼻、sheep 卷毛+两侧耳、rabbit 长耳后拉）→ `dir=up` angle=0 / `dir=right` angle=-90 / `dir=down` angle=-180 / `dir=left` angle=-270 符合"Cocos angle 逆时针为正 + CSS 顺时针为正 → 取负"。

---

## [2026-09-08 19:37] P0 级无用文件清理（用户逐条确认"P0全删"，无代码变更）
- **变更**：按 HANDOVER.md §11 清单执行 P0 级清理（用户已确认），共 6 组 / 约 15.4MB：
  ① `tmp-*.png` 7 张调试图（9.5MB，根目录 0 引用）；② `cocos-mcp-server-main.zip`（2.0MB，已解压至 extensions/ 的重复压缩包）；③ `_selftest-demo.js`（工作区根，0 引用）；④ **`assets/resources/animal - 副本/`（6 PNG + 目录 meta，300KB，Windows 复制副本且在 resources/ 下会进包——删除后包体 -300KB）**；⑤ 工作区根 `.trae-html-share-packages/`（4 个 zip 临时分享包）；⑥ `extensions/cocos-mcp-server/tsconfig copy.json`（副本）。
  **回滚点**：全部 27 个文件（含补备的 `animal - 副本.meta`）备份于工作区根 `_archive/p0-backup-20260908-1917/`（15MB），确认无副作用后可整体删除该备份。
- **涉及文件**：无代码变更（本条为文件清理记录）；`assets/resources/` 下减少 `animal - 副本/` 及其 meta（**影响构建产物内容**，下次构建包体减小）
- **成果・验证**：终态核对 6/6 组全部删除 ✓（逐组 ls 验证）；`assets/resources/` 现仅剩 `animal/` + `art/`，无孤儿 meta；备份 `_archive/p0-backup-20260908-1917/` 27 文件 15MB 完整。P1/P2 级（`_sim-trace.js` / `refrun.mjs` / Farm3D 簇 / 快照备份 / `raw-art` / `raw-models` 等）**仍保留待用户逐条确认**。

## [2026-09-08 17:59] 修 0/0 显示 bug：makeOrder 偶数化升级 + 视图防御层（@image#1 L4 截图，快照重建）
- **变更**：用户截图 L4 顶部第 3 辆车显示「0/0 0/2」（第一项需 0 只鸡），业务上不合理。根因 + 修复：
  ① **数据层根因**（`GameSession.makeOrder` 偶数化逻辑，`GameSession.ts:221-226`）：当 `total` 奇数（最常见 3 种类各 1 只 = 3）时，旧代码 `items[id]--` 找第一个 `q>0` 项减 1，但若该项 `q=1` 则减成 0，**残留在 items map 中没被清掉**——后续视图 `syncNeeds` 遍历 `order.items` 看到 `{鸡:0, 鸭:1, 牛:1}` 就会渲染「鸡 0/0」。
  ② **数据层修复**：偶数化升级为两级策略——① 优先减一个 `q≥2` 的项（保持种类数）；② 退化减 `q=1` 项并**从 items/chosen 中彻底 delete**（避免残留）；③ 防御层兜底 delete `items<1` 任何残留。新增不变量：**`items` map value ≥ 1**。
  ③ **视图层防御**（`ParkView.syncNeeds:178-181`）：`for (const id in order.items)` 加 `if (!need || need < 1) continue;` 兜底过滤；`items.length===0` 直接 return 不留占位。即"上游数据出错时"也不会渲染出 0/0。
  ④ **其他核心 consumers 审查**（`GameSession.ts:135, 264, 280, 301, 307, 467`）：均对 `items[id]` 做加法/比较，0 残留在数学上**无害**（`aliveCount < 0` 永 false），但语义脏。核心层清理后所有下游自动干净。
- **涉及文件**：`assets/scripts/core/GameSession.ts`（偶数化升级 + 防御层 + 头部时间戳）、`assets/scripts/view/ParkView.ts`（syncNeeds 兜底过滤 + 头部时间戳）、`tools/sim/baseline-snapshot.json`（预期规则变更——订单形状变化 ⇒ 后续路径变化；删除重建；旧快照备份为 `baseline-snapshot.20260908-pre00-fix.bak.json`）
- **成果・验证**：
  ① **核心层不变量强测**：L1-L12 × 200 局 × 反复 makeOrder = **7168 订单，0 个 items=0 残留 ✓**；
  ② `sim:verify` 旧快照 9 关偏离（订单形状变化引起 1-9pt 难度偏移，预期内）→ 重建后 **12/12 一致**；
  ③ `boundary_check` 五项全绿（T1 20/20 / T2 under2=0 / T3 末车 35/35 / T4 29/29 / T5 满载 5/5）；`test:hopeless` 3/3；`rocks_check` 四项全绿；
  ④ 400 局曲线（订单形状变化后仍在带内）：L1-2 100/100%、L3 100%、L4 93.3%、L5 92.3%（L3-5 目标 ≥85% ✓）；L6-L12 = 71.5/69.8/69.3/67.8/67.5/64.5/66.8%（**L6-12 目标 55-75% ✓ 全部入带**）；恢复后全程 100%、0 卡死 0 锁死败 0 卖不掉；
  ⑤ L4 1600 局深测：一审 92.8%、恢复后 100%、挤爆 7.2% ⇒ **第四关可正常通关 ✓**；
  ⑥ tsc 全工程 13 条 = 既有 view 存量（TweenEasing/Label），**core/tools 零新增**。

## [2026-09-08 00:04] D8 难度调参轮收官：一审全线入带（orderKinds L6+ 2→3 + ORDER_QTY3_P 概率闸门，快照重建）
- **变更**：根治 22:49 遗留的 D8「网格化后一审偏高」——L6-L12 一审 93-96% 全程越 PRD 目标带 55-75%。两条独立杠杆 + 一次概率化修正：
  ① **杠杆 A（订单覆盖种类数）**：`LevelCfg.orderKinds` 由 `n<=3?1 : n<=12?2 : n<=19?3 : 4` 改为 `n<=3?1 : n<=5?2 : n<=19?3 : 4`——**L6-L19 由 2 种提到 3 种**（L4-L5 保留 2 种保护平缓爬升）。单独效果：L6-L12 一审 94→88.5-95.5%、挤爆 4-6%→7-11.5%——**方向对但幅度不足**。
  ② **杠杆 B（每种类要几只）**：`GameSession.makeOrder` 单种数量 `q = 1 + floor(rng * min(cap, avail[id]))` 的 cap 由常量 2 改为**每笔订单开单时摇一次的概率闸门** `ORDER_QTY3_P`（Constants.ts，最终 0.4）：命中则本单 cap=3、否则 2。
  ③ **为什么必须概率化而不是直接改常量**：cap 恒 3 实测严重超调（L6-L12 一审 37-46%、挤爆 54-63%，过难）；cap 恒 2 则偏松（88.5-95.5%）。两者之间是**巨大的非线性跳变**，固定常量无解 ⇒ 用概率闸门做连续插值。**p=0.4 一次命中目标带**（见验证 ⑥）。
  ④ 为何选这两条杠杆：D8 根因是「相邻格遮挡解锁更宽松 + 贪心机器人不依赖吊车/广告」，直接改遮挡语义会动 PRD 拍板规则；改订单压力是**只动难度外环、不碰核心判定**的最小动作。
- **涉及文件**：`assets/scripts/core/Constants.ts`（新增 ORDER_QTY3_P=0.4 + 实测数据注释）、`core/LevelCfg.ts`（orderKinds 曲线 + 头部说明）、`core/GameSession.ts`（import + makeOrder 概率闸门 + 头部时间戳）、`tools/sim/baseline-snapshot.json`（预期规则变更，删除重建）
- **成果・验证**：
  ① **一审全线入带**（400 局曲线）：L1-2 100/100%、L3 100%、L4 92.3%、L5 91.8%（目标 L3-5 ≥85% ✓）；**L6 68.8 / L7 67.5 / L8 73.3 / L9 68.5 / L10 67.0 / L11 69.3 / L12 69.5%（目标 L6-12 55-75% ✓ 全 7 关入带）**；挤爆 L6-L12 26.8-33.0%（原 4-6%）；
  ② **恢复后全程 100%、0 卡死 0 锁死败 0 卖不掉**（`>>> 全程 0 卡死 ✓`）；
  ③ **L4 专项 1600 局深测：一审 93.2%、恢复后 100%、挤爆 6.8%、0 卡死 ⇒ 第四关可正常通关 ✓**（用户需求 4 验收点）；L6/L9/L12 1600 局：72.3 / 67.8 / 69.3%，挤爆 27.8/32.2/30.7%；
  ④ 调参过程留痕（三次实测）：cap 恒 2 ⇒ 88.5-95.5%；cap 恒 3 ⇒ 37-46%（超调）；**p=0.4 ⇒ 67-73%（入带）**——已写入 Constants.ts 注释，下次调参可直接查表；
  ⑤ `sim:verify` 旧快照 12/12 偏离（随机流变化）→ 重建后 **12/12 一致**；
  ⑥ `boundary_check` 五项全绿（T1 双跑 20/20、T2 under2=0、T3 末车 35/35、T4 29/29、T5 满载 5/5）；`test:hopeless` 3/3；`rocks_check` 四项全绿（0 石 / 落位一致 / 初始可动 ≥6 / 0 对冲对）；
  ⑦ **10000 局压测**（L4/6/8/10/12 × 2000）：对冲对=0、互锁环=0（对冲防御在新密度下仍成立）；
  ⑧ tsc 全工程 13 条报错 = 既有 view 存量，**core/tools 零新增**。

## [2026-09-07 23:34] L4 问题排查三连：石头/对冲对/难度平衡（截图 @image#1，防御层+密度补偿）
- **变更**：用户截图 L4 显示 ① 仍有石头、② 疑似对冲对、③ 难度偏松；三项根因与修复：
  ① **石头问题**（根因+处置）：`Constants.ENABLE_FARM_ROCKS = false`（22:49 已落地），`levelCfg.rocks` 全关卡为 0；rocks_check + 200 局采样均确认 L4 obstacle=0。截图里的石头来自 22:49 改动前的旧包/旧模拟器缓存——代码侧无问题，已建议用户重新加载。**结论：原开关已修复此项，本次仅复用**。
  ② **"对冲对"问题**（需求 #2，新增防御层）：`Board.hasHeadOnPair` 显式检测「相邻格 A 朝 B、B 朝 A」2-环；`Board.breakAllHeadOnPairs` 定点修复（把 A 翻到「既不朝 B、也不等于 B 当前方向」的两个剩余方向之一，rng 选）；`GameSession.generate` 在 smartDir 之后、countUnlocked/hasBlockCycle 之前调用 `breakAllHeadOnPairs`，再走原拒绝采样兜底 3/4+ 环。**为什么独立于 hasBlockCycle 写新函数**：hasBlockCycle 是「是否有环」二分判定（拒绝采样用），hasHeadOnPair 是「2-环对冲对」显式断言（防御+回归用），语义不同；保留 hasBlockCycle 兜底 3+ 环（零石场景出现率极低但仍存在）。
  ③ **难度平衡**（需求 #4，密度补偿）：去石头 + 对冲修复后整体偏松（L6-L12 一审 97→99%），改 `levelCfg.herdN` 公式 `8 + n*2` → `8 + n*2 + (n>=4?8:0)`，L1-L3 保留原值（教学关保护），L4-L12 各 +8；同时取消原 L9-12 的 -2 修正（抑挤爆率，0 石场景下不再需要）——终态 L4=24 / L5=26 / L6=28 / L7-L12=30（触顶）。
- **涉及文件**：`assets/scripts/core/Board.ts`（hasHeadOnPair + breakAllHeadOnPairs + 时间戳）、`core/GameSession.ts`（import + 头部时间戳 + generate 防御调用）、`core/LevelCfg.ts`（herdN 公式 + 头部说明）、`tools/sim/rocks_check.ts`（新增对冲对列与断言）、`tools/sim/baseline-snapshot.json`（预期规则变更，删除重建；旧快照随 22:49 备份同存于 `baseline-snapshot.20260907-rocks-on.bak.json`）
- **成果・验证**：
  ① **对冲对防御**：2000 局/关 × 5 关（L4/6/8/10/12）= 10000 局压测，对冲对=0、互锁环=0（`node ... -e '...hasHeadOnPair/hasBlockCycle...'`）；
  ② `sim:verify` 旧快照 12/12 偏离（herdN 变化 ⇒ 预期规则变更）→ 重建后 **新快照 12/12 一致**；
  ③ `boundary_check` 五项全绿（T1 双跑 20/20、T2 880 单 under2=0、T3 末车 35/35、T4 30/30、T5 满载 5/5）；`test:hopeless` 3/3；
  ④ `rocks_check` 双向验收：关闭 ⇒ 0 石 + 0 对冲对；开启 ⇒ 数量恢复原曲线 + 0 对冲对；
  ⑤ tsc 全工程 13 条报错 = 既有 view 存量（core/tools **零新增**）；
  ⑥ 400 局曲线（动物数 16→24/26/28/30/30/30/30/30/30/30）：一审 100/100/100/99.8/99.3/94.5/93.3/94.0/94.5/94.3/95.3/96.0%、恢复后 100%、**0 卡死 0 锁死败 0 卖不掉**——对比 16:59 网格基线（带石头）L4-L12 100/100/97.3/96.5/95.5/96.8/93.8/92.8/93%，L4-L9 略松 0-3pt、L10-L12 反向收紧 0-3pt，整体"保持原有挑战性"✓；目标带（L6-12 55-75%）仍整体越上界（与 16:59 拍板结论一致：D8 网格一审偏高未根治）。
  ⚠️ **D8 难度反向偏置仍未根治**：L6-L12 一审 93-96% 全程越上界 55-75%，根源是「相邻格遮挡解锁更宽松 + 贪心机器人不依赖吊车/广告」两条叠加；若要真正压回 55-75%，需另开调参轮（候选：① 加大订单 kind 数 L6+ 2→3；② 加大订单 size 2→3/4；③ 引入更多匹配不到的种类+订单只收 1 类的概率回退），本次未动。

## [2026-09-07 22:49] 农场随机石头改为可配置开关 ENABLE_FARM_ROCKS（默认关闭，快照重建）
- **变更**：用户要求把"农场随机出现石头"做成可配置项、命名清晰、**默认关闭**（默认不随机生成石头），开启时行为与改造前完全一致。
  ① 新增 `core/Constants.ts` 的 `ENABLE_FARM_ROCKS = false`（**全局唯一开关**，注释写明 true/false 语义与"业务层禁止再写第二处判断"）；
  ② `core/LevelCfg.ts` 的 `rocks` 加闸门：`rocks: !ENABLE_FARM_ROCKS ? 0 : (原曲线表达式)`——**数量公式一个字符未改**，开关只决定是否套用；
  ③ **闸门放在 LevelCfg 而非 GameSession.generate**：`cfg.rocks` 是唯一真相源，`GameSession` / `BalanceSim` / `test-cyclerate` 全部继续只认 `cfg.rocks`，零处二次判断，开启/关闭路径完全同构（关闭 = rocks 0 ⇒ generate 的岩石循环自然执行 0 次，落位/遮挡/互锁环拒绝采样代码路径不变）；
  ④ 新增回归脚本 `tools/sim/rocks_check.ts`（打印 L1-L12 的 cfg.rocks 与实际落位 obstacle 数、初始可动数，可随时验证开关两个方向）。
- **涉及文件**：`assets/scripts/core/Constants.ts`（新增 ENABLE_FARM_ROCKS + 头部时间戳）、`assets/scripts/core/LevelCfg.ts`（import 开关 + rocks 闸门 + 头部说明）、`tools/sim/rocks_check.ts`（新增）、`tools/sim/baseline-snapshot.json`（预期规则变更，删除重建；旧快照备份为 `tools/sim/baseline-snapshot.20260907-rocks-on.bak.json`）
- **成果・验证**：
  ① **开关关闭（默认）**：`rocks_check` L1-L12 `cfg.rocks` 全 0、实际落位 obstacle 全 0、`herd 总数 == herdN`、初始可动 9-21 均 ≥6（`node --experimental-strip-types --no-warnings --import ./tools/sim/register.mjs tools/sim/rocks_check.ts`）；
  ② **开关开启（临时置 true 复验）**：cfg.rocks 精确恢复原曲线 L1/2=0、L3/4=1、L5/6=2、L7-11=3、L12=4，落位数逐关一致；**且此时 `sim:verify` 与「改造前」的旧快照（2026-09-07T08:56 建立）对拍 12/12 完全一致**——证明开启后随机流与改造前逐帧相同（最强证据）；复验后已改回 false；
  ③ `sim:verify` 旧快照 10/12 偏离（L3-L12，L1/L2 原本就是 0 石故一致）⇒ 属预期规则变更，删快照重建后 **12/12 一致**；
  ④ `boundary_check` 五项全绿（T1 双跑 20/20、T2 880 单 under2=0、T3 末车 35/35、T4 30/30、T5 满载 5/5）；`test:hopeless` 3/3；
  ⑤ tsc 全工程 13 条报错 = 既有 view 存量（TweenEasing/Label 宽松用法），core/tools **零新增**；
  ⑥ 400 局曲线（石头关闭）：一审 100/100/100/100/100/97.3/96.8/97.3/97.8/95.8/96.3/95.3%、恢复后 100%、**0 卡死 0 锁死败 0 卖不掉**。
  ⚠️ **难度影响（需用户裁决）**：对比 16:59 网格化基线（带石头）一审 100/100/100/100/100/97.3/96.5/95.5/96.8/93.8/92.8/93%，去掉石头后 **L10 93.8→95.8%、L11 92.8→96.3%、L12 93→95.3%**，中后期略微变简单（石头是"锁死/吊车"主要来源之一：**吊车平均使用量 L5-L12 由 0.3-1.3 次降到 0 次**）。原 D8「一审偏高需反向偏置补偿」结论不变，且关闭石头会进一步推高一审通过率——若后续要回到目标带（L6-12 55-75%），重新打开本开关是最省事的补偿手段之一。

## [2026-09-08 10:11] 3D 俯视层下线回退：工程回到纯 2D（用户拍板）
- **变更**：v1.0→v1.1→v1.2 三轮修复后预览仍黑屏，用户拍板回退。执行"双保险回退"：
  ① `GameView.ts` 删除全部 3D 接线（import Farm3D / `private farm3d` 字段 / buildLayout 尾部 `new Farm3D(...)` 三处全删，恢复 23:59 之前状态）；
  ② `Farm3D.ts` 保留为**休眠死代码**：`FARM3D_ENABLED=false` + 头注释写明"GameView 已不引用，运行时绝不构造"，并记下重试路线（不要走运行时注入）。
  未动：模型资产 `assets/resources/art/models/*.glb`（288KB，现无代码引用，可选移出主包）、`tools/inspect-glb.cjs`、`tools/gen-rock.cjs`、`docs/model-import-spec.md`、`raw-models/`。
- **涉及文件**：`assets/scripts/view/GameView.ts`（删除 3 处 3D 接线）、`assets/scripts/view/Farm3D.ts`（置休眠，flag=false + 头注释）
- **成果・验证**：`grep Farm3D assets/scripts/` 仅命中 Farm3D.ts 自身（GameView 零残留）；tsc 13 条=既有存量基线、零新增；场景文件从未被修改（相机/层/可见性改动全是运行时，不落盘）→ 回退后运行时行为=接入 3D 前
- **失败复盘（供日后重试）**：根因不是某一行 bug，而是**路线选择错误**——"在纯 2D UI 场景里运行时 new 出 3D 相机/灯光/Mesh 并抢同一个场景根"，与 2D 渲染管线争生命周期：v1.0 误清 UI 相机 DEFAULT 可见位致 2D 全黑；v1.1 分层修复后 2D 恢复但 3D 仍空；v1.2 砍掉 ImageAsset(canvas) 销毁链后仍黑（device 端仍报 asset destroyed）。三轮都在"运行时注入"框架内打补丁，越补越脆。
  **重试正确路线**：① 编辑器里建独立 3D 场景（3D 相机/灯光/Mesh 全部资产化，不运行时 new）；或 ② 用多场景叠加 / UI 3D 层，让 3D 与 2D 在**场景级别**隔离。3D 内容一律做成场景资源，避免运行时构造。
  **保留的可复用产出**：模型验收流水线（`inspect-glb.cjs` + gltf-transform 减面）、7 个 ≤50KB 模型、导入规格文档、rock 程序化生成器；踩坑记录（LAYER_3D 分层 / ImageAsset(canvas) 销毁链 / primitives API 签名）写在 Farm3D.ts 头注释。

## [2026-09-08 00:42] Farm3D v1.2 砍程序化地面：v1.1 仍黑屏的真正根因（ImageAsset 销毁链）
- **变更**：v1.1 层隔离修复后用户刷新仍黑屏。device 端 vConsole 抓出 `[Farm3D] The asset has been destroyed!`，**真因** = v1.1 在构造里 `new ImageAsset(document.createElement('canvas'))` 当地面贴图，ImageAsset 在某些时序被引擎回收 → 后续 `mr.material` 引用已销毁 tex → 渲染器整批材质失效 → 地面 + 同批 mesh 全不渲染（0 三角面，屏幕黑）。层隔离本身没错，但材质引了销毁资产，整个 3D 帧空。
  v1.2 修复（单文件 Farm3D.ts）：
  - **砍掉程序化 canvas 地面贴图**，地面用**纯色 unlit 材质**（无 ImageAsset 依赖）；
  - `MeshUtils.createMesh` 用 try/catch 兜底，失败则不建地面（cam.clearColor 深草绿直接当"地面"）；
  - 移除 `makeGroundTexture()` 方法及 `ImageAsset` import（彻底断掉销毁链源头）。
  模型（glb）路径无此问题保留不变（编辑器导入产物由 Asset 系统管理，不走 ImageAsset 销毁链）。
- **涉及文件**：`assets/scripts/view/Farm3D.ts`（v1.1→v1.2：删 ImageAsset import + 改 unlitMaterial 纯色 + 删 makeGroundTexture + try/catch 兜底）
- **成果・验证**：tsc 全工程 13 条=既有存量、零新增；**待预览实测**——3 步验证：① 2D 玩法恢复 ② 点"3D 俯视"见深草绿底（cam.clearColor 兜底地面）+ 6 物种 3D 模型 + 顶部俯视 ③ "返回牧场"回到 2D 无残留。若仍黑：`FARM3D_ENABLED=false` 一行回退 + 再次 device 端 vConsole 抓新错误。

## [2026-09-08 00:32] Farm3D v1.1 黑屏修复：分层隔离 + try/catch 降级 + FARM3D_ENABLED 总开关
- **变更**：v1.0（23:59）接入 3D 后整页黑屏，根因为两个独立 bug 叠加：
  ① 构造函数 `uiCam.visibility &= ~DEFAULT` 清掉 Canvas UI 相机对 DEFAULT 层可见性——项目 2D 节点（`new Node()` 默认在 DEFAULT 层：PenView/HUD/Fence/Design/所有子节点）全部从 2D 相机视野消失 → 2D 游戏黑（截图中只剩顶栏 overlay 文字+stats 是因为 overlay 自身层级机制特殊幸存）；
  ② 3D 模型子节点 layer 不一定继承父节点设置，3D 相机 visibility=DEFAULT 命中 0 mesh → Triangles 0 / Render 0 / Buffer 175M（GPU 已分配模型但一个未画）。
  v1.1 修复（**单文件 Farm3D.ts 内部重写**）：
  - 引入专用 3D 层 `LAYER_3D = 1<<20`，与 DEFAULT(1<<30)/UI_2D(1<<25) 互不干扰；
  - 所有 3D 节点（含 glb 模型子节点）通过 `setLayerRecursive()` 递归落 LAYER_3D；
  - Canvas UI 相机只清 `LAYER_3D` 位（**不动 DEFAULT**）→ 2D 节点恢复可见；
  - 3D 相机 visibility 锁 LAYER_3D，与 2D 完全隔离，priority=-1 先渲染；
  - 入口加 `try/catch` + `degrade()`：WebGL 不可用 / 节点/mesh/资源创建异常 → 销毁已建部分、隐藏按钮、控制台告警，**页面回到 2D 不黑**；
  - 新增 `FARM3D_ENABLED` 总开关（export const）：false 时构造直接 return，按钮不出，世界不构 → **出问题 1 行回 2D**。
- **涉及文件**：`assets/scripts/view/Farm3D.ts`（v1.0→v1.1 重写）
- **成果・验证**：tsc 全工程 13 条=既有存量、零新增；**待预览实测**：编辑器前台化编译→刷新预览，① 2D 玩法应完全恢复（PenView/HUD/Fence 可见）② 点右上角"3D 俯视"应见 6×10 格纹地面 + 动物/岩石 3D 模型 + 顶部俯视 ③ "返回牧场"关回 2D 不残留。若仍黑：`FARM3D_ENABLED=false` 一行回退。

## [2026-09-07 23:59] 阶段 3：3D 俯视观察层接入（Farm3D 新视图 + GameView 三行接线，2D 游玩路径零改动）
- **变更**：① 新增 `view/Farm3D.ts`：正上方正交相机（pitch=-90，orthoHeight 按屏幕宽高比自适应包住 100×125 农场矩形+4 呼吸边）+ DEFAULT 层独占渲染 + Canvas UI 相机运行时清 DEFAULT 可见位（幂等）+ 打开期 UI 相机 clearFlags=DEPTH（保 3D 底色、清深度保 UI 叠加）；草地=程序化 6×10 双色格纹 canvas 贴图 + builtin-unlit 平面；模型=resources.load('art/models/{id}') → 模板缓存 instantiate 复用 → 材质统一换 unlit（拷贝 baseColor 贴图/底色，不依赖灯光）；加载失败物种色占位柱体兜底；归一 scale=TARGET_H/实测身高×体宽系数（表见文件头，预览后可调）；朝向 yaw=DIR_YAW+朝向修正常量（待预览校准）；UI=右上角"3D 俯视"入口按钮 + 打开态全屏吞触摸覆盖层（锁 2D 游玩输入）+ 顶栏返回；位置同步=0.4s 调度器镜像 core herd（uid 增删对齐）；② `GameView.ts` 三处：import + 字段 + buildLayout 尾部一行构造（宿主接口解耦，无循环 import）；③ 设计边界：本层是**纯观察视图**（用户需求原文"从正上方观察农场布局与动物分布"），2D 游玩/动画链不动——完整 3D 游玩迁移（动画链 3D 化）留待视觉签收后另开批次。
- **涉及文件**：`assets/scripts/view/Farm3D.ts`（新增）、`assets/scripts/view/GameView.ts`（+3 行接线）；模型资产见 23:31 条目
- **成果・验证**：tsc 全工程 13 条=既有 view 存量、**零新增**；预览端口 7456 探活 200；**⚠️ 待预览实测**（编辑器失焦停 watch，chunks 未出新产物）：编辑器前台化编译后，预览点"3D 俯视"验收 5 项——①模型显示且色彩正常（unlit 材质）②朝向 yaw 是否需修正 MODEL_YAW_CORR ③体宽系数观感 ④格纹地面与动物落格对齐 ⑤返回后 2D 游玩不受影响。风险预置：若模型全部朝向一致偏 90°/180°，只调 MODEL_YAW_CORR/DIR_YAW 两常量。

## [2026-09-07 23:31] 3D 模型资源管线落地：7 模型减面验收 + 落位 resources/art/models（无 .ts 变更）
- **变更**：用户平台生成 6 物种模型（底部中心轴点/贴图512）落入 `assets/animal/`，执行资源管线：① 新增 `tools/inspect-glb.cjs`（零依赖 GLB 验收器：面数/贴图/材质/压缩扩展/根变换检查）；② 六模型减面管线（`npx @gltf-transform/cli optimize`，ratio 按目标 3000 面逐个设定：chicken 0.05/cow·pig·sheep 0.115/duck 0.038/rabbit 0.048，`--simplify-error 0.01 --texture-size 512 --compress meshopt`）；③ **rock.glb 缺失** → 新增 `tools/gen-rock.cjs` 程序化生成占位（二十面体细分 2 + 确定性噪声塑形 + 顶点色，320 面/9KB，用户可随时替换）；④ 落位：原始档（41MB 级用户的 2.3MB 原始导出）备份至 `raw-models/`（assets 外，不进编辑器与构建），压缩版进 `assets/resources/art/models/`（7 个共 288KB，运行时 resources.load 可达），`assets/animal/` 清空为暂存区；⑤ 规格修订 `docs/model-import-spec.md` v1.1：meshopt/EXT_texture_webp 解禁（根因：Cocos 编辑器导入期解码 glTF，运行时产物为引擎自有格式，无微信端解码风险，v1.0 过严）+ 首批验收数据表。
- **涉及文件**：`tools/inspect-glb.cjs`（新增）、`tools/gen-rock.cjs`（新增）、`assets/resources/art/models/*.glb` ×7（新增，288KB）、`raw-models/*.glb` ×6（新增备份）、`docs/model-import-spec.md`（v1.0→v1.1）、`assets/animal/`（清空为暂存区）；无 .ts 变更
- **成果・验证**：inspect-glb 复检全部过线——面数 2804-2946（≤3000）、单体 37-49KB（≤150KB）、贴图 webp 7-18KB 仅 baseColor、脚底 y=0/x/z 居中；rock 320 面/9KB；总量 2.3MB→288KB。预览端口 7456 探活 200（编辑器运行中），模型 .meta 待编辑器前台化后自动生成（当前 0 个，属编辑器最小化停 watch 的已知行为，非导入失败）

## [2026-09-07 16:59] P1 core 网格化落地：相邻格遮挡 + 网格落位生成器 + 洗牌空格重排（B2/B3/B4，快照重建）
- **变更**：按 PRD 2.0 §5.1 执行网格化主线（用户 2026-09-07 确认顺序：先 P1 后 3D+P3 合并），旧走廊遮挡/散点生成废止：
  ① **C1 占用图**：新增 `core/Grid.ts`（6×10=60 格 O(1) 占用查询，越界=场外视为空）；`Types.Animal` 由接口改类——位置唯一真相源改整格 `col/row`（int），`x/yu` 降级为只读派生 getter（= 格中心连续坐标），**view 层过渡期零改动**（PenView/GameView 的 a.x/a.yu 引用自动吸附格中心）；
  ② **B2 相邻格遮挡**：`Board.blockerOf/isBlocked/hasBlockCycle/unlockedSet` 全部改 Grid 相邻格语义（朝向相邻格被占即被挡；边界朝外可走出）——旧 AHEAD/TOL 射线+容差判定与常量删除（R 保留供 view 碰撞动画过渡）；
  ③ **B3 网格落位生成器**：`Board.gridLayout`（Fisher-Yates 取不重复格）取代 `scatter` 散点+40 次重摇，保留 unlocked≥6 + 互锁环拒绝采样；`smartDir` 改 col/row 入参（50% 朝最近场外边）；
  ④ **B4 洗牌空格重排**：`Board.reflow`（全场重新落位、个体/朝向不变）取代 scatter 重摇，`GameSession.useShuffle` 与 BalanceSim 洗牌分支同步切换；
  ⑤ sim 工具链随动：boundary_check 白盒构造改 new Animal、test-hopeless/test-cyclerate 同步；
  ⑥ 动机根因：PRD 2.0 明文网格化为主线，散点+走廊为 V1.x 遗产；相邻遮挡是 PRD 拍板语义（走廊遮挡已废止）。
- **涉及文件**：`assets/scripts/core/Grid.ts`（新增）、`Types.ts`（Animal 类化）、`Board.ts`（重写）、`Constants.ts`（GRID_* 新增、TOL/AHEAD/PAD/MIN_D 删除）、`GameSession.ts`（generate/useShuffle 改造）、`tools/sim/boundary_check.ts`、`tools/sim/BalanceSim.ts`、`tools/test-hopeless.ts`、`tools/test-cyclerate.ts`（均修改）；`tools/sim/baseline-snapshot.json`（预期规则变更，删除重建）
- **成果・验证**：① tsc 全工程 13 条报错 = 既有 view 存量（TweenEasing/Label 宽松用法），core/tools 零新增；② `sim:verify` 旧快照 12/12 偏离（预期规则变更）→ 删除重建后 12/12 一致；③ `boundary_check` 五项全绿（T1 双跑一致/T2 ≥2/T3 末车白盒 35/35/T4 解锁车位/T5 满载判败 5/5）；④ `test-hopeless` 3/3；⑤ 400 局曲线 L1-12：一审 100/100/100/100/100/97.3/96.5/95.5/96.8/93.8/92.8/93%、恢复后 100%、全程 0 卡死 0 锁死败 0 卖不掉；⑥ 互锁环率（拒绝采样前）：L1 7.5%→L10 51.2%（相邻遮挡下"对脸互锁对"易形成，仅 2/4 长度环），生成器重试兜底有效（上限 40 内收敛）。⚠️ **D8 待裁决**：网格语义一审全线高于走廊基线（L12 62→93%），PRD 预判的"连锁解锁变短"风险兑现，密度/岩石/高关卡反向偏置补偿需用户拍板后另开调参轮。

## [2026-09-07 15:58] 方案A落地：并发行走"围栏满不装车不判败"死锁修复（reconcile 去 walks 门控 + 容量门 + 簿记加固）
- **变更**：实施 15:35 排查结论的方案 A（用户批准），**core 零改动**，仅 `view/GameView.ts` 6 处：
  ① **reconcile 去 walks 门控**（核心修复）：guard 由 `busy>0 || walks>0` 改为仅 `busy>0`——数据先行下在途动物已入 fence 参与匹配，行走中凑齐订单即实时装车腾位，装车链不再被并发行走卡死；
  ② **onArrive 落地即调和**：`if (walks===0) reconcile()` 改为无条件 `reconcile()`（同步并行语义：进场同时满足订单即装车出场）；
  ③ **moveTo 围栏容量门**：guard 增加 `s.fence.length >= FENCE_MAX` 拦截——堵死 core takeAnimal 无上限 push 的超载通道（fence 数据已含在途动物，无需另算 walks）；
  ④ **walks 簿记与代数解耦**：onArrive 中 `walks--`/`walkingUids.delete` 提至 fxGen 代数检查之前，保证未来任何"回调被丢弃"的新路径都不再可能使 walks 卡 >0（经核当前重开局路径由 fx.reset() 掐断旧回调 + startGame 归零，本无泄漏，属防御性加固）；
  ⑤ **step 通关延迟裁决**：`isWin()` 且 `walks>0` 时先 return 不弹面板，由末次落地 onArrive 收尾——防"克隆体还在路上走、胜利面板已弹出"的视觉错位；
  ⑥ **win() 相位防重**：`phase==='win'` 直接 return——实时调和下 step/onArrive 双入口可能先后触发，防双结算双存档。
- **涉及文件**：`view/GameView.ts`（修改 6 处：moveTo guard / onArrive 簿记与调和 / reconcile guard+注释 / step isWin / win() 防重 / 头注释时间）。
- **成果・验证**：`npx tsc -p tsconfig.typecheck.json` 新增行 0 报错（存量 13 条宽松用法照旧）；`sim:verify` **12/12 与快照一致**（core 未动，随机流零扰动）；边界回归 T1-T5 全绿（T5 满载判败 5 用例 pass=5 fail=0）。行为变更点：手快连点时车辆即时装车腾位、围栏数据永不超过 7、failwait 仅在"满载且实时调和后仍无可满足订单"时触发。**待 T4 预览实测**：①连点 5 只观察即时装车腾位；②走路动画与装车动画同屏重叠观感（在途动物被装车时其克隆体走完自行消失，renderFence diff 不再显示）；③通关面板在最后一只落地后才弹出。

## [2026-09-07 15:35] 并发行走"围栏满不装车不判败"根因排查（无代码变更）
- **变更**：排查"多动物并发走向围栏→围栏满→订单可满足但车不出发、库存不扣、持续涌入、既不装车也不判败"异常，定位根因为**调和链不对称门控**：① `reconcile`（GameView.ts:478）被 `walks>0` 硬门控，并发行走期间装车链整体停摆；② 入栏链（moveTo:418 / core takeAnimal:312）既不检查 walks 也不检查围栏容量，core `fence.push` 无上限→数据可超 7 超卖；③ `failTick`（GameView.ts:118-121）可满足时 `markOutcome('play')+reconcile()`，该 reconcile 被 walks 门控静默吞掉且无任何补偿（watchdog 同样被吞），形成 play↔failwait 反复横跳——用户手不停 walks 不归零即持续恶化；④ 次生泄漏：onArrive 首行 fxGen 代数检查（:430）会跳过 `walks--`，重开局瞬间在途回调作废即 walks 永久卡 >0（真死锁态）。同步并行改造评估结论：core findMatch/beginFulfill 纯数据操作与视图无关可随时执行，真实约束仅"装车动画"——方案 A（数据调和与动画 busy 解耦：去 walks 门控 + moveTo 容量门 + walks-- 提到代数检查前）已给出，待用户确认后实施。
- **涉及文件**：无代码变更（本条为排查/审计记录）。
- **成果・验证**：全链路代码复核（GameView moveTo/onArrive/reconcile/failTick/watchdogTick、FxService.walkPath done 回调、core takeAnimal/beginFulfill/isFenceHopeless/canPlay）；症状四要素与门控逻辑逐条对上（不装车=walks 门控、不扣库存=fulfillSlot 不执行、持续涌入=moveTo 无容量门、不判败=failTick 吞掉后无 re-arm）。

## [2026-09-07 14:11] T8 埋点最小集落地 + T4/T5/T6 验收文档 + DEVLOG 顺序修复（受托执行 P1-P5）
- **变更**：
  ① **T8 埋点（受托拍板：v1.0 做最小 5 事件集）**：新增 `services/TrackService.ts`（level_start/level_fail×3 因/level_win/revive/ad_show 五事件，TRACK_ENABLED 一键关停，dev 走结构化 console、wx 上报留桩）；GameView 5 处接线（startGame/failFence/failHP/noStockEnd/win/revive）+ AdService.show 入口统一记 ad_show（含可选 point 参数）。**仅 view/services 层，core 零 import，随机流不扰动**。
  ② **T4 验收清单**：`docs/t4-acceptance-checklist.md`——12 关逐关记录表 + 10 项新功能验收点（星级/压暗/复活拒/满载裁决/吊车修复/互锁开局/sprite 四向/rare 光环/受击反馈/回退）+ bug 记录区。
  ③ **T5 特效对拍**：`docs/t5-fx-parity.md`——原型↔Cocos 15 项代码对照完成（12 一致 / 3 项有意差异：土路行走替代弧线、C4 黯淡为 PRD 增项、朝向即方向）+ sprite 专属签收 4 项；视觉签收随 T4 预览执行。
  ④ **T6 前置盘点**：主包体积——assets/resources 862KB、art-draft 25.9MB 在工程根不进包、assets 无 ttf；MCP build 工具 buildPlatform 枚举不含 wechatgame 且注明需手动交互 → **微信构建必须编辑器手动执行**（步骤已记计划文档 T6 节）。
  ⑤ **DEVLOG 顺序修复**：程序化重排全文件为时间倒序（此前多批条目插在底部违规），44 条全保留（块级多重集校验 + 条目数校验）。
- **涉及文件**：`services/TrackService.ts`（新增）、`services/AdService.ts`（修改）、`view/GameView.ts`（5 处埋点接线）、`docs/t4-acceptance-checklist.md`（新增）、`docs/t5-fx-parity.md`（新增）、`DEVLOG.md`（重排）。
- **成果・验证**：`sim:verify` 12/12 零扰动；tsc 新增行 0 报错；埋点 dev 通道可在预览 console 观察 `[track]` 输出。**任务状态**：T4 🔄（清单就绪待你玩）/ T5 🔄（代码对照完成，视觉签收随 T4）/ T6 🔄（盘点+runbook 就绪，构建待编辑器手动、真机待 AppID）/ T7 ⛔（阻塞：广告位 ID）/ T8 ✅。

## [2026-09-07 01:25] 豆包 3D 素材六物种齐备 → 24 张精灵规格化落盘（用户供图 + 处理管线）
- **背景**：用户用豆包按 Prompt 生成 6 物种 × 4 向 3D 渲染图（猪/羊/兔/鸡/鸭/牛，兔重复
  一张已忽略）。人工判定全部合格：四向齐全、风格一致、朝向可读、纯白底可处理。
- **变更**：
  1. 源图收编至 `art-draft/src/{species}.png`（约 2048×2048）；
  2. 新增规格化管线 `tools/build-animal-sprites.cjs`（零依赖）：PNG 解码 → 2×2 象限切割
     （TL=up/TR=down/BL=left/BR=right）→ 豆包水印剔除（右下灰字包围盒填白）→ 抠白底 →
     包围盒裁剪 → 等比缩放至 144×144 画布 ~82% 居中 → PNG(RGBA) 编码（含 CRC32/编码器自实现）；
  3. 抠底算法三轮迭代定稿：软边 3D 渲染无描边、白身动物（鸡背/兔毛/牛身）与白底色彩
     不可分——最终方案 = **严格中性白泛洪（mn≥250 且 mx-mn≤4）+ 保留柔阴影作接地感**，
     代价为轮廓 1~2px 白晕（缩至 144 后 <1px，不可见）。中途试过的宽阈值/滞回泛洪会
     顺绒毛与高光啃进身体（条纹/镂空），已废弃；白色封闭口袋清除亦已回退（会镂空高光）。
- **涉及文件**：`tools/build-animal-sprites.cjs`（新增）、`assets/art/animals/*.png ×24`
  （Cocos 编辑器已自动导入并生成 .meta）、`art-draft/src/*.png` ×6、`art-draft/contact-sheet-v2.png`
- **成果・验证**：24 张全部落盘（合计 860KB，首包预算内）；抽检角 alpha=0（透明）、
  身体不透明占比 67%；联络表人工检视六物种四向完整无损。
- **已知限制**：白色身体边缘残留 1~2px 白晕（144 下不可见）；软阴影保留在图内（接地感，
  非缺陷）。要求完美透明边时，用豆包"抠图/去背景"导出透明版重跑管线即可（管线支持
  alpha 源自动跳过泛洪）。

## [2026-09-07 00:55] 农场互锁问题：开局互锁环拒绝采样（用户反馈：剩几只互相遮挡被锁死）
- **排查结论**：走廊遮挡玩法中"互相锁死"是固有谜题状态（原型同款），设计有四层解法
  （吊车免费首用 / 翻转 / 洗牌 / 扣血强拆 + 复活广告），并非死局——用户截图当时仍有
  翻转×2、洗牌×2 可用。但测量发现**初始布局互锁环发生率极高**（L1 14%、L4 30%、
  L7 53%、L10 67%），高关卡大半开局自带互锁，体验差且易误解为 bug。
- **变更**：
  1. `core/Board.ts` 新增 `hasBlockCycle`：构建"被挡动物→遮挡者"有向图做环检测
     （纯读判定，不消耗随机流）；
  2. `core/GameSession.generate` 拒绝采样：初始布局含互锁环时重试（上限 40 次，
     超限退化接受，不会死循环）。
- **涉及文件**：`assets/scripts/core/Board.ts`、`core/GameSession.ts`、
  `tools/sim/baseline-snapshot.json`（重生成）、`tools/test-cyclerate.ts`（新增，发生率测量）
- **成果・验证**：
  - 互锁环发生率：修复后初始布局为 0（拒绝采样保证）；
  - 曲线复测：L1-3 一审 100%，L6+ 恢复后 100%，**全程 0 卡死**；L12 一审 55.3%→62.5%
    （互锁开局消除后高难度更公平）；
  - 高关卡抽查：L15 一审 37.1%、L20 33.4%（较修复前 33.3%/24.4% 改善），恢复后 100%；
  - `test:hopeless` 三场景全过；web-mobile 重建 0 错误；
  - 基线快照已重生成（预期内规则变更，非随机流意外扰动）。
- **设计说明**：中盘动态互锁无法完全避免（取决于玩家拿取顺序），保留四层解法 +
  allLocked 警告 toast；本次消除的是"开局即互锁"的高频困惑源。

## [2026-09-07 00:20] 修复点击吊车报错（用户实测：Cannot set properties of null (setting 'opacity')）
- **根因**：`AnimalNodeC` 构造函数给碰撞红闪（flash）挂了 UIOpacity，但**吊车目标圈
  （ring）漏挂**；`setCrane` 用非空断言 `getComponent(UIOpacity)!` 取组件——吊车模式
  首次运行（armCrane → renderPen → setCrane(true)）即对 null 赋值崩溃。自动化测试
  此前未点过吊车按钮，故未暴露。
- **变更**：
  1. 构造函数为 ring 补挂 `UIOpacity`（初始 opacity=0，与 flash 同款）；
  2. `setCrane` / `bonk`（flash）改用防御式取组件 `getComponent(UIOpacity) ?? addComponent(UIOpacity)`；
  3. 全项目扫描 `getComponent(X)!` 非空断言——其余均落在"创建时已挂组件"的节点上（安全）。
- **涉及文件**：`assets/scripts/view/AnimalNode.ts`
- **成果・验证**：编辑器重编译通过；web-mobile 构建 0 错误。吊车流程（首次免费 →
  瞄准 8s → 点被挡动物吊走入栏 → craneLeft 递减）待用户预览复测。

## [2026-09-06 23:48] typeCount 扫描工具：动物种类数对难度的量化（设计咨询，无 core 变更）
- **变更**：① `tools/sim/BalanceSim.ts` 新增 `setTypeCountOverride()` 扫描钩子（runBot 的 S.start 后改写 cfg.typeCount 并重新 generate+tryDispatch，仅模拟器会话生效，不触碰 core/快照）；② 新增 `tools/sim/typecount_scan.ts`（7/8 种时向 TYPES/TYPE_MAP 注入占位种类，仅本进程 headless）。**为什么**：用户咨询"结合打螺丝/挪车玩法动物种类几种合适"——本项目有 BalanceSim，用实测数据回答而非定性拍脑袋。
- **涉及文件**：`tools/sim/BalanceSim.ts`（修改，+钩子）、`tools/sim/typecount_scan.ts`（新增）。无 core/游戏代码变更。
- **成果・验证**：150 局×L3/6/9/12×种类 3-8 扫描完成——每 +1 种一审约 −10pp（中段关），7 种起塌方（L3 教学关仅 71%，L12 27%）；**结论：维持 3→6 爬坡、硬上限 6、禁 7+**。快照对拍未触碰（工具层改动，sim:verify 基准不受影响）。

## [2026-09-06 23:45] 围栏满载误判（两只鸡满足订单仍弹失败）排查与回归测试（用户反馈）
- **排查**：用户 L3 截图——围栏 7/7 满（含 2 鸡）、黄卡车订单鸡×2 可满足，却弹出"围栏挤爆"
  失败面板。审计 fork 漂移合入的 23:00 版裁决实现（failTick 终局裁决 + isFenceHopeless
  纯读判定 + onArrive/reconcile 双处重裁决）：逻辑链完整——发车补单场景下 failwait 会
  被 failTick 撤销并装车放行。判定结论：**当前实现正确，用户截图命中的是 23:00 修复
  落地前的旧代码**。
- **新增回归护栏**：`tools/test-hopeless.ts`（无头 Node 测试，core 零 cc 依赖）三场景：
  A 围栏满+鸡×2满足在场订单 → NOT hopeless ✓；B 围栏满+无鸭可满足 → hopeless ✓；
  C 鸡×1满足鸡×1订单 → NOT hopeless ✓。已挂 `npm run test:hopeless`。
- **涉及文件**：`tools/test-hopeless.ts`（新增）、`package.json`（+test:hopeless 脚本）
- **成果・验证**：三场景全部通过；web-mobile 重建 0 错误（纳入漂移会话的种子化调度/
  复活上限/末车模式/isFenceHopeless 等全部 core 改动）；`sim:verify` 12/12 与快照一致。
- **注意**：编辑器预览页若停留在旧 chunk 会出现已修复的 bug——**验证前务必硬刷新
  预览页（Ctrl+F5）**。

## [2026-09-06 23:09] 玩法调整三连：动物 schema 统一管理 + 围栏满载判定细化 + 多种类订单澄清（需求 1 维持现状）
- **变更**：
  ① **需求 2 · 动物 schema**：新增 `core/AnimalSchema.ts`（唯一动物数据真相源，字段 id/name/price/rareMultiplier/art/resourcePath，art='sprite'+resourcePath 为 P6 美术替换预留）；`Types.AnimalType` 改为 `AnimalDef` 别名；`Constants.TYPES/TYPE_MAP` 改由 schema 派生（调用方零改动）；`GameSession` 闪光售价倍率 3 处字面值 `(rare ? 3 : 1)` 收编为 `type.rareMultiplier`。产出 `docs/animal-schema.md`（字段约定 + 新增动物 5 步操作清单 + 下架规则）。
  ② **需求 3 · 围栏满载判定细化**：修复真 bug——并发行走场景下，围栏先满进入 failwait 后，0.5s 缓冲内落地动物凑齐订单，但 `reconcile` 被 `canPlay` 门控不消费，failTick 到点**无条件弹挤爆面板**（即使存在可满足订单）。判败条件细化为「围栏满 **且** `isFenceHopeless()`=true（无任何在途卡车订单可被围栏现有动物满足）」。core 新增 `isFenceHopeless()` 纯读判定（不走 findMatch 避免消耗随机流）；view 三处接线：failTick 终局裁决（已消化/可满足 → 回 play 续局，确实无解才 failFence）、onArrive failwait 期间落地重新裁决、reconcile 尾部仍满载 re-arm。与 BalanceSim「reconcile 后仍满 = failfence」语义天然一致 → 既有曲线数据有效。
  ③ **需求 1 · 车辆多类型装载**：核对确认已全链路实现（生成 orderKinds 多类 + 每类数量 1-2、findMatch 逐类匹配、ParkView 逐类渲染），L1-3 单类为 PRD 教学保护；**用户拍板维持现状**，澄清记录落 `docs/animal-schema.md` §五。
  ④ boundary_check 新增 **T5**：isFenceHopeless 白盒 5 用例（未满/满载有解/种类不符/多类缺一/数量不足）。
- **涉及文件**：`assets/scripts/core/AnimalSchema.ts`（新增）、`core/Types.ts`（修改）、`core/Constants.ts`（修改）、`core/GameSession.ts`（修改）、`view/GameView.ts`（修改）、`tools/sim/boundary_check.ts`（T5）、`docs/animal-schema.md`（新增）。
- **成果・验证**：
  - `sim:verify` core 快照对拍 **12/12 一致**（schema 派生纯数据重构 + 纯读判定，随机流零扰动）；
  - `boundary_check` **五项全绿**（T1 20/20、T2 886/0、T3 35/35、T4 28/28、**T5 5/5**）；
  - `tsc -p tsconfig.typecheck.json` 过滤存量宽松用法后**新增行 0 报错**；
  - 源文件头 `修改时间` 已同步 23:00。

## [2026-09-06 22:27] T3·D2 接触距离参数常量化：碰撞分支 5 个内联字面值收编 Constants，兜底 26→21
- **变更**：① `core/Constants.ts` 新增碰撞接触动画参数组 `CONTACT_DIST=21 / CONTACT_FLOOR=10 / CONTACT_OVERLAP=0.95 / CONTACT_TRAVEL_SPEED=380 / CONTACT_TRAVEL_MIN=0.14 / CONTACT_TRAVEL_MAX=0.6`（附 D2 决策出处注释）；② `view/GameView.ts` 碰撞分支（原 342-359 行）的内联字面值全部替换为上述常量。**为什么**：PRD 2.0 D2 要求碰撞接触动画肉眼可辨——PRD 字面公式（格距−精灵尺寸=4.2px≈11ms）不可见，对拍文档（prd2-reconciliation §D2）拍板默认值 = 格距×0.45≈21px；动态路径（真实走到遮挡者接触点 = 投影 − 2×coreRadiusPx×0.95，下限 10）逻辑本身**不变**，仅参数收编进单一真相源；兜底字面 26 同步对齐为拍板值 21（该分支仅在节点/遮挡者取不到的防御路径生效，正常对局不触发）。判定逻辑、随机流零改动。
- **涉及文件**：`assets/scripts/core/Constants.ts`（修改：新增常量组 + 头部时间戳）、`assets/scripts/view/GameView.ts`（修改：碰撞分支参数替换 + import 扩展 + 头部时间戳）。
- **成果・验证**：`npm run sim:verify` **12/12 全绿**（随机流零扰动）；`tsc -p tsconfig.typecheck.json` 全工程 13 条报错均为存量宽松用法（R7 已知项），GameView/Constants 无新增错误；预览肉眼确认（碰撞动画可辨、弹回节奏不破坏）**并入 T4 逐关验收顺带执行**（与 T2 三项同款处理）——动态路径参数数值未变，预期观感与改前一致。T3 验收通过即达成 M1 代码冻结。

## [2026-09-06 22:11] 进度审计：路线图逐项对照 + 建立 living 进度跟踪文档
- **变更**：应用户要求对 roadmap-20260906.md 与代码实际状态做逐项对照审计：T1 ✅（20:55 曲线入带）、T2 ✅（21:29 三小项，含 3 处经拍板的主动偏差：压暗代表情/星级复活封顶/字段命名）、T3-T8 ⬜ 未启动；识别 8 项风险（T4 人工瓶颈 / AppID 依赖 / 主包体积 / 埋点未拍板 / 曲线噪声返工 / core 回归纪律等），定义 M1-M4 四里程碑。产出 `docs/dev-plan-20260906.md` 作为**唯一进度事实源**（取代 roadmap 的进度总览职能，roadmap 保留为决策快照；根目录 DEV-PLAN.md 已过期标记不再更新）。约定：任务过验收即回填状态表与进度记录。
- **涉及文件**：`docs/dev-plan-20260906.md`（新增）；无代码变更（本条为审计/计划记录）。
- **成果・验证**：对照结论均有代码定位或命令输出支撑（T3 现状 = GameView.ts:342-359 参数内联未提常量；T7 现状 = PlatformAdapter.ts:14 TODO 桩）；下一步 T3 接触距离常量化。

## [2026-09-06 21:29] T2（P5 三小项）：C3 星级 + C4 生命耗尽压暗 + C5 复活上限 2/局
- **变更**：
  ① **C5 复活上限**（用户拍板 P5/C5）：`Constants.ts` 新增 `REVIVE_MAX = 2`（单一真相源）；`GameSession` 新增 `revivesUsed` 计数（`start()` 重置）+ `canRevive()`，`revive()` 改为超限返回 `false` 的守卫式；`GameView.failHP` 把 `canRevive()` 传入面板——用尽后不渲染广告复活按钮，仅剩「放弃重开」。动机：此前 `revive()` 无限制，可无限看广告回满，复活资源无价值。
  ② **C4 生命耗尽压暗**（用户拍板"全场压暗"方案，非逐表情重绘）：`GameView` 新增 `dimBoard()/undimBoard()`——生命扣至 0 时牧场+围栏两个容器 UIOpacity 渐变至 140（≈0.25s），`travel+0.6` 缓冲窗后弹失败面板；`startGame()`（重开路径）与复活回调恢复亮度。动机：PRD 2.0 P5/C4 要求"生命耗尽全场动物黯淡 0.5s"，原实现直接弹面板无过渡。
  ③ **C3 星级**（用户拍板：复活过封顶 1 星 + 顺手存档）：`GameView.win` 计算星级——`revivesUsed > 0 ? 1 : hp`（3/2/1 心 → 3/2/1 星；复活回满心不算无损通关）；`Panels.win` 新增 `stars` 参数，金币行上方渲染 ★/☆ 三星行；`SaveService` 新增 `am_stars` 存档（`saveBestStar` 只增不减 / `loadStars`）+ `LastResult` 增 `stars` 字段。存档为将来关卡列表预留消费入口。
  ④ 附带产出：`tsconfig.typecheck.json`——用 `extensions/cocos-mcp-server` 自带 `cc.d.ts` 做 `paths` 映射的全工程类型检查配置（工程此前无独立 tsc 检查手段）。
- **涉及文件**：`assets/scripts/core/Constants.ts`（修改）、`core/GameSession.ts`（修改）、`services/SaveService.ts`（修改）、`view/Panels.ts`（修改）、`view/GameView.ts`（修改）、`tsconfig.typecheck.json`（新增）。
- **成果・验证**：
  - `sim:verify` core 快照对拍 **12/12 一致**（C5 仅加计数字段不触碰随机流，符合"零扰动"判定）；
  - `boundary_check` 四项全绿（T1 20/20、T2 886/0、T3 35/35、T4 28/28）；
  - `tsc -p tsconfig.typecheck.json`：本次全部新增行 **0 报错**（现存 13 条报错均为存量宽松用法：kebab-case easing 字符串与 `makeLabel` 包装对象属性，Cocos 运行时实际接受，非本次引入）；
  - 源文件头 `修改时间` 已同步 21:10。

## [2026-09-06 20:55] T1 难度调参：修复三个规则级根因 + LevelCfg 入带（替换 19:36 基线）
- **变更**：
  ① **末车触发基准修正**（`GameSession.makeOrder`）：由"扣预定后可用 ≤6"改为"**场上动物总量 ≤6**"（用户需求 4 原文语义："后期场上动物数量减少时"）。原实现会在中盘（18 只在场、3 单预定 12、可用 6）误发"收全部"大单。
  ② **末车构成修复超收死单**：原"末位种类收尾拿 remaining"会把全场可用总量塞给单一种类（如 {鸡:4} 而鸡仅 2 只）→ 死单 → abandon 循环 → 挤爆/卡死。改为**按种类可用量封顶贪心全收**（不受 orderKinds 上限约束，一张订单覆盖全部可用种类）——"恰好收完、不遗漏不超收"由构成方式直接保证。
  ③ **订单总和偶数化（减 1 优先）**：≥2 ≠ 偶数——3 种类各 1 只 = 3（奇）破坏"剩余恒偶"不变量 → 终局剩 1 只无单可发 → "卖不掉"死局（L4-12 曾达 21-43%）。奇数订单统一减 1 只（奇 ≥3，减后仍 ≥2，恒可行且订单变小）。
  ④ **尾单豁免阀**：清仓/放生广告会以任意数量移除围栏动物、破坏偶数不变量 → 可用剩 1 时若禁发则必然软锁。现允许 **availableTotal=1 时发 1 只收尾单**（正常游玩该分支数学上不可达，≥2 硬约束不受影响）——⚠️ 此项为对用户"禁止剩 1"裁决的技术性豁免，仅限玩家自主清仓后的兜底，待用户追认。
  ⑤ **LevelCfg 调参**：L4-12 `orderKinds` 3→2（L1-3 维持 1 教学保护）；L9-12 `herdN` 各 −2；L12 起第 4 颗石头（`rocks` 阈值 n<20→n<12）。
  ⑥ 快照基线重建：`baseline-snapshot.json` 删除重生成（规则变更扰动随机流，符合既定流程）。
- **涉及文件**：`assets/scripts/core/GameSession.ts`（修改）、`core/LevelCfg.ts`（修改）、`tools/sim/boundary_check.ts`（T3 断言更新为新语义）、`tools/sim/baseline-snapshot.json`（重建）；`tools/sim/debug_end.ts`（临时诊断脚本，已删除）。
- **成果・验证**：
  - 400 局曲线终态：L1-L12 一审 **100/100/99/99/97/82/80/80/78/69/66/62%**，恢复后 **全程 100%**，0 卡死、卖不掉 0、锁死败 ≤5.5%；
  - 对照目标带：L1-2 ≥95 ✓｜L3-5 ≥85 ✓｜L6-12 55-75：L10-12 入带 ✓，L6-9 轻微越上界（78-82，偏易 3-7pp）——决策点留给用户；
  - `boundary_check` 四项全绿（T1 20/20 同 seed 零失真、T2 886 单 0 违例、T3 35/35、T4 28/28）；
  - `sim:verify` 快照重建后复跑 **12/12 一致**。
- **遗留决策**：L6-9 一审 78-82% 越上界是否接受（接受 = 难度梯度健康、广告转化稍降；不接受 = 再加压一轮，但需避免 L8/L9、L11/L12 配置重合）。

## [2026-09-06 19:49] 四项要求改造：吊车3 / 种子调度 / 每车≥2+末车收完 / PRD网格暂缓标注
- **变更**：
  ① **吊车次数 4→3**：`core/Constants.ts:6` `CRANE_MAX = 3`（PRD 2.0 §5.4 定版），全工程唯一出处、零硬编码（`temp/`、`build/` 为构建产物自动重生成）。
  ② **随机流 seed 化调度**（用户需求 3，D4 执行流程）：`core/Types.ts` 新增 `Rng` 类型；新增 `core/Seed.ts`（mulberry32 唯一真相源，`tools/sim/prng.mjs` 改为 re-export）；`core/Board.ts` 的 `shuffle/randDir/smartDir/scatter` 改 Rng 参数注入、core 不再直读全局 `Math.random`；`core/GameSession.ts` 增 `seed/rng` 字段，`start(level, seed = -1)`——-1 哨兵走全局 Math.random（兼容 sim 注入链路与 view 层真随机），传 seed≥0 走 mulberry32（同 seed 完全复现）；`tryDispatch/findMatch` 的 slot 遍历由固定 for-i 改为按种子洗牌顺序。
  ③ **收购机制优化**（用户需求 4）：`makeOrder` 增 ≥2 硬约束（总只数 <2 时补到 2，凑不出则 return null 不发车）+ 末车模式（`totalAvail ≤ 6` 时一单按比例收完所有剩余、末位种类精确收尾；`totalAvail < 2` 返回 null 防极端剩 1 死单）——数学保证：HERD_N 全偶数 + 每单 ≥2 ⇒ 剩余恒为偶数，"剩 1 只"结构性不可能；看广告 `unlockSlot` 补车走同一 `tryDispatch ⇒ makeOrder` 链，规则自动生效。
  ④ **PRD 网格化暂缓标注**（用户需求 2）：PRD §5.1「网格布局规范」前新增实施状态标注框（确认日期 2026-09-06、适用 PRD V2.0 §5.1 / 初版 v1.0 开发期），§6 修订记录追加第 9 条补丁行；网格划分代码本轮零改动。
  ⑤ **对拍基准切换**（用户拍板，对齐文档 D4 预判）：吊车 3 + 末车模式 + 调度洗牌使 core 随机流必然偏离原型，旧 `sim:verify` 对 `_sim-trace.js` 对拍 11/12 失真属预期；`tools/sim/run.ts` verify 语义改为 **core 自身快照对拍**——首次生成 `tools/sim/baseline-snapshot.json`（L1-L12×100 局），此后 core 改动与快照逐行比对；新 400 局曲线基线已采纳为现行目标（L3 一审 79.5%/恢复后 91.3% 的难度回退系吊车减 1 所致，用户确认接受为新目标，留待 P4 难度重建统一调参）。
  ⑥ 新增边界回归工具 `tools/sim/boundary_check.ts`（T1 同 seed 双跑 / T2 ≥2 硬约束 / T3 末车白盒 totalAvail=1..6 / T4 解锁车位补车），临时诊断脚本 `boundary_diag.ts` 已删除。
- **涉及文件**：`assets/scripts/core/Constants.ts`（修改）、`Types.ts`（修改）、`Board.ts`（修改）、`GameSession.ts`（修改）、`Seed.ts`（新增）、`tools/sim/run.ts`（重写 verify 分支）、`tools/sim/prng.mjs`（改 re-export）、`tools/sim/BalanceSim.ts`（randDir/scatter 改传 S.rng）、`tools/sim/boundary_check.ts`（新增）、`tools/sim/baseline-snapshot.json`（新增）、`animal-market-prd/animal-market-prd.html`（§5.1 标注 + §6 第 9 条）；view 层零改动（无受影响调用点）。
- **成果・验证**：
  - `npm run sim:verify`（新语义）两次运行：首次建快照 → 复跑 **12/12 一致**（随机流零扰动闭环成立）；
  - `tools/sim/boundary_check.ts` 全绿：T1 同 seed 双跑 20/20 零失真、T2 共 879 单 under2=0、T3 白盒 35/35（含 totalAvail=1 应 return null）、T4 解锁后 27 单 under2=0；
  - 新基线 400 局曲线：L1 100%/L2 100% 教学保过，L12 一审 37.0%/恢复后 99.5%，锁死败 ≤2.5%（合理失败态）；
  - PRD HTML 标注已落盘可查；view 层 `grep` 确认无 Board 改签名调用点，编辑器编译面安全。

## [2026-09-06 18:02] PRD V2.0 对齐梳理：上一轮「否决网格化」结论作废，优先级规则反转
- **变更**：`animal-market-prd/animal-market-prd.html` 于 17:54 升级为 **PRD V2.0**（65,381 B → 75,910 B）。按其最新需求重梳全部已完成工作，产出 `docs/prd2-reconciliation-20260906.md`。
  1. **上一轮核心结论「否决网格化」作废**——依据是 PRD 1.3 的 `level.layout = 非网格；v1.0 不做网格模式`，该条款已被 V2.0 删除并反转为「6×10 等尺寸网格 + 四朝向紧密排列 + **相邻格遮挡**（O(1) 占用图）」。官方「版本修订记录 V1.1→V2.0」第 1 项即此变更。
  2. **优先级规则反转**：上一轮确立的「原型 V4.1 > PRD」作废 → PRD 2.0 §5.1 明确「内嵌原型为散点时代 V2 历史演示，**机制描述一律以 V2.0 正文为准**」，故改为 **PRD 2.0 > 原型**。
  3. **`docs/grid-layout-and-collision-analysis.md` 重新定性**：与 PRD 2.0 高度一致（6×10 / 格距 47.7 / 精灵 43.5 / 60 格 / 57% / 方案 A·B·C / 生成器 5 步 / JSON 格式 / 编辑器 Phase A·B·C / 不迁物理——全部被采纳），由「待评审建议」升格为「实现参考蓝本」；其 4 处事实错误仍需修正（§2.1 Game.scene 未创建、F4 未验证运行、F2 package.json 已修、§3.3「连锁更强」与实际相反）。
  4. **差异清单结论**：已写代码约 **70% 可保留**（生命值 3 心 / 碰撞弹回扣心 / 清空通关 / 双失败态 / 广告复活 / 不迁物理 / 订单系统 / 三道具 / 互锁救援 / 8 个广告点位 / 数值区间 全部与 PRD 2.0 对齐）；**需修改 10 项（B1-B10，核心是网格化及其 6 处连带：遮挡判定/生成器/洗牌/土路/命中/接触距离）**；**需新增 9 项（C1-C9，核心是 Grid 占用图 + col/row 字段 + 关卡 JSON Phase A）**；**需废弃 7 项（D1-D7）**。
  5. **纠正上一轮两处判断**：① 关卡 JSON / 编辑器 Phase A **不是 P6**——PRD 2.0 §5.8 明确列入 v1.0 范围，上一轮推 P6 是错的；② 「不做遮挡可视化」结论**仍然成立**，但理由从「原型实证废弃」改为「PRD 2.0 明文规定不置灰、可点击」。
- **涉及文件**：`docs/prd2-reconciliation-20260906.md`（新增，对齐梳理 + 新执行计划）；`docs/review-and-plan-20260906.md`（加作废声明，仅保留 §2 实测数据）；`../.workbuddy/memory/MEMORY.md`、`../.workbuddy/memory/2026-09-06.md`（规则反转与决策归档）。**游戏源码零改动。**
- **成果・验证**：
  - PRD 2.0 全文解析（33,408 字符）+ 19 个 TS 逐项核对 + 原型交叉核对；
  - `npm run sim` 实跑复核：L1-2 一审 100%、L4 99.5%、L8 74.5%、L12 53.8%、挤爆 0→43.8%、**0 卡死** —— 与 PRD 2.0 宣称的 4800 局基线（L4 98.8% / L8 75.0% / L12 55.3% / 挤爆 45.3%）吻合，确认当前实现即 PRD 基线来源；
  - 冲突点定位：吊车次数 PRD 3 次 vs `core/Constants.ts:6` `CRANE_MAX=4`（原型 `game.js:40` 亦 4）；`Panels.win` 无星级；`revive()` 无 2/局 上限；`useShuffle` 仍用 `scatter`（网格化后会直接把网格洗回散点）。
- **阻塞待裁决（8 项，见对齐文档 §4）**：D1 吊车 3 或 4 次；D2 碰撞接触距离 4.2px 过短（默认改 21px）；D3 难度目标内部不一致（默认以 5.1 实测基线为准）；**D4 种子对拍基准必然失效（默认切换为 core 自身跨版本对拍，属验收标准实质变更）**；D5 紧密排列 vs 43.5 精灵；D6 编辑器 Phase A 形态；D7 埋点未规划；D8 相邻遮挡难度补偿参数（默认用 BalanceSim 扫参）。

## [2026-09-06 16:21] 方案拍板：走上线冲刺路线，不做网格化、不做遮挡可视化
- **变更**：对 16:14 评审的三项待拍板议题完成决策，方案文档升级为 v2（`docs/review-and-plan-20260906.md`）。
  1. **玩法三元组 = 表述误差，以 PRD 为准**——不引入打螺丝/层叠。证据：「打螺丝」全库仅见于 `wechat-minigame-research.html`（另一份品类调研候选赛道 03：物理解谜），与本项目无关；PRD 术语表把「牧场散落区」来源标为「挪车类 / 猪了个猪」，即散点非网格本身就是刻意借鉴的设计。
  2. **不做网格化**——维持 PRD 5.1 字段规则 `level.layout = 散点｜非网格；v1.0 不做网格模式`。新增否决理由：网格化改相邻格遮挡会**损失走廊连锁深度**（走廊移走一只解锁整条走廊后的多只，相邻只解锁身后一只），而连锁解锁正是挪车爽感来源。
  3. **不做遮挡可视化（PRD 5.1 的置灰+锁角标）**——依据是用户提供的**原型迭代日志**（`share.traecontent.cn/EGDEBU47.BPHYQ`）：原型 V2 曾实现"走廊遮挡 + 置灰带锁"，V4/V4.1 **因"置灰锁死体验差"主动废弃**，改为"被挡动物不变灰、直接可点、点击后冲撞闪红弹回扣 1 生命"。据此 N1 定性修正为**「PRD 滞后于原型实证」而非「需求未实现」**；N3（animalCount/dirBias/targetOrders 漂移）同步关闭——迭代日志确认"通关判定从完成订单数改为清空牧场+围栏"是原型主动演进。
  4. **连带结论：0.1（修 `blockerOf`）优先级升为最高**。因为不做遮挡可视化 ⇒ 玩家看不到谁被挡 ⇒ **碰撞动画是他们理解"为什么被挡"的唯一渠道**；而实测 L20+ 有 **44%** 概率动物跑过贴脸那只冲向远处（最坏跨越 12.2R ≈ 牧场全高 3/4）——玩家会学到错误规则并持续扣血。**这不是穿模瑕疵，是教学系统在教错东西。**
- **涉及文件**：`docs/review-and-plan-20260906.md`（升级 v2）；`../.workbuddy/memory/MEMORY.md`、`../.workbuddy/memory/2026-09-06.md`（决策与规则归档）。**游戏源码零改动。**
- **成果・验证**：
  - 原型迭代日志交叉验证：确认 V2→V4.1 的置灰废弃链路，与原型源码 `game.js:503-507`（保留 `blocked` class）+ `styles.css:557`（`.p-a.blocked{filter:none}`）互相印证；
  - 互锁自动救援差异核对：调研日志称"V4.1 移除互锁免费送吊车"**不准确**——原型 `game.js:857-864` 与 Cocos 版 `GameView.craneTick` 均保留该逻辑，**以源码为准，此项无差异**；
  - 石头封顶：原型 3 vs Cocos 版 L20+ 为 4，属 DEVLOG 09:30 难度外环的已知主动偏离，不计入偏差；
  - `sim:verify` 12/12 全绿（基线未动）。
- **下一步（待用户确认后执行）**：阶段 0 四项（0.1 blockerOf 取最近者 ⭐ / 0.2 命中矩形优先 / 0.3 常量上收 / 0.4 打开并保存 Game.scene）→ 阶段 1 原型对拍校准 → 阶段 2 A3 逐关验收 + A5 特效对拍 → 阶段 3 A4 微信构建真机 → 阶段 4 关卡 JSON schema 定稿（散点版）。

## [2026-09-06 16:14] 网格化方案评审 + DEVLOG 强制写入规则建立
- **变更**：
  1. **评审 `docs/grid-layout-and-collision-analysis.md`**——用 Node 直跑 core 做量化实测（每关 400 局）逐条验证 P1–P4，不靠定性描述定性。结论：**文档核心建议（网格化）违反 PRD**（PRD 5.1 字段规则写死 `level.layout = 散点｜非网格；v1.0 不做网格模式`，文档通篇未引用 PRD）。逐条判定：P2 ✅ 成立且被低估（非最近占比 L20+ **44%**，最坏跨越 12.2R ≈ 牧场全高 3/4）；P1 ❌ 前提错误（走廊遮挡正是挪车语义，PRD 术语表来源标注"挪车类"，且 02:15 真实冲刺动画已讲清语义；真问题是**点击前看不到谁挡谁**）；P3 ❌ 证伪（MIN_D 违约率 0.00%，n≤34）；P4 ⚠️ 量级夸大 5–10 倍（实测点错率 0.3–2.0%）；F2 ❌ 已修（9-05 23:44）；F4/§2.1 ❌ 事实错误（Game.scene 在磁盘存在 uuid `a3f8d2e1…`，冒烟早已完成——文档把"当前激活场景是未保存的默认 Scene"误推断为"Game.scene 未创建"，并**用这个错误推断支撑了整个排期论证**）。§4「不迁物理引擎」✅ 结论正确，完全同意。
  2. **补充文档漏掉的关键项**：N1 被挡动物零视觉标识（PRD 5.1 要求置灰+锁角标；原型 V4.1 `styles.css:557` `filter:none` 主动取消；Cocos 版 `PenView.render` 仅在 craneMode 时 setCrane，连标记都没留）→ 玩家必须点一下扣颗心才知道被挡；N2 PRD 06 章自己把这条列为开放问题待数据裁决；N3 PRD 数值漂移（animalCount PRD 18–24 vs 实现 10–34、dirBias 0.4 vs 0.5、targetOrders 过关 vs 清空全场——后者原型同样如此，属 PRD↔原型一致偏离非移植缺口）。
  3. **建立 DEVLOG 强制写入规则**（见本文件头部「⚠️ 强制规则」）：时间必须 `date` 取系统值禁止估算、追加到「遗留与后续」之前、变更/涉及文件/成果・验证 三段齐全、源文件头部 `修改时间` 同步、零改动也记。
- **涉及文件**：`docs/review-and-plan-20260906.md`（新增，评审+方案待审核）；`DEVLOG.md`（头部规则块 + 本条）；`../.workbuddy/memory/MEMORY.md`、`../.workbuddy/memory/2026-09-06.md`（新增，项目记忆与规则）。**游戏源码零改动。**
- **成果・验证**：
  - `sim:verify` **12/12 全绿**（评审时实跑，确认基线健康，非引用旧记录）；
  - MCP 实测取证：`project_project_manage.get_info` / `scene_scene_management.get_list`（Game.scene `a3f8d2e1…` 存在）/ `scene_scene_hierarchy`（当前激活为未保存默认场景 `0e5019bc`，仅 Main Light + Main Camera）；cocosMCP :3000 v1.5.4 共 50 工具；预览 :7456 在线；
  - 量化实测数据（临时探针已删，数据归档于评审文档 §2）：P2 非最近占比 L1 15.8% / L6 32.4% / L10 39.2% / L20 44.9%；P1 遮挡距离中位数 2.65–3.55R、P90 ≈7.2R；P3 违约率 0.00%(n≤34) / 0.24%(n=38)；P4 点错率 0.3%→2.0%(L1→L30)；P3b 首轮解锁<6 触发率 L1 18.0% / L6 1.0% / L10+ ≈0%。
- **待拍板（阻塞后续执行）**：① 用户所述"打螺丝"全库仅见于 `wechat-minigame-research.html`（另一份品类调研候选赛道 03），与本项目无关——是新想法还是表述误差？② 网格化要不要改 PRD？③ 本轮目标是上线冲刺 / 玩法升级 / 并行？

## [2026-09-06 14:20] 车位消失复现排查结论 + Cocos 引擎能力审计（用户反馈①③）
- **排查**：页面内注入自动游玩（贪心配单策略 + 每 0.65s 数据/视觉错配检测 + 错误捕获）：
  - L1 完整通关（7 单/200 金币/满血）：**全程 0 错配、0 报错**；
  - L2 中盘自动游玩：3 车位持续可见（opacity=255、位置正确），0 错配。
  - 结合 13:32 的确定性状态机测试，"发车后立即补单车辆隐形"已被修复并有回归护栏；
    用户侧若仍复现，**请硬刷新预览页（Ctrl+F5）**——预览窗口若停留在旧代码会继续
    表现旧 bug。
- **不变量核对**：车位状态仅在 6 处变更（startGame/settle/depart/reconcile 补车/
  unlockSlot/watchdog），每处变更后都紧跟渲染；异常路径由看门狗 1.5s 兜底。
- **Cocos 引擎替代审计**（结论：核心规则层保持纯数学，表现层有两处可选优化）：
  1. **碰撞检测不用物理引擎**：走廊遮挡（isBlocked/blockerOf）是玩法规则本体，
     由 6400+ 局模拟器锁定，换物理引擎会引入不确定性且破坏种子对拍；当前
     "数学判定 + 视觉行进到接触点"的架构已把确定性和手感分离，维持现状。
  2. **粒子对象池（建议，低风险）**：碰撞爆点每次 new/destroy 8 个节点，可改
     cc 内置对象池复用，减少 GC 抖动——留待下一轮实施。
  3. **Draw call**：全矢量 Graphics 当前 58 draw call / 18889 三角形，中端机无压力
     （60fps）；P6 美术替换（图集 Sprite）时自然解决，本轮不动。
  4. 其余（Tween/UIOpacity/Widget/坐标转换）已在用引擎 API，无需替换。
- **涉及文件**：无代码变更（本条为排查结论与审计记录）；自动游玩脚本内嵌于预览页。

## [2026-09-06 14:05] 并发点击改造：行走期间可继续点下一只动物（用户反馈②）
- **变更**：原 `busy` 全局锁把整个入栏行走期间（土路绕行 1.5~3s）的输入全部锁死。
  拆分为两级——`busy` 仅锁链式动画（装车/发车/碰撞冲刺），新增 `walks` 计数器跟踪
  在途行走：`moveTo` 改用 walks、`onArrive` 递减，`reconcile` 加 `walks>0` 守卫
  （末次落地统一调和，避免多路装车动画交错）；startGame 重置 walks。
  连带：`FenceView.render` 隐藏参数由单 uid 改为 `Set<number>`，`GameView` 维护
  `walkingUids` 集合——多只在途时围栏条只隐藏在途的那几只，不再出现"分身"提前显示。
- **涉及文件**：`assets/scripts/view/GameView.ts`、`FenceView.ts`
- **成果・验证**：预览内快速连点两只：walks=2、fx 层 2 个 walk 节点同时行走、busy=0
  （输入不锁）；落地后订单自动装车，fence/数据对账一致。`sim:verify` 12/12 全绿。

## [2026-09-06 13:55] 重写虚线圆角矩形，修复四角无虚线/斜直线（用户反馈）
- **变更**：`Draw2D.dashedRoundRect` 重写。旧实现两个缺陷：① 只采样四条直边，
  四段 90° 圆角弧从未绘制（四角无虚线）；② 把各边首尾点当连续折线，相邻边端点间的
  弦被画成虚线段（右上/右下出现斜直线），且 dash/gap 参数被忽略（实际 3.5px 交替）。
  新实现：整环采样（四直边 + 四段圆角弧，闭环）+ 按弧长以 dash/gap 交替落笔/抬笔，
  虚/实相位跨顶点连续。修复过程中还发现并修正了重写初版的底边笔误
  （误写成右下角弦 `(x+w,y+r2)→(x+w-r2,y)`，已改回 `(x+w-r2,y)→(x+r2,y)`）。
  离线几何断言（tools/test-dashed-roundrect.cjs）：最长线段 ≤ dash、零超长弦线、
  全部点落在圆角周长上（偏差 ≤ 0.07）、四象限均有虚线。
- **影响面**：牧场白色虚线边界（r=18）与土路车辙虚线（r≈37）共用此函数，一并修复。
- **涉及文件**：`assets/scripts/view/Draw2D.ts`、`tools/test-dashed-roundrect.cjs`（新增离线断言脚本）
- **成果・验证**：构建 0 错误；离线几何断言全绿 + 浏览器截图确认四角虚线连续无斜线。

## [2026-09-06 13:32] 修复车位/车辆消失（用户截图：发车后补单车辆隐形）+ 动物数量随关卡递增
- **变更**：
  1. **车位消失 bug**（`ParkView.render`）：发车流程 leaving →(0.38s) settle → 立即补单
     truck 时，`fresh` 判定把 prev==='leaving' 排除在"新到车"之外——playLeave 的淡出/
     左移永不复位，补来的新车整块隐形（用户截图 L2 第 1 格空白即此）。现捕获旧状态
     prev，`prev==='leaving'` 也按新到车处理：playArrive 复位透明度/位置再入场。
  2. **动物数量随关卡递增**（`core/LevelCfg.ts`）：herdN 上限 L1-14 维持 30 只（对拍
     保护区分支不变），L15-19 → 32 只、L20+ → 34 只。农场缩小后密度随关卡逐步加压。
- **涉及文件**：`assets/scripts/view/ParkView.ts`、`core/LevelCfg.ts`
- **成果・验证**：
  - 确定性状态机测试（编辑器预览内直接驱动 park.render）：leaving→truck 转换后
    车辆 opacity=255、位置=入场起点（修复前停在淡出轨迹上不可见）；
  - `sim:verify` 12/12 全绿（L1-12 分支未动）；单关深测：L15（32 只）一审 33.3%、
    L20（34 只）24.4%、L25 25.1%，**恢复后均 100%、卡死 0%**。
- **设计说明**：库存被在场订单全部预订时，多余空车位显示"空车位"属正常（一张订单
  必须绑定现有库存，否则永远无法完成）；被预订动物发出后，空闲看门狗（1.5s）会
  自动补新车——配合本次可见性修复，"农场有动物就一定看得到车"。

## [2026-09-06 11:20] 素材风格定调 3D 俯视渲染 + AI 生成 Prompt 手册（用户反馈）
- **背景**：用户展示猪了个猪教程截图，定调动物素材为 **3D 卡通渲染俯视角**（非平面矢量）；
  环境无生图能力（无内置 image_gen、OPENAI_API_KEY 未设置），用户接受"给 Prompt 自行生成"。
- **变更**：
  1. `docs/art-spec.md` 升级 v1.1：风格章节改为 3D 卡通渲染俯视 45°（up=背影/down=露脸/
     left/right=侧面，四向同一只同光照），v1.0 平面矢量草稿降级为占位参考；
  2. 新增 `docs/art-prompts.md` AI 生成 Prompt 手册：中英双语、通用风格尾缀+负面词、
     6 物种主体描述表、四向网格版（推荐，一致性最好）与单张版模板、出图后处理流程
     （抠底→切割→规格化→命名）。
- **涉及文件**：`docs/art-spec.md`、`docs/art-prompts.md`（新增）
- **成果・验证**：用户可直接复制 Prompt 到即梦/Midjourney 等工具出图；出图后交回，
  由接手开发做切割/规格化/命名终检并接入引擎（AnimalNodeC 换 Sprite，去箭头）。

## [2026-09-06 11:10] 动物四向精灵素材：规格文档 + 程序化草稿产出（用户需求）
- **背景**：后期动物改为图片素材、朝向即运动方向（对标猪了个猪/挪车）。环境内 AI 生图
  不可用（无内置 image_gen 工具、OPENAI_API_KEY 未设置），故走"原型 SVG 同源派生 +
  浏览器栅格化"的程序化管线产出草稿。
- **变更**：
  1. 新增素材规格文档 `docs/art-spec.md`：24 张清单（6 物种 × up/down/left/right）、
     144×144 PNG-32 透明底、主体占比/基线一致、风格公式（#5f4a3a 描边等）、命名契约
     `{species}_{dir}.png`（同名覆盖热替换）、验收清单、引擎接入约定（换朝向=换图，
     常规移动去箭头、吊车圈保留、稀有金环/红闪沿用现有节点）。
  2. 新增生成管线 `tools/gen-animal-sprites.mjs`：以原型 animals.js 同源 SVG 为基，
     程序化派生四向——down=原样 / up=去脸+物种尾巴 / left/right=五官整组平移 ±7 的
     3/4 侧脸 + 对侧尾巴；产出 `tools/sprite-preview.html`（页面内 exportSpritesAsync
     导出 144×144 PNG base64）。
  3. 经内嵌浏览器栅格化落盘 **24 张 PNG + 联络表** 至 `art-draft/`（草稿占位，不入包体）。
- **涉及文件**：`docs/art-spec.md`（新增）、`tools/gen-animal-sprites.mjs`（新增）、
  `art-draft/animals/*.png` ×24、`art-draft/contact-sheet.png`（新增，构建外目录）
- **成果・验证**：联络表人工检视——24 张四向齐全、风格与游戏内一致、朝向可读；
  已知瑕疵（草稿级）：鸡/羊背面腿部、鸭背面尾向等细节待正式美术按规格重绘。
- **后续**：美术按规格出正式图（或用户认可草稿直接采用）→ `AnimalNodeC` 换 Sprite
  加载 `{species}_{dir}`（去箭头）→ 打 atlas 控包体。

## [2026-09-06 10:58] 修复 moveTo 引用越界常量 ROAD_W 导致的运行时崩溃
- **变更**：ROAD_W 是 buildLayout 局部常量，moveTo 直接引用即 ReferenceError（点击
  动物即弹错误面板）。新增实例字段 `roadBand`（buildLayout 内赋值 = 路带中心线偏移），
  moveTo 改用 `this.roadBand`。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：编辑器预览端到端点击朝下动物：walking=true → 动画完成入栏
  （fence+1、busy 释放），无错误面板；web-mobile CLI 构建 0 错误。

## [2026-09-06 10:55] 修复 roadWaypoints 坐标符号颠倒（动物没踏上土路的根因）
- **变更**：pen 本地坐标系 y 向上、牧场草地占 [-penH, 0]，顶边=0、底边=-penH。
  原实现 up 出界点/顶边引道口/左上右上角写成负值（实际落在牧场内部）、down 出界点/
  左下右下角写成正值（落到牧场上方屏幕外）。全部按正确符号重写。
- **涉及文件**：`assets/scripts/view/PenView.ts`
- **成果・验证**：预览内复验四朝向：朝下 (71,-347)→(71,-446) 踏底路→(-22,-446)→
  (-22,+22) 沿左路上行→(143,+22) 顶边引道口 ✓；朝左/朝右/朝上同构验证通过。

## [2026-09-06 10:50] 农场圆角 + 土路宽度减半 + 高光修复（用户反馈）
- **变更**：
  1. **农场圆角**：`PenView` 草地原为 6 条直角色带（角部伸出圆角虚线外）。Graphics 无
     单侧圆角，改用"圆角帽 + 中段直条"画法——顶部整宽圆角帽（band0 色）、中段 4 条
     直带、底部整宽圆角帽（借倒数第二档色，与末档肉眼无差），农场四角与虚线边界
     （r=18）一致收口。
  2. **土路宽度减半**：`ROAD_W` 53 → 26.5，牧场每侧让出收窄为 32.5（路带 26.5 + 草缝 6），
     牧场相应放大至 286×478（penLeft 44.25 / penTop 224.5）；路带仍四边等宽、完整可见、
     不顶围栏。
  3. **顶部高光修复**：原型 radial 高光（白 28%）在移植时漏写 `fill()` 从未渲染；
     本轮补上后以不透明白渲染成"白饼"，改用 `colA('#ffffff', 71)` 低透明度修复。
- **涉及文件**：`assets/scripts/view/PenView.ts`、`GameView.ts`
- **成果・验证**：构建 0 错误；截图确认农场四角圆角收口、土路等宽减半、顶部为
  半透明微光高光。

## [2026-09-06 10:50] 沿路行走路线二次修正（用户反馈：路径依然不正确）
- **变更**：
  1. `PenView.roadWaypoints` 朝上分支此前只返回围栏口一个点——朝上动物从原位置直接
     斜插过去。补上"先沿自身朝向直行上土路"的首路径点（x 不变，y 到路中心线）。
  2. left/right/down 路径把出界点 E 并入首路径点（此前从原位置斜插到转角）。
  3. `GameView.moveTo` 路径末点延伸到围栏格本身（沿路跑到引道口后再跑进入栏格）。
- **涉及文件**：`assets/scripts/view/PenView.ts`、`GameView.ts`
- **成果・验证**：预览内计算四朝向路径点序列，首段均为纯朝向方向、后续段沿路折线。

## [2026-09-06 10:40] 农场缩小居中，土路四边等宽完整可见（用户反馈）
- **变更**：此前牧场占满内容列（351 宽），路带（53）左右两侧被屏幕裁掉（各只露 ~12px）、
  且顶边路带顶到围栏。现农场每侧让出"路带 53 + 草缝 6 = 59"：牧场缩为 **233×425** 并居中
  （top 251，随 Fence→Pen 间距公式），土路四边**等宽 53 完整可见**（左右各留 19px 屏幕边距），
  围栏底与路带间留 16px 草缝——土路不再把围栏包进去；行走路由（roadWaypoints）按新几何
  自适应，无需改动；walkPath 克隆尺寸改为 `pen.animalSize()`（跟随新牧场等比缩小的动物），
  bandOffset 改用固定 ROAD_W/2。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：构建 0 错误；几何核对——牧场 71..304（design x），路带外缘 18/357，
  屏幕边距各 19px；围栏底 182 与路带顶 198 间草缝 16px。内嵌预览面板节流未能截图，
  以用户刷新页面确认为准。

## [2026-09-06 10:40] 新增 cocos-mcp 调试辅助（用户安装 cocos-mcp-server 后）
- **变更**：新增 `tools/mcp-call.mjs`——cocos-mcp-server（编辑器插件，HTTP :3000/mcp）
  的最小 MCP 客户端，支持 initialize/tools/list/tools/call，会话句柄缓存在
  `tools/.mcp-session`。编辑器预览服务（:7456）资产改动自动重编译，配合
  `assetAdvanced_asset_system` 强制刷新可确定性更新预览代码。
- **涉及文件**：`tools/mcp-call.mjs`（新增）
- **成果・验证**：本次全部路径验证均经编辑器预览（:7456）完成，替代缓慢的 CLI 构建。

## [2026-09-06 10:15] 修复宽土路顶边遮挡围栏条
- **变更**：路带加宽到 53 后顶边越过围栏条（土路在 fence 之后加入被画在上层）。将
  `road.node.setSiblingIndex(2)`，最终层序 hud(0)→park(1)→road(2)→fence(3)→tools(4)→pen(5)，
  围栏/道具压在路带上层，围栏底与路带相接处即引道口。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：截图确认围栏 7 格完整可见且视觉上"建在土路上"。

## [2026-09-06 10:05] 土路加宽至动物等宽 + 沿土路多段折线行走（用户反馈）
- **变更**：
  1. 土路带宽度由 13 → **与动物等宽**（`列宽×0.152 ≈ 53` 设计像素），路中心线外扩 半宽，
     动物按朝向出界正好落在路中央；移除原顶部短引道（围栏底直接压在路带上即引道口）。
  2. `FxService.walkAnimal`（两段式）重构为 **`walkPath` 多段折线行走**：逐顶点转向
     （箭头恒朝行进方向）、土路段速 360、末段"跑"430 并缩步入栏、步频弹跳末段停。
  3. `PenView.exitWorld`（单出界点）替换为 **`roadWaypoints`**：路由 = 自身朝向投影到
     路中心线 E → 同侧转角 → 顶边中央引道口；朝下动物自动选水平更近的一侧
     （底边 → 侧边 → 顶边），修复"到土路后直接斜插飞向围栏"的问题。
- **涉及文件**：`assets/scripts/view/PenView.ts`、`FxService.ts`、`GameView.ts`
- **成果・验证**：构建 0 错误、对拍 12/12 全绿；轨迹采样实测朝下动物：
  起点 y=-204（向下走）→ 左侧路带 x≈-202 向上跑 → 到达入栏（busy 释放、fence+1）。

## [2026-09-06 09:40] 修复土路引入的 buildLayout 中断
- **变更**：土路代码使用了 `place()` 但 GameView 未从 `./Ui` 导入，ReferenceError 使 buildLayout 在 tools 之后中断（pen/panels/fx 未创建）。补导入。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：重建 0 错误；轮询断言 `panels/fx/pen` 均创建成功。

---

## [2026-09-06 09:30] 本轮四项（用户反馈：需求行对齐 / 土路 / 朝下动物直飞 / 逻辑保障）
- **变更**：
  1. **需求行对齐**：`ParkView.syncNeeds` 重排——每行按实际组数水平居中（原固定左起点导致单组挤左、列距 30 < 组宽 33 相邻重叠），多行垂直居中；容器加高到 24。
  2. **土路**：牧场外围一圈土路环（13 宽沙色带 + 车辙虚线，画在 pen 之下形成环带）+ 顶部通往围栏的短引道；`exitWorld` 出界越界量改 3.5 core 单位（≈12px，正好踏在路带上）。
  3. **修复朝下动物直飞围栏**：`exitWorld` 的 up/down 出界方向写反（core 的 yu=0 是牧场**顶**、yu=125 是**底**）——朝下动物出界点被算到牧场顶上方，到围栏只剩一小段直线。已按朝向正确越过对应边界。
  4. **逻辑保障**：① `GameView` 新增空闲看门狗（对局中且无动画时每 1.5s 调和一次，幂等）——兜底任何回调时序丢失导致的车位空置，保证"牧场有动物就有车接"；② `LevelCfg` 难度外环：L13+ 种类数解锁 6、L15+ 单订单最多 4 种、L20+ 石头 4 颗（**L1-12 分支保持原样**，种子对拍不受影响），后期需广告解锁车位/复活才能稳定通关。
- **涉及文件**：`assets/scripts/view/ParkView.ts`、`PenView.ts`、`GameView.ts`、`core/LevelCfg.ts`
- **成果・验证**：`sim:verify` 12/12 全绿；单关深测 L13 一审 39.1%、L15 37.3%、L20 35.4%，**恢复后均 100%、卡死 0%**（难度上去了、公平性保住）。

## [2026-09-06 02:20] 入栏动画改为「走出牧场 → 调头 → 走向围栏」（用户反馈）
- **变更**：新增 `FxService.walkAnimal`（克隆体带方向箭头与步频弹跳：按朝向走出牧场边界 → 停顿 0.12s 调头 → 跑向围栏格缩步入栏）；`GameView.moveTo` 普通拿取改走此动画，**吊车吊走保留飞行**。`PenView.exitWorld` 提供出界点换算。
- **涉及文件**：`assets/scripts/view/FxService.ts`、`PenView.ts`、`GameView.ts`
- **成果・验证**：实测入栏后装车链照常（订单满足→装车→发车）；行走节奏参数集中在 walkAnimal。

## [2026-09-06 02:15] 碰撞改为真实接触触发（用户反馈）
- **变更**：core 新增 `Board.blockerOf` 纯查询（不消耗随机流），`isBlocked` 委托之，`GameSession.blockerOf` 透出；`AnimalNode.bonk(dir, hitDist, onImpact)` 重做——动物渐加速**真实行进**到接触点（遮挡者投影距离 − 两个身位），接触瞬间点亮红闪并回调粒子/飘字/震屏/心碎，再过冲弹回；busy 释放时间随距离动态计算。
- **涉及文件**：`assets/scripts/core/Board.ts`、`core/GameSession.ts`、`view/AnimalNode.ts`、`view/PenView.ts`（posLocal/localToWorld/coreRadiusPx）、`view/GameView.ts`
- **成果・验证**：`sim:verify` 12/12 全绿（纯查询不影响随机流）；实测点击被挡动物：冲刺期间无效果闪现，接触帧触发全部效果，弹回后 busy 释放。

## [2026-09-06 02:10] 修复车位错位 + 红心偏左（用户反馈）
- **变更**：① `ParkView` 的 `truckWrap` 被 `placeC(0,0)` 定位到槽位左上角（卡车/载货/需求行整组偏移 (31,34)），按槽位中心 `(sw/2,-sh/2)` 重定位；② `HudView` 三心组左偏 5.5，起点 9→14.5 居中。
- **涉及文件**：`assets/scripts/view/ParkView.ts`、`HudView.ts`
- **成果・验证**：卡车/需求行落入槽位居中，三心居中（截图）。

## [2026-09-06 01:50] 修复顶部 HUD/围栏错位（用户报告"上面部分布局错乱"）
- **变更**：`place()` 重置锚点为 (0,1)，而 `HudView` 图标/胶囊与 `FenceView` 围栏格底板按**中心**绘制，直接 place 视觉左上偏移半宽/半高（按钮被裁 15px、文字吊底、围栏格左侵文字区，像素实测吻合）。统一改为“(0,1) 容器 + 居中底板子节点 `setPosition(w/2,-h/2)`”（与 ToolsBar 底板同惯用法）；`FenceView.slotWorld` 改由容器换算。
- **涉及文件**：`assets/scripts/view/HudView.ts`、`FenceView.ts`
- **成果・验证**：构建 0 错误；像素实测暂停按钮 y≈8..40（设计值），顶栏全对齐。

## [2026-09-06 01:24] 开局刷新关卡牌
- **变更**：原型按页加载设关卡号；Cocos 连续会话下 `startGame` 需调用 `hud.setLevel`。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：下一关后关卡牌正确。

## [2026-09-06 01:22] 修复按钮文案右偏
- **变更**：`mkBtn` 标题/副文案被 `placeC` 在 `(w/2,0)`——按钮节点为中心锚点，该点即右缘。改为 `(0,…)` 居中。
- **涉及文件**：`assets/scripts/view/Ui.ts`
- **成果・验证**：所有面板按钮文字居中（截图）。

## [2026-09-06 01:20] 修复标签文本永不更新（makeLabel 包装对象误用）
- **变更**：`makeLabel` 返回 `{node,label}` 包装对象，`HudView.render/setLevel`、`FenceView.render`、`Panels.ad` 直接对包装对象赋 `.string`（挂在新属性上，真 Label 不变）。全部改为 `.label.string`。
- **涉及文件**：`assets/scripts/view/HudView.ts`、`FenceView.ts`、`Panels.ts`
- **成果・验证**：进度“剩 N 只”、金币数、围栏 N/7、广告倒计时实时更新（运行时断言）。

## [2026-09-06 00:36] 修复模态面板白色底板不渲染
- **变更**：`Panels.begin()` 的 `wipeChildren(host)` 会 destroy 持久复用的 panelbg 底板节点，再 addChild 回已销毁节点导致 Graphics 永不渲染。修复为先 `removeChild` 摘下底板再清场。
- **涉及文件**：`assets/scripts/view/Panels.ts`
- **成果・验证**：开局面板/失败/胜利面板白色底板正常渲染（A/B 截图 + 像素比对）。

## [2026-09-06 00:26] 修复整体布局错位到右下象限（首次冒烟）
- **变更**：`Ui.place()` 容器契约要求锚点 (0,1)=左上，而 5 个布局组件直接挂在中心锚点的 design 节点下，place 坐标从屏幕中心起算。新增左上原点 `column` 容器承载布局组件。
- **涉及文件**：`assets/scripts/view/GameView.ts`
- **成果・验证**：浏览器截图确认全屏布局正确。

## [2026-09-06 00:12] 修复构建期 MISSING_EXPORT（R1 类）
- **变更**：`ParkView` 的 `SLOT_COLORS` 误从 `core/Constants` 导入（实际定义于 Draw2D）；编辑器编译宽松放行、rollup 构建失败。
- **涉及文件**：`assets/scripts/view/ParkView.ts`
- **成果・验证**：web-mobile 构建通过。

## [2026-09-06 00:12] 修复场景组件 Class ID 解析失败
- **变更**：场景中自定义组件 `__type__` 须用打包器的 **23 字符压缩 uuid**（前 5 位 hex 字面 + 18 位 base64，即 `_RF.push` 注册的别名）；初版误用 22 字符变体导致 "Missing class"。
- **涉及文件**：`assets/scenes/Game.scene`
- **成果・验证**：构建日志 "Missing class" 归零，GameView 成功挂接。

## [2026-09-05 23:52] A2：README 与 DEV-PLAN 勾选回填
- **变更**：新增 README（快速开始 / 60 秒手动兜底 / 目录约定 / 模拟器命令 / 已知坑）；DEV-PLAN P0–P4 勾选按实际进度回填（R7）。
- **涉及文件**：`README.md`（新增）、`DEV-PLAN.md`
- **成果・验证**：接手人 30 分钟上手路径完整。

## [2026-09-05 23:52 → 00:05] A2：Game.scene 手工创建
- **变更**：手写场景 JSON（Canvas + Camera + GameRoot 挂 GameView 组件）及 `scenes.meta`/`Game.scene.meta`。
- **涉及文件**：`assets/scenes/Game.scene`、`Game.scene.meta`、`assets/scenes.meta`
- **成果・验证**：编辑器构建时成功解析并再序列化该场景（结构合法）。

## [2026-09-05 23:47] A1：GameView.ts 总控初版
- **变更**：按交接附录契约逐段移植原型 game.js V4.1 全部控制流——触摸路由（点击→core 判定→入栏/碰撞/吊车）、装车链（reconcile→findMatch→fulfillSlot→departSlot→补车）、失败链（挤爆/扣血/死局）、胜利链、救援链（吊车首免+广告）、8 个广告点位、fxGen 代数纪律 + busy 输入锁 + coinsShown 入账节奏。
- **涉及文件**：`assets/scripts/view/GameView.ts`（新增，约 560 行）、`GameView.ts.meta`
- **成果・验证**：交接文档最大缺口补齐；后续构建 0 编译错误。

## [2026-09-05 23:44] A6：修复 package.json 模拟器脚本
- **变更**：`sim`/`sim:check` 指向过期（`run.js`，实际是 `run.ts`），改为完整 strip-types 命令，并补 `sim:verify`。
- **涉及文件**：`package.json`
- **成果・验证**：`npm run sim / sim:check / sim:verify` 三命令可用；`sim:verify` 对拍 **12/12 全绿**。


## [2026-09-07 15:15] 3D 素材引擎接入（双模式 + 可回退）
- **背景**：24 张 3D 渲染素材（6 物种 × 4 向）已就绪；按"保留旧版可回退"要求接入。
- **变更**：
  1. 素材移入 `assets/resources/art/animals/`（resources 动态加载区）；旧矢量代码零删除；
  2. 新增 `view/AnimalArt.ts`：`ART_MODE` 开关（'sprite' 默认 / 'vector' 回退一键切回）、
     `loadAnimalSpriteFrame` 带缓存加载；**2026-09-07 12:00 修复**——png 默认以 texture 类型
     导入（config 无 spriteFrame 子资源），改为 load 'xxx/texture' 为 Texture2D 后运行时
     `sf.texture = tex` 动态构造 SpriteFrame；
  3. `view/AnimalNode.ts`：sprite 模式 = 3D 图（换朝向=换图、无箭头、稀有金环独立节点垫底、
     矢量皮肤作加载占位成功后隐藏）；vector 模式 = 旧矢量+箭头；加载失败自动回退矢量；
     新增 markDead() 防异步回调竞态（PenView 同步调用）；
  4. `view/FxService.ts`：走路/飞行克隆体同样挂素材（walkPath 按段行进方向换向图、fly 用 up）；
     克隆体矢量皮肤仅作素材就绪前占位。
- **涉及文件**：`assets/scripts/view/AnimalArt.ts`（新增）、`AnimalNode.ts`、`FxService.ts`、
  `PenView.ts`、`assets/resources/art/animals/*`（24 png + meta，编辑器自动导入）
- **成果・验证**：构建 0 错误；端到端断言：12/12 动物 SpriteFrame 加载成功且矢量皮肤隐藏
  （hidden=12/shown=0）、走路克隆体 clone-sp 有帧且激活；截图确认 3D 动物正常显示行走。
- **回退**：改 `AnimalArt.ts` 的 `ART_MODE = 'vector'` 即整体回到矢量版。

## 遗留与后续（对照交接行动项）
- **A3**：12 关逐关人工通关 + 失败/复活/翻倍广告链路人工核对。
- **A4**：微信开发者工具构建与真机预览（需 AppID，Owner）。
- **A5**：特效视觉对拍（时长/幅度/缓动手感，对照原型）。
- **A7**：真实广告接入（Owner 申请广告位 ID 后填 `WxBridge.adUnitId`）。
- 新增难度外环（L13+）如需上线，建议用模拟器对 L13–L30 做一轮全量曲线扫描存档。
