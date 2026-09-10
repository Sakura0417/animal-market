/* Panels（VIEW）：模态面板系统 —— 挤爆/生命耗尽/滞销/通关/开局须知 + Mock 广告层。
 * （暂停面板 pause 已随 HUD 暂停钮移除，2026-09-10）
 * 结构：modal（全屏暗遮罩 + 吞触摸）→ panelHost（锚点0.5,1 从中心向下生长，
 * 布局完成后 y = h/2 回到垂直居中）→ 内容游标自上而下堆叠。
 * 通关面板带 win-pop 弹性弹出（原型 cubic-bezier(.3,1.5,.5,1) ≈ back-out）。
 * 修改时间：2026-09-10 21:41 —— ① failFence 由 4 项砍为 2 项（吊车放生 3 只·看广告 / 重开），
 *   去掉"清仓大甩卖"与"发好友求救"（用户需求：失败转化位只留广告 + 重开两条出路）；
 *   ② failHp 复活文案"回满 3 颗"→"回 1 颗"（core REVIVE_HP=1 配套）。
 * 2026-09-08 —— 通关面板售出统计动物图标改统一 animalIcon（矢量占位+sprite 切换）；
 *   2026-09-06 21:10 —— P5：① failHp 增 canRevive 参数（C5 复活上限 2/局，
 *   超限不渲染复活广告按钮）；② win 增 stars 参数渲染星级行（C3 星级按剩余生命结算）。
 *   00:36 —— 修复 begin() wipeChildren 误毁持久面板底板的渲染 bug（详见 begin 内注释）。 */
