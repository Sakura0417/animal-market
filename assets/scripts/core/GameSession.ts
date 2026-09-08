/* 对局状态机（core 层核心，禁止 import 'cc'，可 Node 直跑）
 * 修改时间：2026-09-08 17:55 —— 修 0/0 显示 bug：makeOrder 偶数化升级为「优先减 q≥2 / 退化删 q=1 项」+ 防御层 delete items<1；ParkView.syncNeeds 加 need<=0 过滤；
 *   2026-09-08 00:04 —— D8 调参轮：makeOrder 单种数量上限改概率闸门 ORDER_QTY3_P（恒2太松/恒3超调，p=0.4 入带）；
 *   2026-09-07 23:30 —— 需求 #2 强化：smartDir 后调用 breakAllHeadOnPairs 定点消除 2-环"对冲对"（hasBlockCycle 仅做兜底拒绝采样）；
 *  2026-09-07 16:30 —— P1 网格化（C1/B3/B4）：
 *   ① generate() 改网格落位：gridLayout 从 6×10=60 格随机取不重复格，动物/岩石各占一整格
 *     （旧 scatter 散点 + 40 次重摇废止）；朝向 smartDir(col,row)；保留 unlocked≥6 + 互锁环拒绝采样。
 *   ② useShuffle() 改 reflow 空格间重排（旧散点重摇废止）。
 *   ③ Animal 构造改 new Animal（col/row 为位置真相源，x/yu 为格中心派生 getter）。
 * 历次：2026-09-06 23:00 闪光倍率收编 + isFenceHopeless；21:10 复活上限；20:20 T1 调参；19:47 seed 化。 */
import type { BestSale, LevelConfig, Match, Order, Phase, Rng, Slot, TakeOutcome } from './Types';
import { Animal } from './Types';
import { allLocked, blockerOf, breakAllHeadOnPairs, countFence, countUnlocked, gridLayout, hasBlockCycle, herdLeft, isBlocked, randDir, reflow, shuffle, smartDir, unlockedCountOf, unlockedSet } from './Board';
import { levelCfg } from './LevelCfg';
import { CRANE_MAX, DEFAULT_SEED, FENCE_MAX, FLIP_MAX, HP_MAX, ORDER_QTY3_P, REVIVE_MAX, SHUF_MAX, SLOT_OPEN, SLOT_TOTAL, TYPE_MAP, TYPES } from './Constants';
import { mulberry32 } from './Seed';

export class GameSession {
  level = 1;
  cfg: LevelConfig = levelCfg(1);
  herd: Animal[] = [];
  fence: Animal[] = [];
  slots: Slot[] = [];
  slotsOpen = SLOT_OPEN;
  coins = 0;
  ordersDone = 0;
  hp = HP_MAX;
  /** 本局已用复活次数（2026-09-06 21:10 新增，P5/C5：上限 REVIVE_MAX）。 */
  revivesUsed = 0;
  craneLeft = CRANE_MAX;
  flipLeft = FLIP_MAX;
  shufLeft = SHUF_MAX;
  phase: Phase = 'play';
  soldByType: Record<string, { n: number; rare: number }> = {};
  bestSale: BestSale | null = null;
  /** 当前 session 种子（2026-09-06 19:09 新增）；DEFAULT_SEED(-1) 表示走全局 Math.random。 */
  seed: number = DEFAULT_SEED;
  /** 调度随机源（2026-09-06 19:09 新增）；seed=-1 时为全局 Math.random，传具体 seed 时为 mulberry32(seed)。 */
  rng: Rng = Math.random;

  private uidSeq = 1;

