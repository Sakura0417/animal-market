/* 核心类型定义（core 层共享）
 * 修改时间：2026-09-09 23:35 —— P1.5 紧密化：LevelConfig 新增 tightness（盘面排列紧密度）
 *   与 pressure（朝向反向偏置）两个难度旋钮（PRD 2.0 §5.1「紧密排列 / 高关卡反向偏置制造链条」
 *   的参数化落地，详见 docs/grid-scheme-review-20260909.md）；
 * 2026-09-07 16:30 —— P1/C1 网格化：Animal 由接口改类，
 *   位置唯一真相源改为整格 col/row（int，PRD 2.0 §5.1：取代旧浮点 x/yu）；
 *   x/yu 保留为只读派生 getter（= 格中心连续坐标），view 层过渡期（P3 前）零改动；
 *   23:00 —— AnimalType 改为 AnimalDef（core/AnimalSchema.ts）的类型别名 */
import type { AnimalDef } from './AnimalSchema';
import { CELL_W, CELL_H } from './Constants';

export type Dir = 'up' | 'down' | 'left' | 'right';

/** PRNG 函数签名（mulberry32 兼容，2026-09-06 19:09 新增）。
 *  Board/GameSession 中所有需要随机源的函数都收 Rng 参数注入，不再直接读全局 Math.random。 */
export type Rng = () => number;

/** 动物种类 = schema 行（AnimalSchema.ts 为唯一数据真相源） */
export type AnimalType = AnimalDef;

/** 盘面单体的构造入参（col/row 由生成器/洗牌落位后回填） */
export interface AnimalInit {
  uid: number;
  type: AnimalType;
  dir: Dir;
  rare: boolean;
  obstacle: boolean;
}

/** 盘面单体（动物/岩石共用）：网格化后 col/row 为唯一位置真相源（P1/C1）。
 *  x/yu = 格中心连续坐标的只读 getter——view 层按 0-100/0-125 连续坐标映射，
 *  过渡期（P3 网格像素适配前）行为与旧散点版视觉兼容（落点吸附格中心）。 */
export class Animal {
  readonly uid: number;
  type: AnimalType;
  dir: Dir;
  rare: boolean;
  obstacle: boolean;
  col = 0;
  row = 0;

  constructor(init: AnimalInit) {
    this.uid = init.uid;
    this.type = init.type;
    this.dir = init.dir;
    this.rare = init.rare;
    this.obstacle = init.obstacle;
  }

  get x(): number { return (this.col + 0.5) * CELL_W; }
  get yu(): number { return (this.row + 0.5) * CELL_H; }
}

export interface Order {
  items: Record<string, number>;
  value: number;
}

export type SlotState = 'locked' | 'empty' | 'truck' | 'loading' | 'leaving';

export interface Slot {
  state: SlotState;
  order: Order | null;
  loaded: Animal[] | null;
}

export type Phase = 'play' | 'failwait' | 'fail' | 'win' | 'end' | 'intro';

export interface LevelConfig {
  level: number;
  herdN: number;
  typeCount: number;
  rocks: number;
  rareP: number;
  orderKinds: number;
  /** 盘面排列紧密度（P1.5，2026-09-09）：0 = 均匀随机取格（与改造前 gridLayout 逐帧同构），
   *  1 = 纯团簇生长（猪了个猪式紧密排列）。中间值 = 生长时以该概率优先取已选格的邻域。 */
  tightness: number;
  /** 朝向反向偏置（P1.5，2026-09-09，PRD 5.1「高关卡反向偏置制造链条」）：
   *  0 = 改造前行为（50% 朝最近场外边 / 50% 随机）；1 = 朝场外概率降至 0、40% 概率
   *  直接指向已占格制造遮挡链。 */
  pressure: number;
}

export type TakeOutcome =
  | { kind: 'noop' }
  | { kind: 'collide'; animal: Animal; hpLeft: number }
  | { kind: 'fly'; animal: Animal; fenceLen: number }
  | { kind: 'crane'; animal: Animal; fenceLen: number };

export interface Match {
  slotIdx: number;
  taken: Animal[];
}

export interface BestSale {
  id: string;
  name: string;
  rare: boolean;
  value: number;
}
