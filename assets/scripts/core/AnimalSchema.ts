/* 动物 schema（core 层唯一动物数据真相源，禁止 import 'cc'，Node 直跑）
 * 修改时间：2026-09-06 23:00 —— 初版（用户需求 2）：全部动物数据集中于此统一管理，
 *   Constants.TYPES / TYPE_MAP 改由本表派生（调用方零改动）；闪光售价倍率 3 处字面值同步收编。
 *
 * 使用约定（详见 docs/animal-schema.md）：
 *   - 新增动物：本表加一行 → Draw2D.drawAnimal 加对应矢量 case（art='vector' 时必做）
 *     → 检查 LevelCfg.typeCount 上限（当前最大 6）→ 若超出需同步扩 TYPE 数组。
 *   - id 是持久化与种子对拍的稳定键：一经上线禁止变更/复用，只允许追加。
 *   - resourcePath 为美术替换期（P6，PNG 图集）预留：art='sprite' 时生效，
 *     当前全部为 'vector'（Draw2D 矢量绘制），resourcePath 仅作占位声明。
 */
export interface AnimalDef {
  /** 种类标识（唯一稳定键，禁止上线后变更） */
  id: string;
  /** 显示名称（面板/结算文案用） */
  name: string;
  /** 基础售价（金币；闪光个体 = price × rareMultiplier） */
  price: number;
  /** 闪光（rare）个体售价倍率 */
  rareMultiplier: number;
  /** 美术形态：'vector' = Draw2D 矢量绘制（当前）；'sprite' = resourcePath 图片资源（预留） */
  art: 'vector' | 'sprite';
  /** 图片资源路径（art='sprite' 时生效；vector 阶段为占位空串） */
  resourcePath: string;
}

export const ANIMAL_SCHEMA: AnimalDef[] = [
  { id: 'chicken', name: '鸡', price: 8, rareMultiplier: 3, art: 'vector', resourcePath: '' },
  { id: 'duck', name: '鸭', price: 10, rareMultiplier: 3, art: 'vector', resourcePath: '' },
  { id: 'rabbit', name: '兔', price: 12, rareMultiplier: 3, art: 'vector', resourcePath: '' },
  { id: 'sheep', name: '羊', price: 15, rareMultiplier: 3, art: 'vector', resourcePath: '' },
  { id: 'pig', name: '猪', price: 18, rareMultiplier: 3, art: 'vector', resourcePath: '' },
  { id: 'cow', name: '牛', price: 25, rareMultiplier: 3, art: 'vector', resourcePath: '' },
];

/** 闪光个体通用倍率（新增动物默认值；个别动物可单行覆盖 rareMultiplier） */
export const RARE_MULT_DEFAULT = 3;
