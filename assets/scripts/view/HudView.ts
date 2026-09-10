/* HudView（VIEW）：顶部 HUD —— 重开图标钮 + 木质关卡牌 + 生命值（心碎动画）
 * + 剩余进度胶囊 + 金币胶囊（飞币入账落点）。
 * 心形仅在 hp 变化时重建（renderHUD 高频调用，避免无谓 Graphics 重绘）。
 * 修改时间：2026-09-10 19:55 —— 视觉规范统一：① 图标钮 29×29 → **视觉 25×25 圆形 + 命中区 30×30**
 *   （与同排 25 高胶囊齐平）；② HUD 改**流式等距布局**（暂停钮移除后左侧曾空出 34px）；
 *   ③ 全排尺寸走 ICON_PX token，心形满/空两态光学高度对齐（原先灰心比红心小 60%）；
 *   ④ 按下反馈接入统一 PRESS_SCALE。
 * 2026-09-10 18:33 —— ① 暂停按钮移除（无实际功能，连 showPause/Panels.pause
 *   一并清退）；② 图标接 IconArt（PNG sprite + 矢量回退双层）。
 * 2026-09-06 01:50:00 —— 修复顶部错位：place() 重置锚点为 (0,1)，
 *   而图标/胶囊底板按中心绘制，直接 place 导致视觉左上偏移半宽/半高（顶部被裁、
 *   文字吊底）。统一改为 (0,1) 容器 + 居中底板子节点 setPosition(w/2,-h/2)。 */