  /** 启动一局（2026-09-06 19:09 改造：新增可选 seed 参数）。
   *  - 不传 seed / 传 -1：调度走全局 Math.random（sim 链路注入 mulberry32 时可对拍；玩家真实游玩每次不可预测）
   *  - 传 seed≥0：调度走 mulberry32(seed)，同 seed 双跑 100% 一致（用于回放/Debug） */
  start(level: number, seed: number = DEFAULT_SEED): void {
    this.level = Math.max(1, Math.min(30, level | 0));
    this.cfg = levelCfg(this.level);
    this.fence = [];
    this.coins = 0;
    this.ordersDone = 0;
    this.hp = HP_MAX;
    this.revivesUsed = 0;                  // P5/C5（2026-09-06 21:10）：复活计数每局重置
    this.craneLeft = CRANE_MAX;
    this.flipLeft = FLIP_MAX;
    this.shufLeft = SHUF_MAX;
    this.soldByType = {};
    TYPES.forEach(t => { this.soldByType[t.id] = { n: 0, rare: 0 }; });
    this.bestSale = null;
    this.slots = [];
    this.slotsOpen = SLOT_OPEN;
    for (let i = 0; i < SLOT_TOTAL; i++) {
      this.slots.push({ state: i < SLOT_OPEN ? 'empty' : 'locked', order: null, loaded: null });
    }
    this.phase = 'play';
    // seed 化调度：-1 哨兵走全局 Math.random，否则 mulberry32
    this.seed = seed;
    this.rng = (seed === DEFAULT_SEED) ? Math.random : mulberry32(seed);
    this.generate();
    this.tryDispatch();
  }

  isBlocked(b: Animal): boolean { return isBlocked(this.herd, b); }
  /** 走廊遮挡者查询（纯读，不消耗随机流；供 view 层碰撞动画定位，2026-09-06 02:15:00） */
  blockerOf(b: Animal): Animal | null { return blockerOf(this.herd, b); }
  herdLeftCount(): number { return herdLeft(this.herd); }
  fenceCount(): Record<string, number> { return countFence(this.fence); }
  countUnlocked(): number { return countUnlocked(this.herd); }
  unlockedSet(): number[] { return unlockedSet(this.herd); }
  allLocked(): boolean { return allLocked(this.herd); }
  isWin(): boolean { return herdLeft(this.herd) === 0 && this.fence.length === 0; }
  canPlay(): boolean { return this.phase === 'play'; }
  markOutcome(p: Phase): void { this.phase = p; }

  private generate(): void {
    const HERD_N = this.cfg.herdN, ROCK_N = this.cfg.rocks, TYPE_COUNT = this.cfg.typeCount;
    let tries = 0, un;
    do {
      this.herd = [];
      // P1/B3 网格落位：60 格随机取 HERD_N+ROCK_N 个不重复格，前 HERD_N 给动物、其余给岩石
      const cells = gridLayout(HERD_N + ROCK_N, this.rng);
      for (let m = 0; m < HERD_N; m++) {
        const a = new Animal({
          uid: this.uidSeq++, type: TYPES[m % TYPE_COUNT], dir: 'up',
          rare: this.rng() < this.cfg.rareP, obstacle: false
        });
        a.col = cells[m].col;
        a.row = cells[m].row;
        a.dir = smartDir(a.col, a.row, this.rng);
        this.herd.push(a);
      }
      for (let r = 0; r < ROCK_N; r++) {
        const rock = new Animal({
          uid: this.uidSeq++, type: TYPES[0], dir: 'up',
          rare: false, obstacle: true
        });
        rock.col = cells[HERD_N + r].col;
        rock.row = cells[HERD_N + r].row;
        this.herd.push(rock);
      }
      // 2026-09-07 23:30 防御层：定点消除 2-环"对冲对"（A↔B 路径正面相对）。
      // 先消除 2-环再做后续判定：hasBlockCycle 仍兜底 3/4+ 环，零石场景下 3+ 环极罕见但保留保险。
      // 该步在 smartDir 之后、countUnlocked/hasBlockCycle 之前——避免 2-环先计入 un 拉低初始可动数。
      breakAllHeadOnPairs(this.herd, this.rng);
      un = countUnlocked(this.herd);
      tries++;
      // 互锁环拒绝采样（相邻遮挡下环仅 2/4 长度、出现率大降，保留作兜底；
      //   出现频率见 tools/test-cyclerate.ts，40 次上限兜底退化接受）。
    } while ((un < 6 || hasBlockCycle(this.herd)) && tries < 40);
  }

  activeOrders(): Slot[] {
    return this.slots.filter(function (s) { return s.state !== 'empty' && s.state !== 'locked' && s.order; });
  }

