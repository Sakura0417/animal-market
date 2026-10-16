# 《动物集市》高保真原型 · Design Contract（冻结版）

## Meta
- 技术栈: plain HTML + CSS + vanilla JS · **纯静态、零外部依赖、双击离线可开**
- 交付目录: `e:\traeWork\6a9ae4d49c9f09b0a04bfe61\animal-market-prototype\`
- 主题: **亮色卡通（唯一主题，禁止暗色/深色样式）**——用户明确指定对标挪车/猪了个猪系的明亮休闲风
- 页面语言: 中文。文案面向"45 岁三四线城市女性"画像：口语化、大字号、大按钮。
- 内容依据: `e:\traeWork\6a9ae4d49c9f09b0a04bfe61\animal-market-prd\animal-market-prd.html`（PRD V1.1：停车位+牧场散落版）

## Style Tier & Aesthetic
- style: brand-themed（白天农场 · 亮色卡通休闲小游戏 UI，对标挪车/猪了个猪系）
- aesthetic: 天空蓝→草绿渐变底 + 白色圆角卡片 + 橙黄厚按钮；游戏化组件（渐变按钮带底部深色描边、圆角卡片、发光稀有态）；场景有氛围（草地斜纹、虚线牧场围栏、公路带停车位），**禁止平涂纯色背景**
- tone: 明快、热闹、可信赖（收钱爽感），克制不花哨

## Design Tokens（唯一色源，页面禁止新增 hex；以 styles.css `:root` 为准）
```
--bg:     #e9f1f8   底色（浅蓝白）
--bg2:    #ffffff   卡片白
--bg3:    #f0f4f8   浮起面板/格子底
--ink:    #4b4237   主文字（暖棕黑）
--muted:  #8b95a3   次文字（灰蓝）
--rule:   #e3e9ef   边框
--gold:   #ff9d2b   主 CTA（橙黄）
--gold-deep: #e07f10 按钮底部描边
--green:  #58c06c   成功/草绿
--sky:    #3d9ee0   信息蓝（少量）
--danger: #ff6f61   危险/失败
--rare:   #ffb800   稀有闪光金
页面背景: linear-gradient(180deg, #dde9f2, #e9f1f8)
字体: --font-body: 'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif
      --font-num: ui-monospace,'Cascadia Mono','JetBrains Mono',Consolas,monospace（所有数字）
字阶: 12 / 13 / 15 / 17 / 20 / 24 / 32 px（游戏内文字整体偏大）
圆角: sm8 / md12 / lg18
间距: 4px 基（4/8/12/16/24/32）
按钮: 橙黄渐变实心(linear-gradient #ffb14e→#ff9d2b) + border-bottom:3px var(--gold-deep) + 按下位移1px；禁用 opacity .38
阴影: 0 4px 10px rgba(255,157,43,.35)（主按钮）· 卡片轻投影，无重影
```

## 图标规范（Lucide 内联 SVG，禁 emoji 当图标）
- **动物与金币渲染一律走 `animals.js` 的 SVG**（`AM.animals.svg(id)`/`coin()`/`truck(color,stripe)`/`arrow()` 等），禁止用 emoji 渲染动物/金币；emoji 仅允许：静态占位、mock 数据字段（`AM.DB.animals[].emoji`）、角色头像、弹窗标题装饰字（🎉💥等）。
- UI 图标一律内联 Lucide SVG：`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</svg>`；`.ic` 尺寸由 CSS 控制（16/20/24）。
- 统一图标库（名称→用途）：home 首页 / play 开始 / trophy 结算 / book-open 图鉴 / sprout 农场 / calendar-days 每日挑战 / gift 签到 / coins 金币 / star 星级 / video 广告 / share-2 分享 / x 关闭 / check 完成 / lock 锁 / users 排行 / medal 名次 / flame 连续 / truck 卡车 / refresh-cw 重开 / timer 时限 / bell 提醒 / pause 暂停 / arrow-left 返回
- 图标 SVG 代码（直接复制，含 path）：

```html
home:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
play:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
trophy:       <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
book-open:    <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>
sprout:       <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>
calendar-days:<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
gift:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
coins:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
star:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
video:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
share-2:      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
x:            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
check:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
lock:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
users:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
medal:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>
flame:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
truck:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35a1 1 0 0 0-.78-.38H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
refresh-cw:   <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
timer:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>
bell:         <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
pause:        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
arrow-left:   <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
```

## App Shell（冻结骨架——每页逐字粘贴，只改 `data-page` 与 `.screen` 内内容）
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>页面名 · 动物集市</title>
<link rel="stylesheet" href="styles.css">
</head>
<body data-page="home">
  <aside class="rail">
    <div class="rail-brand">
      <span class="rail-logo">🐔</span>
      <div><b>动物集市</b><i>高保真原型 V1.0</i></div>
    </div>
    <nav class="rail-nav">
      <a data-nav="home" href="index.html">[home]<span>首页 · 农场</span></a>
      <a data-nav="game" href="game.html">[play]<span>对局 · 核心玩法</span></a>
      <a data-nav="settlement" href="settlement.html">[trophy]<span>过关结算</span></a>
      <a data-nav="collection" href="collection.html">[book-open]<span>动物图鉴</span></a>
      <a data-nav="farm" href="farm.html">[sprout]<span>农场升级</span></a>
      <a data-nav="daily" href="daily.html">[calendar-days]<span>每日挑战</span></a>
      <a data-nav="signin" href="signin.html">[gift]<span>每日签到</span></a>
    </nav>
    <p class="rail-note">依据 PRD V1.0 · 亮色卡通 · 离线可开</p>
  </aside>
  <main class="stage">
    <div class="phone">
      <div class="statusbar"><span class="sb-time">21:47</span><span class="sb-icons">▮▮▮ ᯤ 84%</span></div>
      <div class="screen screen--home">
        <!-- ▼▼ 页面内容只写在这里 ▼▼ -->
      </div>
    </div>
  </main>
  <script src="mock.js"></script>
  <script src="api.js"></script>
  <!-- 页面自有 <script>（inline）放这 -->
</body>
</html>
```
- `[图标名]` 处替换为上方图标库中**同名完整 SVG**（整段复制）。Shell 其余部分逐字节一致。
- 激活态规则（唯一机制，CSS 已写好）：`body[data-page="home"] .rail-nav a[data-nav="home"]`——页面只需设置自己的 `data-page`，**禁止手写 active 类**。
- `screen--<page>` 为页面专属类：`screen--game` 已在 styles.css 固定（禁滚动）；其余页面默认可滚动。

## 页内顶栏 Topbar（hub 页冻结片段——index/collection/farm/daily 顶部使用）
```html
<header class="topbar">
  <div class="tb-coins">[coins]<b class="num" data-am-coins>0</b></div>
  <a class="tb-mini" href="collection.html">[book-open]<span>图鉴 11/15</span></a>
</header>
```
- 金币数由 `mock.js` 的 `AM.syncCoins()` 自动填充到所有 `[data-am-coins]`，页面不写死。
- `tb-mini` 的"图鉴 11/15"各页统一写死为 11/15（与 mock 进度一致：6 普通全解锁 + 5 闪光，猪的闪光未解锁）。

## 页内底部 TabBar（hub 页冻结片段——仅 index/collection/farm/daily 四页含）
```html
<nav class="tabbar">
  <a data-tab="home" href="index.html">[home]<span>首页</span></a>
  <a data-tab="collection" href="collection.html">[book-open]<span>图鉴</span></a>
  <a data-tab="farm" href="farm.html">[sprout]<span>农场</span></a>
  <a data-tab="daily" href="daily.html">[calendar-days]<span>挑战</span></a>
</nav>
```
- 激活态同样由 `body[data-page="..."]` CSS 决定，禁止手写 active。
- game / settlement / signin 三页为沉浸态，**不含 tabbar**（符合真实游戏：对局/结算/弹窗无底栏）。

## Page List（7 页）
| 页面 | 文件 | 职责 | 关键组件 | 出口 |
|---|---|---|---|---|
| 首页·农场 | index.html | 主入口：农场夜景场景、当前关卡大 CTA、每日挑战横幅、签到红点 | topbar, tabbar, farm-hero(CSS 场景), card--cta | →game, →daily, →signin, →collection, →farm |
| 对局 | game.html | 核心玩法完整可玩（引擎 game.js V2：停车位+牧场散落版，经 1600 局模拟验证） | game HUD/停车位公路带(5车位·3开2广告锁)/围栏/牧场散点区/道具栏(吊车·翻转·洗牌)/失败面板/教学/广告模拟 | →settlement, →index |
| 过关结算 | settlement.html | 星级、营收、双倍金币广告、分享卡、Banner 位、下一关 | star 行, panel, ad-tag, share card | →game, →index |
| 动物图鉴 | collection.html | 12 基础卡(普通/闪光) + 3 隐藏稀有 + 进度 + 集齐奖励 | topbar, tabbar, col-grid, locked 卡 | →index |
| 农场升级 | farm.html | 8 件装饰购买（金币 sink）+ 预览条 + 加成说明 | topbar, tabbar, shop 卡, bar | →index |
| 每日挑战 | daily.html | 今日同题种子卡 + 好友榜/省份榜 + 击败百分比 | topbar, tabbar, rank list, tabs | →game |
| 每日签到 | signin.html | 7 日奖励、连续天数、今日领取 + 翻倍广告 | signin 行, flame, panel | →index |

## Mock Schema（mock.js 已实现，页面只读）
```
AM.DB.animals      6 种 {id,emoji,name,price}
AM.DB.collection   {id: {n, rare}} 卖出累计（鸡42/2、鸭31/1、兔28/3、羊19/1、猪12/0、牛7/1；隐藏三只 0）
AM.DB.hidden       [羊驼🦙、孔雀🦚、梅花鹿🦌] 第8关后3%混入
AM.DB.decorations  8 件 {id,name,emoji,price,desc}（鸡舍200/池塘350/羊圈500/谷仓800/风车1200/稻草人1600/果园2200/温室3000）
AM.DB.daily        {seed,theme,joined,score,beat,deadlineHours,friends:[{name,score,avatar}],province:[…]}
AM.DB.signin       {days:[{coins}×7], streak}
AM.wallet          get/add/spend（localStorage 持久化，初始 1280）
AM.progress(k,v)   通用 kv 持久化
AM.toast(msg)      页内 toast
AM.syncCoins()     同步全部 [data-am-coins]
```
- api.js：变更类操作走 `AM.api.buyDecoration / doSignin / fetchSettlement / …`（带 delay + `// TODO: 替换真实接口` 注释）；首屏渲染直接读 AM.DB（同步，避免异步挂载风险）。
- 跨页一致性：金币唯一来源 AM.wallet；图鉴进度 11/15；关卡进度第 5 关；对局结果经 localStorage `am_last_result` 传给结算页（无则用 mock 结果：第5关/3星/营收412/最贵成交 闪光牛150/剩余围栏5格）。

## 组件规范（styles.css 已实现，直接用类名）
- `.btn` 金色主按钮 / `.btn--green` / `.btn--ghost` 描边 / `.btn--video` 广告按钮（含 video 图标+`看广告`小字）/ `.btn--lg` / `.btn--sm` / `[disabled]`
- `.card` 面板卡 / `.card--cta` 主行动卡 / `.sec-title` 章节标题（图标+文字）/ `.rows`+`.row` 列表行
- `.chip`（-gold/-green/-red）小标签 / `.dot` 红点 / `.bar`+`.bar-fill` 进度条
- `.overlay`+`.panel` 模态 / `.toast`（用 AM.toast）/ `.ad-tag` 广告位标注 / `.num` 等宽数字
- 游戏内样式沿用 `d-*`（结构）与 `p-*`（牧场散点）类（game.js 自动生成 DOM，页面无需写）
- 对局 V2 布局（自上而下）：HUD → `.d-park` 停车位公路带（5 车位：3 默认 + 2 锁定看广告解锁，卡车即订单，多车位独立收单发车）→ `.d-fencebar` 围栏 7 格 → `.d-pen` 牧场散落区（非网格：拒绝采样散点，走廊式遮挡判定，方向箭头 40% 朝最近边）→ `.d-tools` 道具栏（吊车/翻转/洗牌）
- 页面专属布局类允许自建，前缀用页面名（home- / set- / col- / farm- / daily- / sig-），**颜色字体圆角必须用 var(--token)**，禁止新 hex、禁止新字体。

## Sub-Agent 硬性规则
1. 只写自己负责的页面文件；Shell/Topbar/Tabbar 逐字粘贴契约版本；不重排导航、不改导航样式。
2. 颜色/字号/圆角/间距只用 tokens；图标只用契约图标库（内联 SVG）；emoji 仅作游戏内容。
3. 交互必须真实可用：领取/购买/翻倍/切榜/返回都要有响应与状态变化；用 AM.toast 反馈。
4. 文案口语化贴合画像（"放生 3 只，回点血"式），禁止 lorem/占位文本。
5. 广告点全部用 `.btn--video` + 模拟广告弹层（参照 game.html 的 adOverlay 模式：全屏遮罩 + 倒计时 3 秒 + 完成回调）。
6. 完成后自查：无死链（所有 href 指向存在的文件）、无未定义变量、无重复 id。
