# 动物 Schema 数据文档（v1.0）

> **唯一数据真相源**：`assets/scripts/core/AnimalSchema.ts`（core 层，禁止 import 'cc'，Node 直跑，BalanceSim/对拍链路直读）。
> 本文档说明 schema 字段约定与动物增删操作流程。**改动 schema 后必跑 `npm run sim:verify`（12/12）与 `npx tsc -p tsconfig.typecheck.json`。**

## 一、字段定义

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| `id` | string | 种类标识（唯一稳定键） | ⚠️ 上线后**禁止变更/复用**（存档 `soldByType`、订单 items、种子对拍快照都以 id 为键），只允许追加新 id |
| `name` | string | 显示名称 | 面板/结算/漂浮文案用，可随时改 |
| `price` | number | 基础售价（金币） | 影响 order value、放生/清仓返还、bestSale；调整会改变难度与营收曲线，改后须跑 400 局曲线复扫 |
| `rareMultiplier` | number | 闪光（rare）个体售价倍率 | 当前全部 3；影响 trackBest/放生 50%/清仓 70% 三处计价（已收编，业务层零硬编码） |
| `art` | `'vector' \| 'sprite'` | 美术形态 | `vector` = Draw2D 矢量绘制（当前全量）；`sprite` = 挂 `resourcePath` 图片（P6 美术替换期启用） |
| `resourcePath` | string | 图片资源路径 | art='sprite' 时生效；当前为占位空串，美术资产产出后填 `sprites/animals/<id>` |

## 二、现有动物清单（6 种）

| id | 名称 | 基础价 | 闪光倍率 | 解锁关卡* | 美术 |
|---|---|---|---|---|---|
| chicken | 鸡 | 8 | 3 | 第 1 关起 | vector |
| duck | 鸭 | 10 | 3 | 第 1 关起 | vector |
| rabbit | 兔 | 12 | 3 | 随 typeCount 逐关解锁 | vector |
| sheep | 羊 | 15 | 3 | 同上 | vector |
| pig | 猪 | 18 | 3 | 同上 | vector |
| cow | 牛 | 25 | 3 | 高关卡（typeCount=6） | vector |

\* 动物出场由 `core/LevelCfg.ts` 的 `typeCount`（L1-2=3 → L20+=6）控制：每关取 `TYPES` 数组前 `typeCount` 个种类，数组顺序即解锁顺序。**调整出场节奏改 LevelCfg，不动 schema 顺序**（顺序变更会扰动种子对拍）。

## 三、如何新增一种动物（操作清单）

1. **`core/AnimalSchema.ts`**：`ANIMAL_SCHEMA` 数组追加一行（id 唯一、price/rareMultiplier 按经济设计、art 先填 `'vector'`）。
2. **`view/Draw2D.ts`**：`drawAnimal` 的 switch 加对应 `case '<id>'`（矢量绘制，与 animals.js BODIES 逐形对应）；否则运行时该动物不渲染。
3. **`core/LevelCfg.ts`**：确认 `typeCount` 各档位是否需要覆盖新种类（数组前 N 个出场，新动物追加在尾部则只在 typeCount 增大后出场）。
4. **回归验证**：`npm run sim:verify`（应为 12/12——纯数据追加不扰动随机流，前提是未改变既有 id 顺序）+ `npx tsc -p tsconfig.typecheck.json` 新增行 0 报错。
5. **若动 LevelCfg / price**：难度曲线复扫（`npm run sim` 400 局），必要时重建 `baseline-snapshot.json` 并在 DEVLOG 说明。

## 四、如何下架/替换动物

**不支持物理删除**（id 是存档与对拍稳定键）。替换语义 = 在 schema 中把该行字段改为新动物的（等价于换皮），或把 `LevelCfg.typeCount` 上限压到不含它。上线后确需废弃：保留 schema 行（防存档键悬空）+ 从 LevelCfg 出场序列中排除。

## 五、需求 1 澄清：车辆装载规则现状（2026-09-06 用户确认维持现状）

订单系统**早已支持每辆车多种类、各自数量**，三层证据：
- **生成**：`core/GameSession.makeOrder` 按 `LevelCfg.orderKinds`（L1-3=1 类教学保护、L4-12=2 类、L13-19=3 类、L20+=4 类）生成多种类订单，每类数量 1~2；末车模式（场上 ≤6 只）一张订单贪心全收全部剩余种类；
- **匹配**：`core/GameSession.findMatch` 逐种类核对围栏数量、按种类取走对应只数（非闪光优先）；
- **展示**：`view/ParkView.syncNeeds` 卡车需求面板按种类逐项渲染（每行 2 项图标+需求数，多行居中）。

L1-3 只见单类车是 PRD 教学保护设计；L4+ 正常模式另有 40% 概率发单类订单（难度分布）。**用户拍板（2026-09-06）：维持现状不改**——任何订单生成改动都会扰动随机流，需重建对拍快照 + 400 局曲线复扫。

## 六、需求 3：围栏满载判定语义（2026-09-06 落地）

**判败条件 = 围栏满（≥7）且 `core/GameSession.isFenceHopeless() === true`**（无任何在途卡车订单可被围栏现有动物满足）。存在可满足订单时：装车放行 → 围栏腾位 → 对局继续。

实现接线（view 层 `GameView.ts`，core 只加纯读判定不消耗随机流）：
1. `failTick`（0.5s 缓冲到期）：终局裁决——已消化回 play / 可满足回 play+装车 / 确实无解才 `failFence`；
2. `onArrive`：failwait 期间有动物落地 → 重新裁决（落地凑齐即解除失败倒计时）；
3. `reconcile` 尾部：装车链跑完仍满载（并发溢出）→ 重新进入缓冲裁决。

与模拟器一致性：`BalanceSim` 的 failfence 判定本就是「reconcile 后围栏仍满」，与新语义等价——**既有难度曲线数据有效，无需重建快照**。
