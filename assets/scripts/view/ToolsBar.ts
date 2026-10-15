/* ToolsBar（VIEW）：底部道具栏 —— 吊车 / 转身 / 挪窝（紫色方块 + 广告角标）。
 * 吊车：每次使用都看激励视频（2026-09-10 起已取消"首次免费"）；激活态紫色辉光脉冲（cranePulse）。
 * 用尽态 45% 透明度并禁点。render 全量重建（3 个按钮，低频调用）。
 * 修改时间：2026-09-26 23:01 —— 修「按钮文字超出底板」（用户反馈）：根因是布局常量与 Label 真实
 *   行框不符 —— makeLabel 内部行框 = round(fs×1.35)，标题 12px ⇒ **16**，而代码写 TXT_H=13
 *   （拍出来的数）。字号 11→12 后该偏差吃光余量：像素反推实测文字底距底板底仅 2.3 设计单位、
 *   图标底与字形顶几乎相接。修法：① 行框改显式 `ROW_LH = 15`（1.25×fs）并写进两个 Label；
 *   ② `ICON_PX.tool` 29 → 26（光学 20.8）。核算：内容块 20.8+4+15 = 39.8 ⇒ pad 2.6，
 *   iconCy −16.0 / rowCy −37.9，顶底留白对称 2.6/2.6，图标↔文案间隙 4.0（原为重叠）。
 *   2026-09-26 22:41 —— 按钮文案放大（方案 C）：标题 11 → 12、计数 8.5 → 9.5、
 *   TXT_H 12 → 13；按钮高 48 与 plateH 45 不动，靠留白 2.9 → 2.4 换空间，行中心逐像素不变。
 *   2026-09-10 21:41 —— 吊车与转身/挪窝同构：① render 去掉 craneUsed 参数
 *   （2026-09-10 21:41 起吊车每次使用都需看广告，不再有"首次免费"⇒ 广告角标改为常显）；
 * 2026-09-19 —— 广告角标接入 `AD_ENABLED` 总开关（关闭时不渲染，见 build 内注释）。
 * 2026-09-24 17:35 —— ① 道具文案「翻转」→「转身」、「洗牌」→「挪窝」（贴合农场动物主题）；
 *   ② 按钮高度 54 → 48（构造两处 + build 内 h 三处同步），纵向排版由 h 派生自动按 plateH 重算。
 * 2026-09-24 18:16 —— ① 按钮字体随高度等比缩小：TITLE 12.5→11 / SMALL 9.5→8.5、TXT_H 13→12、
 *   ICON_GAP 5→4、ROW_GAP 4→3（pad=2.9 居中）——文案行与缩矮后的按钮匹配；②（配合 Draw2D）去按钮描边。
 * 2026-09-10 19:55 —— 视觉规范统一：① 主图标尺寸走 ICON_PX.tool（光学 23.2，
 *   原 22 且 crane 被拉伸 14%）；② 广告角标改 placeCornerBadge 贴角不再越界；
 *   ③ 禁用态抽 DISABLED_OPACITY、补按下反馈走统一 PRESS_SCALE（原先只有 TOUCH_END，无按下态）。
 * 2026-09-10 18:33 —— 图标接 IconArt（PNG sprite + 矢量回退双层），
 *   道具 icon 字段改为 { asset, icon }：asset=PNG 名，icon=矢量回退绘制。 */
import { Graphics, Node, tween, UIOpacity } from 'cc';
import { colA, drawArrowIcon, drawClaw, drawShuffleIcon, drawToolBtn, drawVideoBadge, estTextW, LABEL_HIRES, makeLabel, newG, RADIUS } from './Draw2D';
import { ICON_FILL, ICON_PX, iconArt } from './IconArt';
import { AD_ENABLED } from '../platform/AdConfig';   // 广告总开关：关闭时不渲染广告角标（页面零广告元素）
import { DISABLED_OPACITY, place, placeC, placeCornerBadge, PRESS_SCALE, wipeChildren } from './Ui';

export interface ToolsCallbacks {
  onCrane(): void;
  onFlip(): void;
  onShuf(): void;
}

export class ToolsBar {
  readonly node: Node;
  private btns: Node[] = [];
  private bw: number;

  constructor(parent: Node, left: number, top: number, w: number, private cb: ToolsCallbacks) {
    const node = new Node('tools');
    place(node, left, top, w, 48);
    parent.addChild(node);
    this.node = node;
    this.bw = (w - 16) / 3;
    for (let i = 0; i < 3; i++) {
      const b = new Node('tool' + i);
      place(b, i * (this.bw + 8), 0, this.bw, 48);
      node.addChild(b);
      this.btns.push(b);
    }
  }