  /** 生成一笔订单（2026-09-06 19:09 改造）。
   *  - 末车模式：totalAvail ≤ 6 时一单收完所有剩余（HERD_N 偶数 + ≥2 强制 → 剩余永远是偶数，不会剩 1）
   *  - ≥2 硬约束：正常模式 sum(items) < 2 时强行补到 2（避免发 1 只单，PRD 收购机制要求）
   *  - 所有随机源切到 this.rng，不再读全局 Math.random */
  makeOrder(): Order | null {
    const alive: Record<string, number> = {};
    this.herd.forEach(function (a) { if (!a.obstacle) alive[a.type.id] = (alive[a.type.id] || 0) + 1; });
    this.fence.forEach(function (a) { alive[a.type.id] = (alive[a.type.id] || 0) + 1; });
    const reserved: Record<string, number> = {};
    this.activeOrders().forEach(function (s) {
      for (const id in s.order!.items) reserved[id] = (reserved[id] || 0) + s.order!.items[id];
    });
    const avail: Record<string, number> = {};
    for (const id2 in alive) {
      const free = alive[id2] - (reserved[id2] || 0);
      if (free > 0) avail[id2] = free;
    }
    let ids = Object.keys(avail);
    if (!ids.length) return null;

    // 场上动物总量（herd 非障碍 + fence，未扣订单预定）——末车模式的触发基准。
    // 语义依据（用户需求 4 原文）："当后期场上动物数量减少时……最后一辆车恰好收完剩余全部"
    // → 触发看"场上还剩多少"，而不是"扣除在途订单预定后还剩多少"。
    // 2026-09-06 20:20 修正：原实现误用 totalAvail（扣预定后）作触发，导致中盘
    // （如 18 只在场、3 单预定 12、可用 6）提前发"收全部"大单，L3-5 挤爆率 0-3% → 19-21%。
    let aliveTotal = 0;
    for (const idAlive in alive) aliveTotal += alive[idAlive];
    // 可分配数量（扣预定后）——末车订单的实际构成基准
    const totalAvail = ids.reduce(function (sum, id) { return sum + avail[id]; }, 0);

    // === 末车模式：场上动物总量 ≤ 6 → 新发订单收完所有"可用"剩余 ===
    // 数学保证不剩 1：HERD_N 全偶数 + 每张订单（含预定中的）总只数 ≥2
    //   ⇒ 场上总量恒为偶数、被预定量恒为偶数 ⇒ 可用量恒为偶数（0/2/4/6），永不为 1。
    if (aliveTotal <= 6) {
      // 可用 = 0：全部动物已被在途订单预定，无需发车，等在途订单完成即可
      // （ids 非空保证 totalAvail ≥ 1，此处仅防御语义）
      if (totalAvail < 1) return null;
      // ⚠️ 尾单豁免（2026-09-06 20:20，需用户确认）：清仓/放生广告会以任意数量移除
      // 围栏动物，破坏"场上剩余恒偶"不变量 → 可用量可能为 1 → 若禁止发单则必然软锁。
      // 正常游玩（未清仓）可用量恒为偶数，totalAvail=1 不可达，≥2 硬约束不受影响。
      const fenceCnt = countFence(this.fence);
      // 末车不受 orderKinds 上限约束：一张订单覆盖全部可用种类，确保"恰好收完、
      // 不遗漏不超收"——每种按其可用量封顶贪心装入（2026-09-06 20:20 修复超收 bug：
      // 旧实现把全场可用总量塞给单一种类，产生 {鸡:4} 而鸡仅 2 只的死单 → 挤爆/卡死）。
      const chosen = ids.slice().sort(function (a, b) { return (fenceCnt[b] || 0) - (fenceCnt[a] || 0); });
      const items: Record<string, number> = {};
      let remaining = totalAvail;
      for (let k = 0; k < chosen.length && remaining > 0; k++) {
        const id = chosen[k];
        const take = Math.min(avail[id], remaining);
        if (take > 0) { items[id] = take; remaining -= take; }
      }
      let value = 0;
      for (const id in items) value += TYPE_MAP[id].price * items[id];
      value = Math.max(5, Math.round(value * (1.1 + this.rng() * 0.5) / 5) * 5);
      return { items: items, value: value };
    }

    // === 正常模式（保留原概率分布，注入 rng） ===
    const openIds = ids.filter(id3 => unlockedCountOf(this.herd, id3) > 0);
    if (openIds.length && this.rng() < 0.75) ids = openIds;
    const fenceCnt = countFence(this.fence);
    ids = ids.slice().sort(function (a, b) { return (fenceCnt[b] || 0) - (fenceCnt[a] || 0); });
    const maxKinds = Math.min(this.cfg.orderKinds, ids.length);
    let n = (ids.length >= 2 && maxKinds >= 2 && this.rng() < 0.6) ? 2 : (maxKinds >= 3 && this.rng() < 0.3 ? 3 : 1);
    n = Math.min(n, maxKinds);
    const chosen = this.rng() < 0.8 ? ids.slice(0, n) : shuffle(ids.slice(), this.rng).slice(0, n);
    const items: Record<string, number> = {};
    let value = 0;
    // 单种数量上限：每笔订单开单时摇一次（ORDER_QTY3_P），命中则本单每种最多 3 只、否则 2 只。
    // D8 调参轮 2026-09-07 23:40 引入：恒 2 太松、恒 3 太难，概率闸门用于把挤爆率落在目标带。
    const qtyCap = this.rng() < ORDER_QTY3_P ? 3 : 2;
    chosen.forEach(id => {
      const q = 1 + Math.floor(this.rng() * Math.min(qtyCap, avail[id]));
      items[id] = q;
      value += TYPE_MAP[id].price * q;
    });

    // === ≥2 硬约束（PRD 收购机制要求，每辆车 ≥2 只动物） ===
    let total = chosen.reduce(function (s, id) { return s + (items[id] || 0); }, 0);
    if (total < 2) {
      const firstId = chosen[0];
      if (avail[firstId] >= 2) {
        items[firstId] = 2;
        total = 2;
      } else {
        // 凑不出 ≥2（极端边界：单种且只剩 1 只）→ 让 tryDispatch 不发新车
        return null;
      }
    }

    // === 偶数化（2026-09-06 20:20 修复"卖不掉"根因；2026-09-08 17:55 修 0/0 显示）===
    // 不变量：HERD_N 偶数 + 每张订单总和偶数 ⇒ 场上剩余恒偶 ⇒ 末车永不剩 1。
    // 反例：3 种类各 1 只 = 3（奇）→ 吃掉 invariant → 终局剩 1 只无法凑 ≥2 → 死局。
    // 修正方向选"减 1"而非"加 1"（T1 轮 3）：订单变小 → 围栏挤爆压力下降。
    // 奇数总和必 ≥3 ⇒ 减 1 后仍 ≥2。
    //
    // ⚠️ 2026-09-08 17:55 修复"0/0"显示 bug：旧逻辑 `items[id]--` 在 q=1 时减成 0、
    //   残留在 items map 中没被清掉，导致视图显示「该物种 0/0」（@image#1 截图）。
    //   新策略分两级：
    //   ① 优先减一个 q≥2 的项（保持种类数，items 仍全部 ≥ 1）；
    //   ② 退化：减一个 q=1 的项并**从 items/chosen 中彻底删除**（避免残留 0）；
    //   ③ 防御层：兜底 delete items 中任何 < 1 的残留（万一别处逻辑产生）。
    if (total % 2 !== 0) {
      let fixed = false;
      // ① 优先减 q≥2 项
      for (const id of chosen) {
        if ((items[id] || 0) >= 2 && total - 1 >= 2) { items[id]--; fixed = true; break; }
      }
      // ② 退化：减 q=1 项并删除
      if (!fixed) {
        for (const id of chosen) {
          if ((items[id] || 0) === 1 && total - 1 >= 2) {
            delete items[id];
            const idx = chosen.indexOf(id);
            if (idx >= 0) chosen.splice(idx, 1);
            fixed = true; break;
          }
        }
      }
      total = chosen.reduce(function (s, id) { return s + (items[id] || 0); }, 0);
    }
    // ③ 防御层：清理任何 < 1 的残留（不变量：items map value ≥ 1，视图才不会出 0/0）
    for (const id in items) {
      if (!items[id] || items[id] < 1) delete items[id];
    }

    value = 0;
    for (const id in items) value += TYPE_MAP[id].price * items[id];
    value = Math.max(5, Math.round(value * (1.1 + this.rng() * 0.5) / 5) * 5);
    return { items: items, value: value };
  }

