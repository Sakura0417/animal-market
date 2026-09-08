/* 存档服务（SERVICES）：关卡进度 / 金币钱包 / 上局结算 / 每关最佳星级。
 * 键名与原型 localStorage 一致（am_level / am_wallet / am_last_result），便于迁移对拍；
 * am_stars 为 2026-09-06 21:10 新增（P5/C3：星级按剩余生命结算，顺手存档供后续关卡列表消费）。
 * 修改时间：2026-09-06 21:10 —— ① LastResult 增 stars 字段；② 新增 saveBestStar/loadStars。 */
import { sys } from 'cc';

const K_LEVEL = 'am_level';
const K_WALLET = 'am_wallet';
const K_RESULT = 'am_last_result';
const K_STARS = 'am_stars';

export interface LastResult {
  level: number;
  coins: number;
  ordersDone: number;
  hpLeft: number;
  fenceLeft: number;
  doubled: boolean;
  best: { id: string; name: string; rare: boolean; value: number };
  stats: Record<string, number>;
  stars: number;
}

function readInt(key: string, def: number): number {
  try {
    const v = parseInt(sys.localStorage.getItem(key) || '', 10);
    return v >= 0 ? v : def;
  } catch (e) {
    return def;
  }
}

export const SaveService = {
  loadLevel(): number {
    const v = readInt(K_LEVEL, 1);
    return Math.min(30, Math.max(1, v || 1));
  },
  saveLevelProgress(passedLevel: number): void {
    try {
      const max = readInt(K_LEVEL, 1);
      if (passedLevel + 1 > max) sys.localStorage.setItem(K_LEVEL, String(Math.min(30, passedLevel + 1)));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  },
  loadWallet(): number {
    return readInt(K_WALLET, 0);
  },
  addWallet(n: number): number {
    const v = this.loadWallet() + Math.max(0, Math.round(n));
    try { sys.localStorage.setItem(K_WALLET, String(v)); } catch (e) { }
    return v;
  },
  saveResult(r: LastResult): void {
    try { sys.localStorage.setItem(K_RESULT, JSON.stringify(r)); } catch (e) { }
  },
  loadResult(): LastResult | null {
    try {
      const raw = sys.localStorage.getItem(K_RESULT);
      return raw ? JSON.parse(raw) as LastResult : null;
    } catch (e) {
      return null;
    }
  },
  /* ---------- 每关最佳星级（P5/C3，2026-09-06 21:10 新增） ---------- */
  /** 记录某关最佳星级（只增不减）；stars 1-3，越界忽略。 */
  saveBestStar(level: number, stars: number): void {
    if (stars < 1 || stars > 3) return;
    try {
      const all = this.loadStars();
      const key = String(Math.max(1, Math.min(30, level | 0)));
      if ((all[key] || 0) >= stars) return;
      all[key] = stars;
      sys.localStorage.setItem(K_STARS, JSON.stringify(all));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  },
  /** 读取全部关卡最佳星级（key = 关卡数字字符串，value = 1-3）。 */
  loadStars(): Record<string, number> {
    try {
      const raw = sys.localStorage.getItem(K_STARS);
      const v = raw ? JSON.parse(raw) : null;
      return v && typeof v === 'object' ? v as Record<string, number> : {};
    } catch (e) {
      return {};
    }
  }
};
