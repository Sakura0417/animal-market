# T5 · A5 特效对拍 Checklist（原型 game.js V4.1 ↔ Cocos 实现）

> **状态**：🔄 代码对照完成（本表），视觉逐项签收待执行（与 T4 预览合并进行，硬刷新后过一遍即可勾完）
> **判定规则**：每项三选一——✅ 一致 / 🔧 修（记录改动）/ 🤝 明确接受差异（写理由）。
> 全部项有结论 = T5 关闭。

## 一、逐特效对照

| # | 特效 | 原型实现 | Cocos 实现 | 代码判定 | 视觉签收 |
|---|---|---|---|---|---|
| 1 | 入栏飞行（未挡） | `flyAnimal` 42px 弧线飞围栏 | `FxService.flyAnimal` + 14:05 改为 `walkPath` 沿土路多段折线（10:05 需求迭代，**有意差异**） | 🤝 接受：土路行走替换弧线飞，需求拍板 | |
| 2 | 装车飞卡车 | `flyAnimal` 34px 飞 truckPt | `fulfillSlot` 逐只飞 + cargo 落货回弹 | ✅ | |
| 3 | 金币飞 HUD | `flyCoin` | `FxService.flyCoin`（coinsShown 等飞达才更新，原型同款） | ✅ | |
| 4 | 碰撞粒子爆开 | `spawnBurst(pt, n)` | `FxService.burst(pt, 8)` 接触点触发 | ✅ | |
| 5 | 飘字 | `floatText(pt, txt, big)` | `FxService.floatText` / `floatTextLocal`（-1 生命/生命耗尽/🎉 牧场清空） | ✅ | |
| 6 | 震屏 | `phoneShake` | `FxService.shake(design)` | ✅ | |
| 7 | 彩带金币雨 | `spawnConfetti` | `FxService.confetti(w, h)`（win 链） | ✅ | |
| 8 | 受击红闪 | bonk 点亮红闪 | `AnimalNode.bonk(dir, hitDist, onImpact)`：sprite 模式 = tint 红（11:30 美术接入改） | ✅（sprite 模式需签收） | |
| 9 | 心碎 HUD | 心逐颗碎 | `lostHeartIdx` → renderHud 消费 | ✅ | |
| 10 | win 面板弹性弹出 | cubic-bezier(.3,1.5,.5,1) | `Panels.begin(true)` back-out ≈ 同款 | ✅ | |
| 11 | 生命耗尽黯淡 | 原型无（V2.0 新增 C4） | `dimBoard` UIOpacity→140 渐变 0.25s | 🤝 增项：PRD 2.0 新需求，原型不存在 | |
| 12 | 通关大飘字 | `floatText big` | `floatText(🎉 牧场清空！, true)` | ✅ | |
| 13 | 车位解锁反馈 | toast + 新车入场 | `toast.show('新车位解锁！')` + renderPark | ✅ | |
| 14 | 动物朝向表达 | SVG 箭头指示 | sprite 模式 = 朝向即运动方向（**有意差异**，art-spec v1.1 拍板）；vector 模式保留箭头 | 🤝 接受：美术升级替换 | |
| 15 | 动画代数防护 | fxGen 作废旧回调 | 同款 fxGen + unscheduleAllCallbacks 双保险 | ✅ | |

## 二、sprite 模式专属签收项（11:30 美术接入新增，无原型对照基准）

| # | 项 | 预期 | 签收 |
|---|---|---|---|
| S1 | 素材缺失回退 | 改错资源名 → console.warn + 自动回退矢量，游戏不崩 | |
| S2 | 尺寸一致性 | 六物种在围栏/牧场显示大小一致（144×144 等比，基线对齐无漂移） | |
| S3 | rare 金光环 | 金光环叠加位置贴合 sprite 主体 | |
| S4 | 压暗效果 | C4 全场压暗对 sprite 同样生效（UIOpacity 挂容器，应生效） | |

## 三、结论

- 代码层 15 项：12 项一致、3 项有意差异（#1 土路行走 / #11 黯淡增项 / #14 朝向表现），无需修复；
- 待办：第一节视觉签收列 + 第二节 S1-S4，随 T4 预览一次过完 → 本文件回填 → T5 关闭。