import { Label, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { col, colA, drawCoin, makeLabel, newG, wrapTextByWidth } from './Draw2D';
import { animalIcon } from './AnimalArt';
import { ICON_PX, iconArt } from './IconArt';
import { mkBtn, place, placeC, swallow, wipeChildren } from './Ui';

export interface PanelBtn {
  kind: 'primary' | 'blue' | 'green' | 'ghost';
  title: string;
  note?: string;
  onTap?(): void;
}

const PW = 320; // 面板宽（原型 max-width 320）
const SUB_X = -140; // 副文案左缘（面板左缘 -160 起留 20 缩进）

export class Panels {
  readonly node: Node;
  readonly adNode: Node;
  private host: Node;
  private bg: ReturnType<typeof newG>;
  private cursor = 0;
  private adT: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: Node, w: number, h: number) {
    // 模态遮罩
    const { node, g } = newG('modal', w, h);
    g.rect(-w / 2, -h / 2, w, h);
    g.fillColor = colA('#465668', 140);
    g.fill();
    node.active = false;
    swallow(node);
    parent.addChild(node);
    this.node = node;
    // 面板宿主
    const host = new Node('panelHost');
    const hu = host.addComponent(UITransform);
    hu.setAnchorPoint(0.5, 1);
    host.setPosition(0, 0, 0);
    node.addChild(host);
    this.host = host;
    this.bg = newG('panelbg', PW, 10);
    this.bg.node.setPosition(0, 0, 0);
    host.addChild(this.bg.node);
    // Mock 广告层（浅色全屏，位于遮罩之上）
    const ad = newG('adoverlay', w, h);
    ad.g.rect(-w / 2, -h / 2, w, h);
    ad.g.fillColor = col('#f2f6fa');
    ad.g.fill();
    ad.node.active = false;
    swallow(ad.node);
    parent.addChild(ad.node);
    this.adNode = ad.node;
  }

  hide(): void {
    this.node.active = false;
  }

  /** 广告演示层：3 秒倒计时（DevAdapter 注入的 display） */
  ad(onDone: () => void): void {
    if (this.adT !== null) { clearTimeout(this.adT); this.adT = null; }
    this.adNode.active = true;
    wipeChildren(this.adNode);
    const tag = makeLabel('SIMULATED REWARDED AD', 12, '#8b95a3', false);
    placeC(tag.node, 0, 56, 220, 16);
    this.adNode.addChild(tag.node);
    const count = makeLabel('3', 44, '#e07f10');
    placeC(count.node, 0, 0, 100, 56);
    this.adNode.addChild(count.node);
    const note = makeLabel('广告播放中（演示）…', 12, '#8b95a3', false);
    placeC(note.node, 0, -48, 220, 16);
    this.adNode.addChild(note.node);
    let n = 3;
    const tick = () => {
      n--;
      if (n <= 0) {
        this.adT = null;
        this.adNode.active = false;
        onDone();
      } else {
        count.label.string = String(n); // 修复（2026-09-06 01:20:00）：makeLabel 包装对象需写 .label.string
        this.adT = setTimeout(tick, 1000);
      }
    };
    this.adT = setTimeout(tick, 1000);
  }

  adCancel(): void {
    if (this.adT !== null) { clearTimeout(this.adT); this.adT = null; }
    this.adNode.active = false;
  }

  /* ---------- 布局游标 ---------- */

  private begin(winPop = false): void {
    this.node.active = true;
    // 持久底板先摘下再清场（2026-09-06 00:36:00 修复：wipeChildren 会 destroy 面板底板，
    //   之后 addChild 回已销毁节点导致白色面板永不渲染——预览冒烟发现的 R1 类问题）
    if (this.bg.node.parent === this.host) this.host.removeChild(this.bg.node);
    wipeChildren(this.host);
    this.host.addChild(this.bg.node);
    this.cursor = 22;
    if (winPop) {
      this.host.setScale(0.6, 0.6, 1);
      this.host.setPosition(0, 0, 0);
      tween(this.host).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'back-out' }).start();
    } else {
      this.host.setScale(0.92, 0.92, 1);
      this.host.setPosition(0, 0, 0);
      tween(this.host).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'back-out' }).start();
    }
  }

  private end(): void {
    const h = this.cursor + 20;
    const hu = this.host.getComponent(UITransform)!;
    hu.setContentSize(PW, h);
    this.host.setPosition(0, h / 2, 0);
    this.bg.g.clear();
    this.bg.g.roundRect(-PW / 2, -h, PW, h, 16);
    this.bg.g.fillColor = col('#ffffff');
    this.bg.g.fill();
    this.bg.g.strokeColor = col('#e6ecf1');
    this.bg.g.lineWidth = 1;
    this.bg.g.stroke();
  }

  private title(s: string, pop = false): void {
    const t = makeLabel(s, 18, '#4b4237');
    placeC(t.node, 0, -(this.cursor + 12), PW - 40, 24);
    this.host.addChild(t.node);
    if (pop) {
      t.node.setScale(0.3, 0.3, 1);
      tween(t.node).delay(0.18).to(0.57, { scale: new Vec3(1, 1, 1) }, { easing: 'back-out' }).start();
    }
    this.cursor += 24 + 8;
  }

  /** 副文案（12.5px，左对齐 x=-140 起）。
   *  2026-09-10 加按宽断行：Label 是 Overflow.NONE（**忽略 contentSize 按原文宽度渲染**），
   *  此前单行原样输出，超宽文案会直接冲出面板右缘——实测
   *  `第N关 · 牧场已清空但围栏剩 N 只无人要 · 营收 N` = 335.8 > 可用 300。
   *  现改为超宽自动折行，游标按**实际行数**前进，面板高度随之自适应。 */
  private sub(lines: string[]): void {
    const MAX_W = PW / 2 - 16 - SUB_X;      // 面板右缘留 16 的安全边距
    lines.forEach(l => {
      for (const row of wrapTextByWidth(l, MAX_W, 12.5)) {
        const t = makeLabel(row, 12.5, '#8b95a3', false);
        t.label.horizontalAlign = Label.HorizontalAlign.LEFT;   // 修：旧代码写 t.horizontalAlign（挂在包装对象上，从未生效）
        t.label.enableWrapText = false;      // 已手动断行，禁止引擎再折
        t.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
        t.node.setPosition(SUB_X, -this.cursor, 0);
        this.host.addChild(t.node);
        this.cursor += 19;
      }
    });
    this.cursor += 6;
  }

  private gap(h: number): void {
    this.cursor += h;
  }

  private btn(b: PanelBtn): void {
    const n = mkBtn({ w: 272, kind: b.kind, title: b.title, note: b.note, onTap: () => b.onTap?.() });
    placeC(n, 0, -(this.cursor + (b.note ? 52 : 44) / 2), 272, b.note ? 52 : 44);
    this.host.addChild(n);
    this.cursor += (b.note ? 52 : 44) + 9;
  }

  /* ---------- 各面板 ---------- */

  intro(onStart: () => void): void {
    this.begin();
    this.title('动物集市 · 开局须知');
    this.sub([
      '1. 点击动物送进围栏。被挡住的也能点，',
      '   但会撞到前面的动物，扣 1 颗生命',
      '   （共 3 颗，扣完失败）',
      '2. 上方停车位里的卡车各收不同动物，',
      '   围栏凑齐订单就自动装车收钱',
      '3. 围栏只有 7 格，装不下会挤爆；',
      '   后两个车位可看广告解锁',
      '4. 把牧场和围栏的动物全部卖空即通关',
      '   被挡的宝贝用吊车吊走不扣生命',
    ]);
    this.btn({ kind: 'primary', title: '开始营业', onTap: onStart });
    this.end();
  }

  /** 围栏挤爆：两条出路 —— 看广告吊车放生 3 只（续局）/ 重开。
   *  2026-09-10 21:41 用户需求：删除"清仓大甩卖·看广告"与"发好友求救·免费"两项，
   *  失败转化位收敛为「广告续局 + 免费重开」，与生命耗尽面板结构对齐（保持"广告在上、重开在下"）。 */
  failFence(onRelease: () => void, onRestart: () => void): void {
    this.begin();
    this.title('围栏挤爆了！');
    this.sub(['7 格围栏已满，且当前订单无法完成。']);
    this.btn({ kind: 'blue', title: '吊车放生 3 只 · 看广告', note: '返还基础价 50% 金币 · 继续本局', onTap: onRelease });
    this.btn({ kind: 'ghost', title: '放弃重开（免费）', onTap: onRestart });
    this.end();
  }

  failHp(left: number, canRevive: boolean, onRevive: () => void, onRestart: () => void): void {
    this.begin();
    this.title('生命值耗尽！');
    this.sub(['小动物们撞来撞去，牧场围栏被撞坏了', '牧场还剩 ' + left + ' 只没卖掉']);
    // C5（2026-09-06 21:10）：本局复活次数用尽（REVIVE_MAX）后不提供广告复活位
    if (canRevive) {
      // 2026-09-10 21:41：回血数由 3 改 1（core REVIVE_HP 配套，文案不得再写死数字）
      this.btn({ kind: 'blue', title: '生命恢复 1 颗 · 看广告', note: '原地继续本局 · 已卖营收保留', onTap: onRevive });
    } else {
      this.sub(['今日复活次数已用完，试试重开一局吧']);
    }
    this.btn({ kind: 'ghost', title: '放弃重开（免费）', onTap: onRestart });
    this.end();
  }

  noStock(level: number, fenceN: number, coins: number, onRestart: () => void): void {
    this.begin();
    this.title('剩下的动物卖不动了');
    this.sub(['第' + level + '关 · 牧场已清空但围栏剩 ' + fenceN + ' 只无人要 · 营收 ' + coins]);
    this.btn({ kind: 'green', title: '重进一批 · 再战本关', onTap: onRestart });
    this.end();
  }

  win(o: {
    level: number; coins: number; ordersDone: number; stars: number;
    stats: { id: string; n: number; rare: number }[];
    doubled: boolean; hasNext: boolean;
    onDouble?(): void; onNext(): void; onRestart(): void;
  }): void {
    this.begin(true);
    this.title('牧场清空 · 收市！', true);
    this.sub(['第' + o.level + '关通过 · 售出 ' + o.ordersDone + ' 车 · 牧场动物全部卖光']);
    // 星级行（C3，2026-09-06 21:10）：按剩余生命结算，复活过封顶 1 星（GameView 计算）
    const starRow = new Node('stars');
    placeC(starRow, 0, -(this.cursor + 14), PW - 40, 28);
    this.host.addChild(starRow);
    for (let k = 0; k < 3; k++) {
      const st = makeLabel(k < o.stars ? '★' : '☆', 24, k < o.stars ? '#f5b301' : '#dfe6ec', false);
      placeC(st.node, (k - 1) * 34, 0, 34, 28);
      starRow.addChild(st.node);
    }
    this.cursor += 28 + 4;
    // 大金币行
    const row = new Node('coinrow');
    placeC(row, 0, -(this.cursor + 17), PW - 40, 34);
    this.host.addChild(row);
    const ci = iconArt('coin', ICON_PX.panel, drawCoin, 64, 32, 32, undefined, 'coin-win');
    ci.setPosition(-18, 0, 0);
    row.addChild(ci);
    const cn = makeLabel(String(o.coins), 26, '#e07f10');
    placeC(cn.node, 14, 0, 120, 32);
    row.addChild(cn.node);
    this.cursor += 34 + 6;
    // 售出统计行
    if (o.stats.length) {
      const st = new Node('stats');
      placeC(st, 0, -(this.cursor + 17), PW - 40, 34);
      this.host.addChild(st);
      const cellW = Math.min(56, (PW - 48) / o.stats.length);
      const totalW = cellW * o.stats.length;
      o.stats.forEach((s, k) => {
        const cx = -totalW / 2 + cellW * k + cellW / 2;
        const ic = animalIcon('s' + s.id, 18, s.id);
        ic.setPosition(cx, 4, 0);
        st.addChild(ic);
        const lb = makeLabel('×' + s.n + (s.rare > 0 ? ' 闪' + s.rare : ''), 9.5, s.rare > 0 ? '#c98a00' : '#5a6a78', false);
        placeC(lb.node, cx, -11, cellW - 2, 12);
        st.addChild(lb.node);
      });
      this.cursor += 34 + 8;
    } else {
      this.cursor += 6;
    }
    if (o.doubled) {
      const t = makeLabel('✓ 营收已翻倍', 13, '#2f9e4f');
      placeC(t.node, 0, -(this.cursor + 16), 200, 18);
      this.host.addChild(t.node);
      this.cursor += 18 + 8;
    } else {
      this.btn({ kind: 'blue', title: '双倍营收 · 看广告', onTap: o.onDouble });
    }
    this.btn({
      kind: 'green',
      title: o.hasNext ? '下一关 · 第' + (o.level + 1) + '关' : '全部通关 · 再战一轮',
      onTap: o.onNext,
    });
    this.btn({ kind: 'ghost', title: '再玩本关', onTap: o.onRestart });
    this.end();
  }
}

/** 屏幕中心偏移辅助：h2(x) = 面向 placeC 的 y 坐标（ad 层用，居中向上排） */
function h2(y: number): number {
  return y;
}