  /** 调度新车（2026-09-06 19:09 改造：slot 处理顺序按种子洗牌）。
   *  原固定 for-i 顺序改为对 [0..slotsOpen) 数组洗牌后遍历。
   *  同一 seed 下调度顺序 100% 一致；不传 seed 时每次随机。 */
  tryDispatch(): void {
    if (this.phase !== 'play') return;
    const order = shuffle(
      Array.from({ length: this.slotsOpen }, function (_, i) { return i; }),
      this.rng
    );
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const s = this.slots[i];
      if (s.state !== 'empty') continue;
      const o = this.makeOrder();
      if (!o) return;
      s.order = o;
      s.state = 'truck';
    }
  }

  aliveCount(id: string): number {
    let n = 0;
    this.herd.forEach(function (a) { if (!a.obstacle && a.type.id === id) n++; });
    this.fence.forEach(function (a) { if (a.type.id === id) n++; });
    return n;
  }

  orderSatisfiable(o: Order | null): boolean {
    if (!o) return false;
    for (const id in o.items) {
      if (this.aliveCount(id) < o.items[id]) return false;
    }
    return true;
  }

  /** 满载判败（用户需求 3，2026-09-06 23:00 新增）：围栏满 且 没有任何在途卡车订单
   *  可被围栏现有动物满足 → true（允许判挤爆失败）；false = 存在可满足订单，
   *  view 层应先装车放行续局。纯读判定：不走 findMatch（其内部洗牌会消耗随机流），
   *  也不改任何状态——语义与 BalanceSim「reconcile 后围栏仍满 = failfence」一致，
   *  模拟器曲线数据无需重建。 */
  isFenceHopeless(): boolean {
    if (this.fence.length < FENCE_MAX) return false;
    const cnt = countFence(this.fence);
    for (const s of this.slots) {
      if (s.state !== 'truck' || !s.order) continue;
      let ok = true;
      for (const id in s.order.items) {
        if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
      }
      if (ok) return false;
    }
    return true;
  }

  /** 查找可被围栏满足的订单（2026-09-06 19:09 改造：slot 扫描顺序按种子洗牌）。
   *  原固定 for-i 改为对 [0..SLOT_TOTAL) 洗牌后遍历；满足优先级（卡车可走）逻辑保持原貌。 */
  findMatch(): Match | null {
    const cnt = countFence(this.fence);
    const order = shuffle(
      Array.from({ length: SLOT_TOTAL }, function (_, i) { return i; }),
      this.rng
    );
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const s = this.slots[i];
      if (s.state !== 'truck' || !s.order) continue;
      let ok = true;
      for (const id in s.order.items) {
        if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
      }
      if (!ok) continue;
      const taken: Animal[] = [];
      const picked: Record<number, 1> = {};
      for (const id1 in s.order.items) {
        let needN = s.order.items[id1];
        for (let q = 0; q < this.fence.length && needN > 0; q++) {
          const a = this.fence[q];
          if (picked[a.uid]) continue;
          if (a.type.id === id1 && !a.rare) { picked[a.uid] = 1; taken.push(a); needN--; }
        }
        for (let q = 0; q < this.fence.length && needN > 0; q++) {
          const b = this.fence[q];
          if (picked[b.uid]) continue;
          if (b.type.id === id1) { picked[b.uid] = 1; taken.push(b); needN--; }
        }
      }
      return { slotIdx: i, taken: taken };
    }
    return null;
  }

  takeAnimal(uid: number, crane = false): TakeOutcome {
    if (this.phase !== 'play') return { kind: 'noop' };
    let a: Animal | null = null;
    for (let k = 0; k < this.herd.length; k++) if (this.herd[k].uid === uid) { a = this.herd[k]; break; }
    if (!a || a.obstacle) return { kind: 'noop' };
    const blocked = isBlocked(this.herd, a);
    if (blocked && crane) {
      this.craneLeft--;
      this.herd.splice(this.herd.indexOf(a), 1);
      this.fence.push(a);
      return { kind: 'crane', animal: a, fenceLen: this.fence.length };
    }
    if (blocked) {
      this.hp--;
      return { kind: 'collide', animal: a, hpLeft: this.hp };
    }
    this.herd.splice(this.herd.indexOf(a), 1);
    this.fence.push(a);
    return { kind: 'fly', animal: a, fenceLen: this.fence.length };
  }

  private trackBest(a: Animal): void {
    const v = a.type.price * (a.rare ? a.type.rareMultiplier : 1);
    if (!this.bestSale || v > this.bestSale.value) {
      this.bestSale = { id: a.type.id, name: (a.rare ? '闪光' : '') + a.type.name, rare: a.rare, value: v };
    }
  }

  beginFulfill(match: Match): { value: number; rareBonus: number } {
    const s = this.slots[match.slotIdx];
    let rareBonus = 0;
    match.taken.forEach(a => {
      this.fence.splice(this.fence.indexOf(a), 1);
      this.trackBest(a);
      this.soldByType[a.type.id].n++;
      if (a.rare) { rareBonus += a.type.price * 2; this.soldByType[a.type.id].rare++; }
    });
    this.coins += s.order!.value + rareBonus;
    this.ordersDone++;
    s.state = 'loading';
    s.loaded = [];
    return { value: s.order!.value, rareBonus: rareBonus };
  }

  pushLoaded(slotIdx: number, a: Animal): void {
    const s = this.slots[slotIdx];
    if (s.loaded) s.loaded.push(a);
  }

  departSlot(slotIdx: number): void {
    this.slots[slotIdx].state = 'leaving';
  }

  settleSlot(slotIdx: number): void {
    const s = this.slots[slotIdx];
    s.state = 'empty';
    s.order = null;
    s.loaded = null;
    if (this.phase === 'play') this.tryDispatch();
  }

  fulfillNow(match: Match): void {
    this.beginFulfill(match);
    this.settleSlot(match.slotIdx);
  }

  abandonOrder(slotIdx: number): void {
    const s = this.slots[slotIdx];
    s.state = 'empty';
    s.order = null;
  }

  /** 翻转道具（2026-09-06 19:09 改造：randDir 注入 rng） */
  useFlip(): boolean {
    if (this.flipLeft <= 0) return false;
    this.flipLeft--;
    this.herd.forEach(a => { if (!a.obstacle) a.dir = randDir(this.rng); });
    return true;
  }

  /** 洗牌道具（P1/B4，2026-09-07 16:30 改造：reflow 空格间重排，个体/朝向不变） */
  useShuffle(): boolean {
    if (this.shufLeft <= 0) return false;
    this.shufLeft--;
    reflow(this.herd, this.rng);
    return true;
  }

  unlockSlot(i: number): boolean {
    if (this.slots[i].state !== 'locked') return false;
    this.slotsOpen = Math.max(this.slotsOpen, i + 1);
    this.slots[i].state = 'empty';
    this.tryDispatch();
    return true;
  }

  /** 卖出一部分围栏动物（2026-09-06 19:09 改造：rng 注入） */
  releaseSome(n: number): number {
    let refund = 0;
    const m = Math.min(n, this.fence.length);
    for (let k = 0; k < m; k++) {
      const idx = Math.floor(this.rng() * this.fence.length);
      const a = this.fence.splice(idx, 1)[0];
      refund += Math.floor(a.type.price * (a.rare ? a.type.rareMultiplier : 1) * 0.5);
    }
    this.coins += refund;
    return refund;
  }

  sellAll(): number {
    let refund = 0;
    this.fence.forEach(a => { refund += Math.floor(a.type.price * (a.rare ? a.type.rareMultiplier : 1) * 0.7); });
    this.fence = [];
    this.coins += refund;
    return refund;
  }

  /** 本局是否还有复活机会（P5/C5，2026-09-06 21:10 新增；上限 REVIVE_MAX）。 */
  canRevive(): boolean {
    return this.revivesUsed < REVIVE_MAX;
  }

  /** 复活：回满 3 心原地续局（营收保留）。超 REVIVE_MAX 后调用无效（P5/C5 守卫）。 */
  revive(): boolean {
    if (!this.canRevive()) return false;
    this.revivesUsed++;
    this.hp = HP_MAX;
    return true;
  }

  addCrane(n = 1): void {
    this.craneLeft += n;
  }

  isStuck(): boolean {
    if (herdLeft(this.herd) > 0) return false;
    if (this.fence.length === 0) return false;
    const cnt = countFence(this.fence);
    for (let i = 0; i < SLOT_TOTAL; i++) {
      const s = this.slots[i];
      if (s.state !== 'truck' || !s.order) continue;
      let ok = true;
      for (const id in s.order.items) {
        if ((cnt[id] || 0) < s.order.items[id]) { ok = false; break; }
      }
      if (ok) return false;
    }
    return this.makeOrder() === null;
  }
}