  render(craneLeft: number, craneMode: boolean, flipLeft: number, shufLeft: number): void {
    this.build(0, {
      asset: 'crane',
      icon: g => drawClaw(g), icx: 32, icy: 25.5,
      title: '吊车',
      small: craneMode ? '点击被挡动物' : '×' + craneLeft,
      badge: true,
      disabled: craneLeft <= 0 && !craneMode,
      active: craneMode,
      onTap: () => this.cb.onCrane(),
    });
    this.build(1, {
      asset: 'flip',
      icon: g => drawArrowIcon(g), icx: 32, icy: 32,
      title: '转身',
      small: '×' + flipLeft,
      badge: true,
      disabled: flipLeft <= 0,
      active: false,
      onTap: () => this.cb.onFlip(),
    });
    this.build(2, {
      asset: 'shuffle',
      icon: g => drawShuffleIcon(g), icx: 32, icy: 26.7,
      title: '挪窝',
      small: '×' + shufLeft,
      badge: true,
      disabled: shufLeft <= 0,
      active: false,
      onTap: () => this.cb.onShuf(),
    });
  }

  private build(i: number, o: { asset: string; icon: (g: Graphics) => void; icx: number; icy: number; title: string; small: string; badge: boolean; disabled: boolean; active: boolean; onTap: () => void }): void {
    const host = this.btns[i];
    wipeChildren(host);
    // 全量重建 → 三类触摸回调都要先解绑，否则 render 每次都叠一份（按下会多次 setScale）
    host.off(Node.EventType.TOUCH_START);
    host.off(Node.EventType.TOUCH_END);
    host.off(Node.EventType.TOUCH_CANCEL);
    const w = this.bw, h = 48;
    /* 纵向节奏（2026-09-10）：底板视觉范围 = -PLATE_TOP_SINK .. -h（drawToolBtn 内部按 h-3 画），
     * 内容 = 图标光学高 + ICON_GAP + 文案行高，整体在底板内上下等距。
     * 用光学高而不是方框高：ICON_PX.tool 的方框有 20% 透明留白，按方框排版会视觉下坠。 */
    const PLATE_TOP = -3;
    const plateH = PLATE_TOP + h;                   // 底板可视高 = 45（-3 .. -48）
    const ICON_OPT = ICON_PX.tool * ICON_FILL;      // 20.8（ICON_PX.tool 29→26，见 IconArt）
    const ICON_GAP = 4;
    /* 2026-09-26 22:41（方案 C）：标题 11 → 12、计数 8.5 → 9.5 —— 真机 11px 已在阅读舒适线之下，
       且底部按钮是高频点击目标，字号偏小与"按钮已缩到 48 高"叠加后更显弱。
       行宽复核：最长的"吊车 + 点击被挡动物" = 24 + 3 + 57 = 84 < 按钮宽 111.7（左右各余 13.8）。

       2026-09-26 23:01（用户："底部按钮文字有点超出按钮范围"）—— **根因是布局常量与真实行框不符**：
       makeLabel 内部行框 = round(fs × 1.35)，标题 12px ⇒ 行框 **16**，而这里原先写 TXT_H = 13。
       13 是"拍出来的数"，不是 Label 的真实占位。字号 11→12 后这个偏差把余量吃光：
       实测截图（像素反推）文字底距底板底仅 **2.3 设计单位**、图标底与字形顶几乎相接，
       视觉上就是"文字要掉出按钮"。
       修法（第一性原理：让布局常量 = 实际占位）：① 行框改用真实值 ROW_LH 并显式写进 Label
       （makeLabel 默认 ×1.35 的行框对 12px 偏松，显式收到 15 = 1.25×fs，中文仍不挤）；
       ② 图标 29→26（光学 20.8）腾出 2.4 —— 两处各让一步，换回上下对称留白。
       核算：内容块 = 20.8 + 4 + 15 = 39.8 ⇒ pad = (45−39.8)/2 = **2.6**（原 2.4 但文字行框 16 溢出），
       iconCy = −16.0、rowCy = −37.9；图标字形占 5.6..26.4、文案行框占 30.4..45.4
       ⇒ 顶留白 2.6 / 底留白 2.6 对称，图标↔文案间隙 4.0（原为重叠）。 */
    const TITLE_FS = 12, SMALL_FS = 9.5, ROW_GAP = 3;
    const ROW_LH = 15;                                          // 文案行框（显式，见上）
    const pad = (plateH - (ICON_OPT + ICON_GAP + ROW_LH)) / 2;  // 上下等距留白 = 2.6
    const iconCy = PLATE_TOP - pad - ICON_OPT / 2;              // -16.0
    const rowCy = PLATE_TOP - pad - ICON_OPT - ICON_GAP - ROW_LH / 2;   // -37.9
    const { node, g } = newG('bg', w, h);
    drawToolBtn(g, w, h);
    node.setPosition(w / 2, -h / 2, 0);
    host.addChild(node);

    if (o.active) { // cranePulse：紫色辉光脉冲
      const glow = newG('glow', w, h);
      glow.g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, RADIUS.card - 1);
      glow.g.strokeColor = colA('#e3d6ff', 90);
      glow.g.lineWidth = 5;
      glow.g.stroke();
      glow.node.setPosition(w / 2, -h / 2, 0);
      host.addChild(glow.node);
      const op = glow.node.addComponent(UIOpacity);
      tween(op).repeatForever(tween(op).to(0.5, { opacity: 40 }).to(0.5, { opacity: 190 })).start();
    }

