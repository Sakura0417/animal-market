/* HudView（VIEW）：顶部 HUD —— 暂停/重开图标钮 + 木质关卡牌 + 生命值（心碎动画）
 * + 剩余进度胶囊 + 金币胶囊（飞币入账落点）。
 * 心形仅在 hp 变化时重建（renderHUD 高频调用，避免无谓 Graphics 重绘）。
 * 修改时间：2026-09-06 01:50:00 —— 修复顶部错位：place() 重置锚点为 (0,1)，
 *   而图标/胶囊底板按中心绘制，直接 place 导致视觉左上偏移半宽/半高（顶部被裁、
 *   文字吊底）。统一改为 (0,1) 容器 + 居中底板子节点 setPosition(w/2,-h/2)。 */
import { Graphics, Node, Tween, tween, Vec3 } from 'cc';
import { HP_MAX } from '../core/Constants';
import { col, colA, drawCoin, drawHeart, drawLevelPill, drawPauseIcon, drawRestartIcon, makeLabel, newG } from './Draw2D';
import { icon64, place, placeC, whitePill } from './Ui';

export interface HudCallbacks {
  onPause(): void;
  onRestart(): void;
}

export class HudView {
  readonly node: Node;
  private hpHost: Node;
  private hearts: Node[] = [];
  private progLabel: ReturnType<typeof makeLabel>;
  private coinLabel: ReturnType<typeof makeLabel>;
  private coinIcon: Node;
  private lvLabel: ReturnType<typeof makeLabel>;
  private lastHp = -1;

  constructor(parent: Node, left: number, top: number, w: number, private cb: HudCallbacks) {
    const node = new Node('hud');
    place(node, left, top, w, 34);
    parent.addChild(node);
    this.node = node;

    const pause = this.iconBtn(0, g => drawPauseIcon(g));
    pause.on(Node.EventType.TOUCH_END, () => this.cb.onPause());
    const restart = this.iconBtn(34, g => drawRestartIcon(g));
    restart.on(Node.EventType.TOUCH_END, () => this.cb.onRestart());

    /* 顶栏元素统一写法（2026-09-06 01:50:00 修复顶部错位）：
     * place() 会把节点锚点重置为 (0,1)=左上，而 newG/whitePill 的图形按中心绘制，
     * 直接 place 居中底板会让视觉整体左上偏移 半宽/半高（图标顶部被裁、文字吊底）。
     * 正确惯用法（与 ToolsBar 底板一致）：place 一个 (0,1) 容器，居中底板作为子节点
     * 放到容器中心 (w/2,-h/2)；容器内其它子元素继续按左上 CSS 坐标摆放。 */

    // 关卡木牌（d-lv：59×25）
    const lvHost = new Node('lv-pill');
    place(lvHost, 68, 4, 59, 25);
    const lv = newG('lv', 59, 25);
    drawLevelPill(lv.g, 59, 25);
    lv.node.setPosition(29.5, -12.5, 0);
    lvHost.addChild(lv.node);
    const lb = makeLabel('第1关', 12, '#ffffff');
    placeC(lb.node, 29.5, -12.5, 55, 16);
    lvHost.addChild(lb.node);
    node.addChild(lvHost);
    this.lvLabel = lb;

    // 生命胶囊（d-hp：3 颗心；心形 render() 里挂 hpHost，坐标按左上原点不变）
    const hpHost = new Node('hp-pill');
    place(hpHost, 132, 4, 71, 25);
    const hp = whitePill(71, 25);
    hp.node.setPosition(35.5, -12.5, 0);
    hpHost.addChild(hp.node);
    node.addChild(hpHost);
    this.hpHost = hpHost;

    // 进度胶囊（d-progress：剩 N 只）
    const progHost = new Node('prog-pill');
    place(progHost, 208, 4, 63, 25);
    const prog = whitePill(63, 25);
    prog.node.setPosition(31.5, -12.5, 0);
    progHost.addChild(prog.node);
    const pl = makeLabel('剩 0 只', 11, '#44613c');
    placeC(pl.node, 31.5, -12.5, 59, 14);
    progHost.addChild(pl.node);
    node.addChild(progHost);
    this.progLabel = pl;

    // 金币胶囊（d-coin：右对齐）
    const coinHost = new Node('coin-pill');
    place(coinHost, 276, 4, 75, 25);
    const coin = whitePill(75, 25);
    coin.node.setPosition(37.5, -12.5, 0);
    coinHost.addChild(coin.node);
    const ci = icon64('coin', 15, g => drawCoin(g), 64, 32, 32);
    ci.setPosition(13.5, -12.5, 0);
    coinHost.addChild(ci);
    this.coinIcon = ci;
    const cl = makeLabel('0', 12, '#e07f10');
    placeC(cl.node, 47, -12.5, 40, 15);
    coinHost.addChild(cl.node);
    node.addChild(coinHost);
    this.coinLabel = cl;
  }

