/* AnimalArt（VIEW）：动物素材加载与模式开关 + 统一动物图标构造器
 * 修改时间：2026-09-08
 * ART_MODE 一键切换：
 *   'sprite' = 顶视角 3D 渲染图模式（assets/resources/animal/{species}.png，
 *              单图+运行时旋转 —— 移动时按 dir 旋转 spNode.angle = -CSS_DEG[dir]
 *              使头部指向前进方向，静止/转向保持上次朝向避免抖动）；
 *   'vector' = 矢量绘制模式（旧版完整保留——回退时把 ART_MODE 改成 'vector' 即可，
 *              行为与素材接入前完全一致）。
 * 素材缺失（load 报错）时自动回退矢量绘制，双保险。
 *
 * animalIcon(name, px, species, rare)（2026-09-08 全场景统一动物图标）：
 *   双层结构 = 矢量皮肤（占位/回退）+ sprite 层（异步加载，就绪后隐藏矢量层）。
 *   用于静态展示位：围栏槽位（FenceView.drawSlotAnimal）、结算面板售出统计
 *   （Panels）、卡车订单需求/载货图标（ParkView）。与 AnimalNode/FxService 的
 *   「矢量占位 + sprite 切换 + 失败回退」模式一致，全游戏动物视觉同源统一。
 *
 * 2026-09-08 改造：原 24 张 {species}_{dir}.png 四向图改为单张 {species}.png 顶视角图；
 *   朝向变化不再换图（dir 同步改由 AnimalNode 改 spNode.angle 完成）。
 *   loadAnimalSpriteFrame 签名 (species, dir, cb) 保留 —— dir 作兼容垫片，调用方零改动。
 *   cache key 改为 species（去重，6 张共享单图实例）。
 * 2026-09-08 二次改造（资源路径统一）：用户把原始大图集中放在 assets/animal/，
 *   但 Cocos resources.load 只能加载 assets/resources/ 下的资源，故运行时资源目录定为
 *   assets/resources/animal/（路径 'animal/{species}'），原始 2048 图经 process-animal-art.cjs
 *   降采样后输出到此；旧目录 assets/resources/art/animals/ 已废弃并备份到 raw-art/。
 * 2026-09-07 12:00 历史：图片默认以 texture 类型导入（无 spriteFrame 子资源），
 *   改为加载 'xxx/texture' 为 Texture2D 后运行时动态构造 SpriteFrame。 */
import { Node, resources, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { drawAnimal, newG } from './Draw2D';

export type ArtMode = 'sprite' | 'vector';
export const ART_MODE: ArtMode = 'sprite';

const cache = new Map<string, SpriteFrame | null>();

/** 加载 {species} 的 SpriteFrame（带缓存；dir 参数作兼容垫片，本模式不参与路径）。
 *  失败回调 null（调用方回退矢量）。同 species 多次调用共享同一 SpriteFrame。 */
export function loadAnimalSpriteFrame(species: string, _dir: string, cb: (sf: SpriteFrame | null) => void): void {
  const hit = cache.get(species);
  if (hit !== undefined) { cb(hit); return; }
  resources.load('animal/' + species + '/texture', Texture2D, (err, tex) => {
    let result: SpriteFrame | null = null;
    if (!err && tex) {
      const sf = new SpriteFrame();
      sf.texture = tex;                       // 运行时由 Texture2D 构造（绕过 spriteFrame 子资源缺失）
      result = sf;
    }
    cache.set(species, result);
    if (!result) console.warn('[AnimalArt] 素材缺失，回退矢量绘制：', species, err);
    cb(result);
  });
}

/**
 * 统一动物图标（2026-09-08）：静态展示位专用，替代裸 icon64+drawAnimal 矢量绘制。
 * 双层结构：矢量皮肤（底层，占位/回退）+ sprite（顶层，异步加载就绪后切矢量）。
 * 素材加载失败自动保持矢量（与 AnimalNode/FxService 同回退纪律）。
 * rare 参数保留作签名兼容（2026-09-08 用户要求移除稀有金环类视觉，Draw2D.drawAnimal
 *   内部已忽略 rare）；稀有仍影响售价 ×3 与结算「闪」文字标注（core 层数据不动）。
 */
export function animalIcon(name: string, px: number, species: string, rare = false): Node {
  const root = new Node(name);
  root.addComponent(UITransform).setContentSize(px, px);
  // 1. 矢量皮肤层（占位/回退）：64 空间绘制，等比缩到 px
  const vec = newG(name + 'vec', 64, 64);
  drawAnimal(vec.g, species, rare);
  vec.node.setScale(px / 64, px / 64, 1);
  root.addChild(vec.node);
  // 2. sprite 层：异步加载，就绪后置顶显示并隐藏矢量层
  if (ART_MODE === 'sprite') {
    const spNode = new Node(name + 'sp');
    spNode.addComponent(UITransform).setContentSize(px, px);
    const sp = spNode.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    spNode.active = false;
    root.addChild(spNode);
    loadAnimalSpriteFrame(species, 'up', (sf) => {
      if (!sf) return;                        // 回退矢量（vectorSkin 保持 active）
      sp.spriteFrame = sf;
      spNode.active = true;
      vec.node.active = false;
    });
  }
  return root;
}