import { Graphics, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { HP_MAX } from '../core/Constants';
import { col, colA, drawCoin, drawHeart, drawLevelPill, drawRestartIcon, makeLabel, newG } from './Draw2D';
import { ICON_PX, iconArt } from './IconArt';
import { icon64, PRESS_SCALE, place, placeC, whitePill } from './Ui';

export interface HudCallbacks {
  onRestart(): void;
}

/* HUD 布局 token（设计单位） */
const HUD_H = 34;        // HUD 条高（与 GameView.HUD_H 同值；此处自持，避免跨文件耦合）
const PILL_H = 25;       // 胶囊高（+ 25 圆形图标钮 = 同排统一高度）
const HIT = 30;          // 图标钮命中区边长（视觉 25，命中 30；见 iconBtn 注释）
const COIN_ICON_X = 6 + ICON_PX.hudChip / 2;   // 金币图标距胶囊左缘 6 的居中坐标

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
    place(node, left, top, w, HUD_H);
    parent.addChild(node);
    this.node = node;

    /* HUD 流式等距布局（2026-09-10）：
     * 此前各元素 x 写死（0/68/132/208/276），暂停钮移除后左侧空出 34px 无人补位（截图可见左侧凹陷）。
     * 改为「先定各元素宽度 → 剩余空间均分为间隙 → 从左到右顺次摆放」，首元素贴左、末元素贴右、
     * 间隙全等；列宽变化（宽屏/不同设计宽）时自动重排，无需再手改坐标。 */
    const BW = 25, LVW = 59, HPW = 71, PRW = 63, CNW = 75;   // 与下面对应元素的视觉宽一一对应
    const gap = (w - (BW + LVW + HPW + PRW + CNW)) / 4;
    let cx = 0;

    const restart = this.iconBtn(cx, BW, 'restart', g => drawRestartIcon(g));
    restart.on(Node.EventType.TOUCH_END, () => this.cb.onRestart());
    cx += BW + gap;

    /* 顶栏元素统一写法（2026-09-06 01:50:00 修复顶部错位）：
     * place() 会把节点锚点重置为 (0,1)=左上，而 newG/whitePill 的图形按中心绘制，
     * 直接 place 居中底板会让视觉整体左上偏移 半宽/半高（图标顶部被裁、文字吊底）。
     * 正确惯用法（与 ToolsBar 底板一致）：place 一个 (0,1) 容器，居中底板作为子节点
     * 放到容器中心 (w/2,-h/2)；容器内其它子元素继续按左上 CSS 坐标摆放。 */
    const PILL_TOP = (HUD_H - PILL_H) / 2;   // 25 高胶囊在 34 高条内垂直居中 → 4.5

    // 关卡木牌（d-lv：59×25）
    const lvHost = new Node('lv-pill');
    place(lvHost, cx, PILL_TOP, LVW, PILL_H);
    const lv = newG('lv', LVW, PILL_H);
    drawLevelPill(lv.g, LVW, PILL_H);
    lv.node.setPosition(LVW / 2, -PILL_H / 2, 0);
    lvHost.addChild(lv.node);
    const lb = makeLabel('第1关', 12, '#ffffff');
    placeC(lb.node, LVW / 2, -PILL_H / 2, LVW - 4, 16);
    lvHost.addChild(lb.node);
    node.addChild(lvHost);
    this.lvLabel = lb;
    cx += LVW + gap;

    // 生命胶囊（d-hp：3 颗心；心形 render() 里挂 hpHost，坐标按左上原点不变）
    const hpHost = new Node('hp-pill');
    place(hpHost, cx, PILL_TOP, HPW, PILL_H);
    const hp = whitePill(HPW, PILL_H);
    hp.node.setPosition(HPW / 2, -PILL_H / 2, 0);
    hpHost.addChild(hp.node);
    node.addChild(hpHost);
    this.hpHost = hpHost;
    cx += HPW + gap;

    // 进度胶囊（d-progress：剩 N 只）
    const progHost = new Node('prog-pill');
    place(progHost, cx, PILL_TOP, PRW, PILL_H);
    const prog = whitePill(PRW, PILL_H);
    prog.node.setPosition(PRW / 2, -PILL_H / 2, 0);
    progHost.addChild(prog.node);
    const pl = makeLabel('剩 0 只', 11, '#44613c');
    placeC(pl.node, PRW / 2, -PILL_H / 2, PRW - 4, 14);
    progHost.addChild(pl.node);
    node.addChild(progHost);
    this.progLabel = pl;
    cx += PRW + gap;

    // 金币胶囊（d-coin：右对齐）
    const coinHost = new Node('coin-pill');
    place(coinHost, cx, PILL_TOP, CNW, PILL_H);
    const coin = whitePill(CNW, PILL_H);
    coin.node.setPosition(CNW / 2, -PILL_H / 2, 0);
    coinHost.addChild(coin.node);
    const ci = iconArt('coin', ICON_PX.hudChip, drawCoin, 64, 32, 32, undefined, 'coin-hud');
    ci.setPosition(COIN_ICON_X, -PILL_H / 2, 0);    coinHost.addChild(ci);
    this.coinIcon = ci;
    const cl = makeLabel('0', 12, '#e07f10');
    placeC(cl.node, CNW - 28, -PILL_H / 2, 40, 15);
    coinHost.addChild(cl.node);
    node.addChild(coinHost);
    this.coinLabel = cl;
  }

  /**
   * HUD 图标按钮：**视觉 25×25 圆形 + 命中区 30×30**（2026-09-10）。
   * 解耦理由：视觉尺寸要跟同排胶囊（25 高）齐平才不突兀——此前 29×29 比胶囊高 4px，
   * 截图上上下各凸出 2px；但 25×25 作为触摸目标偏小，故把命中区放大到 30×30
   * （事件挂命中容器，视觉节点只是它的子节点），视觉统一与触控体验两者兼得。
   * 圆角取 h/2 = 全圆：同排元素（木牌除外）全是胶囊，圆形是这一行唯一的"协调解"。
   */
  private iconBtn(x: number, size: number, asset: string, draw: (g: Graphics) => void): Node {
    const host = new Node('ibtn-host');
    // x 指的是**视觉左缘**；命中区比视觉大，故左移差值，保证首元素视觉仍贴左（不被内缩 2.5px）
    place(host, x - (HIT - size) / 2, (HUD_H - HIT) / 2, HIT, HIT);
    const vb = new Node('ibtn-vis');
    vb.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
    vb.setPosition(HIT / 2, -HIT / 2, 0);               // 视觉在命中区内居中
    host.addChild(vb);
    const b = newG('ibtn', size, size);
    b.g.roundRect(-size / 2, -size / 2, size, size, size / 2);
    b.g.fillColor = colA('#ffffff', 235);
    b.g.fill();
    b.g.strokeColor = col('#e3e9ef');
    b.g.lineWidth = 1;
    b.g.stroke();
    vb.addChild(b.node);
    const ic = iconArt(asset, ICON_PX.hudBtn, draw, 64, 32, 32, undefined, 'ic');
    b.node.addChild(ic);
    // 按下态与全工程同比例（Ui.PRESS_SCALE）
    host.on(Node.EventType.TOUCH_START, () => host.setScale(PRESS_SCALE, PRESS_SCALE, 1));
    host.on(Node.EventType.TOUCH_END, () => host.setScale(1, 1, 1));
    host.on(Node.EventType.TOUCH_CANCEL, () => host.setScale(1, 1, 1));
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
        // 满心 = PNG 红心（iconArt，矢量红心兜底）；空心 = 矢量灰心（提供的 PNG 只有满心态）。
        // 尺寸对齐（2026-09-10）：两者必须渲染出同一光学高度，否则"第三颗灰心明显小一圈"。
        //   PNG 满心：光学 = px × 0.8 = 15.2（高 12.83，因内容 128×108）
        //   矢量灰心：drawHeart 的 64 空间外接盒（含 1.4 描边）实测 16.4×15.8，中心 (12,13.8)
        //            ⇒ 光学高 = 15.8 × (px/span)，令其 = 12.83 解得 span ≈ 23.4
        const h = i < hp
          ? iconArt('heart', ICON_PX.hudChip, g => drawHeart(g, false), 23.4, 12, 13.8, undefined, 'heart' + i)
          : icon64('heart' + i, ICON_PX.hudChip, g => drawHeart(g, true), 23.4, 12, 13.8);
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