  private iconBtn(x: number, draw: (g: Graphics) => void): Node {
    // 修复（2026-09-06 01:50:00）：同顶部胶囊——(0,1) 容器 + 居中底板子节点，
    //   触摸事件挂容器（命中框与视觉一致）。
    const host = new Node('ibtn-host');
    place(host, x, 2, 29, 29);
    const b = newG('ibtn', 29, 29);
    b.g.roundRect(-14.5, -14.5, 29, 29, 10);
    b.g.fillColor = colA('#ffffff', 235);
    b.g.fill();
    b.g.strokeColor = col('#e3e9ef');
    b.g.lineWidth = 1;
    b.g.stroke();
    b.node.setPosition(14.5, -14.5, 0);
    host.addChild(b.node);
    const ic = icon64('ic', 17, draw, 64, 32, 32);
    b.node.addChild(ic);
    this.node.addChild(host);
    return host;
  }

  setLevel(n: number): void {
    // 修复（2026-09-06 01:20:00）：makeLabel 返回 {node,label} 包装对象，
    //   直接 .string 赋值只挂在包装对象上，真正的 Label 永不更新（R1 类存量 bug）
    this.lvLabel.label.string = '第' + n + '关';
  }

  /** 全量刷新：hp 变化时重建心形；lostIdx 指定刚失去的心（碎裂动画） */
  render(hp: number, left: number, coinsShown: number, lostIdx: number): void {
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      this.hearts.slice().forEach(h => h.destroy());
      this.hearts = [];
      for (let i = 0; i < HP_MAX; i++) {
        const h = icon64('heart' + i, 15, g => drawHeart(g, i >= hp), 24, 12, 13.8);
        // 修复（2026-09-06 02:10:00）：三心整体居中——3 心跨 57（间距 21），
        //   71 胶囊左右各留 7，首心中心 = 14.5（原 9 使心形组偏左 5.5）
        h.setPosition(14.5 + i * 21, -12.5, 0);
        this.hpHost.addChild(h);
        this.hearts.push(h);
        if (i === lostIdx) {
          const back = h.position.clone();
          tween(h)
            .to(0.17, { scale: new Vec3(1.6, 1.6, 1), angle: -16 })
            .to(0.17, { scale: new Vec3(0.7, 0.7, 1), angle: 12 })
            .to(0.21, { scale: new Vec3(1, 1, 1), angle: 0, position: back })
            .start();
        }
      }
      if (lostIdx >= 0) { // d-hp.shake：扣血时 HUD 抖动
        Tween.stopAllByTarget(this.hpHost);
        const b = this.hpHost.position.clone();
        tween(this.hpHost)
          .to(0.09, { position: new Vec3(b.x - 3, b.y, 0), angle: -3 })
          .to(0.09, { position: new Vec3(b.x + 3, b.y, 0), angle: 3 })
          .to(0.09, { position: new Vec3(b.x - 2, b.y, 0) })
          .to(0.09, { position: new Vec3(b.x + 2, b.y, 0) })
          .to(0.09, { position: b, angle: 0 })
          .start();
      }
    }
    // 修复（2026-09-06 01:20:00）：同 setLevel —— 需写入包装对象的 .label.string
    this.progLabel.label.string = '剩 ' + left + ' 只';
    this.coinLabel.label.string = String(coinsShown);
  }

  /** 金币图标世界坐标（flyCoin 终点） */
  coinWorld(): Vec3 {
    return this.coinIcon.worldPosition.clone();
  }
}
