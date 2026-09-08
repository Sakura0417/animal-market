/* ToolsBar（VIEW）：底部道具栏 —— 吊车 / 翻转 / 洗牌（紫色方块 + 广告角标）。
 * 吊车：首次免费，之后每次看广告；激活态紫色辉光脉冲（cranePulse）。
 * 用尽态 45% 透明度并禁点。render 全量重建（3 个按钮，低频调用）。 */
import { Graphics, Node, tween, UIOpacity } from 'cc';
import { colA, drawArrowIcon, drawClaw, drawShuffleIcon, drawToolBtn, drawVideoBadge, makeLabel, newG } from './Draw2D';
import { icon64, place, placeC, wipeChildren } from './Ui';

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

  render(craneLeft: number, craneUsed: number, craneMode: boolean, flipLeft: number, shufLeft: number): void {
    this.build(0, {
      icon: g => drawClaw(g), icx: 32, icy: 25.5,
      title: '吊车',
      small: craneMode ? '点击被挡动物' : '×' + craneLeft,
      badge: craneUsed > 0,
      disabled: craneLeft <= 0 && !craneMode,
      active: craneMode,
      onTap: () => this.cb.onCrane(),
    });
    this.build(1, {
      icon: g => drawArrowIcon(g), icx: 32, icy: 32,
      title: '翻转',
      small: '×' + flipLeft,
      badge: true,
      disabled: flipLeft <= 0,
      active: false,
      onTap: () => this.cb.onFlip(),
    });
    this.build(2, {
      icon: g => drawShuffleIcon(g), icx: 32, icy: 26.7,
      title: '洗牌',
      small: '×' + shufLeft,
      badge: true,
      disabled: shufLeft <= 0,
      active: false,
      onTap: () => this.cb.onShuf(),
    });
  }

  private build(i: number, o: { icon: (g: Graphics) => void; icx: number; icy: number; title: string; small: string; badge: boolean; disabled: boolean; active: boolean; onTap: () => void }): void {
    const host = this.btns[i];
    wipeChildren(host);
    host.off(Node.EventType.TOUCH_END);
    const w = this.bw, h = 54;
    const { node, g } = newG('bg', w, h);
    drawToolBtn(g, w, h);
    node.setPosition(w / 2, -h / 2, 0);
    host.addChild(node);

    if (o.active) { // cranePulse：紫色辉光脉冲
      const glow = newG('glow', w, h);
      glow.g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 11);
      glow.g.strokeColor = colA('#e3d6ff', 90);
      glow.g.lineWidth = 5;
      glow.g.stroke();
      glow.node.setPosition(w / 2, -h / 2, 0);
      host.addChild(glow.node);
      const op = glow.node.addComponent(UIOpacity);
      tween(op).repeatForever(tween(op).to(0.5, { opacity: 40 }).to(0.5, { opacity: 190 })).start();
    }

    const ic = icon64('tic', 22, o.icon, 64, o.icx, o.icy);
    ic.setPosition(w / 2, -14, 0);
    host.addChild(ic);
    const t = makeLabel(o.title, 12.5, '#ffffff');
    placeC(t.node, w / 2, -33, w - 8, 15);
    host.addChild(t.node);
    const s = makeLabel(o.small, 9.5, '#ffffff', false);
    placeC(s.node, w / 2, -45, w - 8, 12);
    host.addChild(s.node);

    if (o.badge) {
      const b = icon64('ad', 17, gg => drawVideoBadge(gg), 38, 25, 32);
      b.setPosition(w - 6, -6, 0);
      host.addChild(b);
    }

    const op = host.getComponent(UIOpacity) ?? host.addComponent(UIOpacity);
    op.opacity = o.disabled ? 115 : 255;
    if (!o.disabled) host.on(Node.EventType.TOUCH_END, o.onTap);
  }
}
