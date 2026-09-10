/* ToolsBar（VIEW）：底部道具栏 —— 吊车 / 翻转 / 洗牌（紫色方块 + 广告角标）。
 * 吊车：首次免费，之后每次看广告；激活态紫色辉光脉冲（cranePulse）。
 * 用尽态 45% 透明度并禁点。render 全量重建（3 个按钮，低频调用）。
 * 修改时间：2026-09-10 21:41 —— 吊车与翻转/洗牌同构：① render 去掉 craneUsed 参数
 *   （2026-09-10 21:41 起吊车每次使用都需看广告，不再有"首次免费"⇒ 广告角标改为常显）；
 * 2026-09-10 19:55 —— 视觉规范统一：① 主图标尺寸走 ICON_PX.tool（光学 23.2，
 *   原 22 且 crane 被拉伸 14%）；② 广告角标改 placeCornerBadge 贴角不再越界；
 *   ③ 禁用态抽 DISABLED_OPACITY、补按下反馈走统一 PRESS_SCALE（原先只有 TOUCH_END，无按下态）。
 * 2026-09-10 18:33 —— 图标接 IconArt（PNG sprite + 矢量回退双层），
 *   道具 icon 字段改为 { asset, icon }：asset=PNG 名，icon=矢量回退绘制。 */
import { Graphics, Node, tween, UIOpacity } from 'cc';
import { colA, drawArrowIcon, drawClaw, drawShuffleIcon, drawToolBtn, drawVideoBadge, estTextW, makeLabel, newG, RADIUS } from './Draw2D';
import { ICON_FILL, ICON_PX, iconArt } from './IconArt';
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
    place(node, left, top, w, 54);
    parent.addChild(node);
    this.node = node;
    this.bw = (w - 16) / 3;
    for (let i = 0; i < 3; i++) {
      const b = new Node('tool' + i);
      place(b, i * (this.bw + 8), 0, this.bw, 54);
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
      title: '翻转',
      small: '×' + flipLeft,
      badge: true,
      disabled: flipLeft <= 0,
      active: false,
      onTap: () => this.cb.onFlip(),
    });
    this.build(2, {
      asset: 'shuffle',
      icon: g => drawShuffleIcon(g), icx: 32, icy: 26.7,
      title: '洗牌',
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
    const w = this.bw, h = 54;
    /* 纵向节奏（2026-09-10）：底板视觉范围 = -PLATE_TOP_SINK .. -h（drawToolBtn 内部按 h-3 画），
     * 内容 = 图标光学高 + ICON_GAP + 文案行高，整体在底板内上下等距。
     * 用光学高而不是方框高：ICON_PX.tool 的方框有 20% 透明留白，按方框排版会视觉下坠。 */
    const PLATE_TOP = -3;
    const plateH = PLATE_TOP + h;                   // 底板可视高 = 51（-3 .. -54）
    const ICON_OPT = ICON_PX.tool * ICON_FILL;      // 23.2
    const ICON_GAP = 5;
    const TXT_H = 13;
    const TITLE_FS = 12.5, SMALL_FS = 9.5, ROW_GAP = 4;
    const pad = (plateH - (ICON_OPT + ICON_GAP + TXT_H)) / 2;   // 上下等距留白 = 4.9
    const iconCy = PLATE_TOP - pad - ICON_OPT / 2;              // -19.5
    const rowCy = PLATE_TOP - pad - ICON_OPT - ICON_GAP - TXT_H / 2;   // -42.6
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
    placeC(t.node, left + tW / 2, rowCy, tW + 8, TXT_H);
    host.addChild(t.node);
    const s = makeLabel(o.small, SMALL_FS, '#ffffff', false);
    s.label.enableWrapText = false;
    placeC(s.node, left + tW + ROW_GAP + sW / 2, rowCy, sW + 8, TXT_H);
    host.addChild(s.node);

    if (o.badge) {
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