    const ic = iconArt(o.asset, ICON_PX.tool, o.icon, 64, o.icx, o.icy, undefined, 'tic');
    ic.setPosition(w / 2, iconCy, 0);
    host.addChild(ic);

    /* 文案行（2026-09-10 用户要求：标题与计数**同一行、不换行**）
     * 此前 12.5px 标题与 9.5px 计数分两行堆在图标下（按钮内共 3 行，视觉上就是"换行"）。
     * 改为一行内两个 Label 并排、整行居中：靠 estTextW 估宽算整行宽度，再把两个 Label
     * 分别居中摆到各自槽位；两个 Label 都关掉 enableWrapText（硬保证不换行）。 */
    const tW = estTextW(o.title, TITLE_FS);
    const sW = estTextW(o.small, SMALL_FS);
    const rowW = tW + ROW_GAP + sW;
    const left = w / 2 - rowW / 2;
    const t = makeLabel(o.title, TITLE_FS, '#ffffff');
    t.label.enableWrapText = false;
    // 行框显式对齐布局 token（makeLabel 默认 ×1.35=16 会在 39.8 的内容块外多占 1px，
    //   把文字整体压低 —— 这正是"文字超出按钮"的机制）。×LABEL_HIRES 抵消 2x 高清化的 0.5 缩放。
    t.label.lineHeight = ROW_LH * LABEL_HIRES;
    placeC(t.node, left + tW / 2, rowCy, tW + 8, ROW_LH);
    host.addChild(t.node);
    const s = makeLabel(o.small, SMALL_FS, '#ffffff', false);
    s.label.enableWrapText = false;
    s.label.lineHeight = ROW_LH * LABEL_HIRES;   // 与标题同框高，两 Label 垂直中心才严格同高
    placeC(s.node, left + tW + ROW_GAP + sW / 2, rowCy, sW + 8, ROW_LH);
    host.addChild(s.node);

    // 广告角标（2026-09-19）：开关关闭时不渲染 —— 单一收口在此，
    //   调用点的 `badge: true` 无需改动，未来新增按钮也自动遵守"关闭即零广告元素"。
    if (o.badge && AD_ENABLED) {
      // 贴角不越界（2026-09-10）：此前写死 (w-6,-6)，角标半宽 10.5 会戳出按钮右/上边缘
      const b = iconArt('video', ICON_PX.badge, drawVideoBadge, 38, 25, 32, undefined, 'ad');
      host.addChild(b);
      placeCornerBadge(b, w, ICON_PX.badge);
    }

    const op = host.getComponent(UIOpacity) ?? host.addComponent(UIOpacity);
    op.opacity = o.disabled ? DISABLED_OPACITY : 255;
    // 状态：disabled 只降不透明且不挂点击；其余走统一按下比例（尺寸比例与常态完全一致）
    if (!o.disabled) {
      host.on(Node.EventType.TOUCH_START, () => host.setScale(PRESS_SCALE, PRESS_SCALE, 1));
      host.on(Node.EventType.TOUCH_END, () => { host.setScale(1, 1, 1); o.onTap(); });
      host.on(Node.EventType.TOUCH_CANCEL, () => host.setScale(1, 1, 1));
    }
  }
}
