/* IconArt（VIEW）：UI 图标统一加载器（PNG sprite + Graphics 矢量回退双层）
 * 修改时间：2026-09-10 18:33
 * 资源：assets/resources/icons/{asset}.png（128×128 RGBA，运行时 resources.load，
 *   与 AnimalArt 的 'animal/{species}' 同一管线纪律）。
 * 双层结构与 AnimalArt.animalIcon 同型：矢量层常驻（占位/回退），sprite 就绪后
 *   置顶显示并隐藏矢量层；加载失败保持矢量（资源缺失/断网不出现白块）。
 * tint：Sprite.color 乘法混色——用于把白色单色 PNG 染成目标色
 *   （如 lock.png 白锁 → '#5a6a78' 深灰蓝，与原矢量 drawLock 同色）。
 * 注意：PNG 是"完整图标自带留白"，sprite 层按 px 全尺寸居中显示；
 *   span/cx/cy 仅作用于矢量回退层的对齐（与 icon64 同义）。 */
import { Graphics, Node, resources, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { col } from './Draw2D';
import { icon64 } from './Ui';

/** 预加载清单：与 assets/resources/icons/ 下实际文件一一对应（pause 已随暂停按钮移除） */
export const ICON_NAMES = ['coin', 'crane', 'flip', 'heart', 'lock', 'restart', 'shuffle', 'video'] as const;

/** 归一化后「内容最大边 / 画布」恒为 80%（由 tools/normalize-icons.py 保证）。
 *  ⇒ 实际光学尺寸 = px × ICON_FILL。改归一化参数时只需改这一个数。 */
export const ICON_FILL = 0.8;

/**
 * 图标方框尺寸表（设计单位）—— px 是"方框"，不是"画出来的大小"。
 * 光学尺寸 = px × ICON_FILL，故本表按 **光学尺寸 ÷ 0.8** 反算，注释标出目标光学值。
 * 为什么要有这张表（2026-09-10）：归一化前 8 张图内容占画布 70.3%~100% 不等，
 *   同一个 px 画出来能差 1.43 倍，且散落在 8 个调用点里的裸数字无从横向比较。
 * 调尺寸请改这里，不要在调用点写裸数字。
 */
export const ICON_PX = {
  hudChip: 19,   // 光学 15.2：HUD 胶囊内图标（金币 / 生命）
  hudBtn: 19,    // 光学 15.2：HUD 圆形图标按钮（重开）
  tool: 29,      // 光学 23.2：底部道具主图标（吊车 / 翻转 / 洗牌）
  badge: 21,     // 光学 16.8：广告角标
  slotLock: 15,  // 光学 12.0：停车位未解锁锁
  panel: 34,     // 光学 27.2：结算面板大金币
} as const;

const cache = new Map<string, SpriteFrame | null>();

/** 加载 {asset} 的 SpriteFrame（带缓存；失败回调 null，调用方回退矢量）。
 *  同 asset 多实例共享同一 SpriteFrame（与 AnimalArt.loadAnimalSpriteFrame 同纪律）。 */
export function loadIconSpriteFrame(asset: string, cb: (sf: SpriteFrame | null) => void): void {
  const hit = cache.get(asset);
  if (hit !== undefined) { cb(hit); return; }
  resources.load('icons/' + asset + '/texture', Texture2D, (err, tex) => {
    let result: SpriteFrame | null = null;
    if (!err && tex) {
      const sf = new SpriteFrame();
      sf.texture = tex;                       // 运行时由 Texture2D 构造（绕过 spriteFrame 子资源缺失）
      result = sf;
    }
    cache.set(asset, result);
    if (!result) console.warn('[IconArt] 图标缺失，回退矢量绘制：', asset, err);
    cb(result);
  });
}

/** 开局预加载全部图标：素材备齐后再搭 UI ⇒ 首帧直接是 PNG，不闪矢量回退。
 *  cb 一定会被调用（含失败；失败时各调用点按既有纪律保持矢量）。 */
export function preloadIcons(cb?: () => void): void {
  // 显式标 number：ICON_NAMES 是 as const 元组，length 会被推成字面量 8 而使 === 0 判为无意义
  let left: number = ICON_NAMES.length;
  if (left === 0) { cb?.(); return; }
  const done = (): void => { if (--left === 0) cb?.(); };
  for (const n of ICON_NAMES) loadIconSpriteFrame(n, done);
}

/**
 * PNG 图标节点 = icon64 矢量回退层 + sprite 覆盖层。
 * @param asset     resources/icons/{asset}.png
 * @param px        显示尺寸（正方形，PNG 自带留白按全尺寸居中）
 * @param fallback  sprite 未就绪/加载失败时的矢量绘制（64 空间，同 icon64.draw）
 * @param span      矢量层图形在 64 空间的跨度（同 icon64）
 * @param cx/cy     矢量层图形包围盒中心（同 icon64，仅影响回退层对齐）
 * @param tint      可选，PNG 着色（十六进制，乘法混色）
 * @param nodeName  节点名（默认 asset；同图标多实例时传入区分名）
 */
export function iconArt(asset: string, px: number, fallback: (g: Graphics) => void,
                        span = 64, cx = 32, cy = 32, tint?: string, nodeName?: string): Node {
  const name = nodeName ?? asset;
  const root = icon64(name, px, fallback, span, cx, cy);      // 1. 矢量层（占位/回退）
  const vecNode = root.children[0];
  // 2. sprite 层：异步加载，就绪后置顶显示并隐藏矢量层
  const spNode = new Node(name + 'sp');
  spNode.addComponent(UITransform).setContentSize(px, px);
  const sp = spNode.addComponent(Sprite);
  sp.sizeMode = Sprite.SizeMode.CUSTOM;
  sp.trim = false;
  if (tint) sp.color = col(tint);
  spNode.active = false;
  root.addChild(spNode);
  loadIconSpriteFrame(asset, (sf) => {
    if (!sf) return;                        // 回退矢量（vecNode 保持 active）
    // 防御非方形贴图（2026-09-10 修 crane 拉伸 14.3% 的同源问题）：
    // Sprite.SizeMode.CUSTOM 不做等比适配，直接 setContentSize(px,px) 会拉伸贴图。
    // 归一化脚本已保证画布为 160×160 方形，此处按真实宽高比 contain 兜底。
    const tw = sf.texture ? sf.texture.width : 0;
    const th = sf.texture ? sf.texture.height : 0;
    if (tw > 0 && th > 0 && tw !== th) {
      const k = px / Math.max(tw, th);
      spNode.getComponent(UITransform)!.setContentSize(tw * k, th * k);
    }
    sp.spriteFrame = sf;
    spNode.active = true;
    vecNode.active = false;
  });
  return root;
}
