/* ⚠️【休眠态 · 2026-09-08 10:11 回退】3D 俯视观察层已下线，工程回到纯 2D。
 * 当前状态：GameView 已移除全部 Farm3D 接线（import/字段/构造三处均已删除），本文件不再被任何代码引用，
 *   运行时完全不执行——即使 FARM3D_ENABLED 为 true 也不会被构造（没人 new 它）。
 * 回退原因：v1.0→v1.1→v1.2 三轮修复后预览仍黑屏（详见 DEVLOG 00:32 / 00:42 两条），
 *   最后一轮 device 端 vConsole 仍报 `[Farm3D] The asset has been destroyed!`，
 *   定位为"在纯 2D UI 场景里运行时注入 3D 相机/灯光/Mesh"这条路径本身脆弱（与 2D 渲染管线抢生命周期）。
 * 若日后重试 3D，**不要走"运行时注入"路线**，改用：① 编辑器里新建独立 3D 场景（含 Canvas 之外的 3D 相机），
 *   或 ② 用 Cocos 的 UI 3D 层 / 多场景叠加，把 3D 与 2D 在**场景级别**隔离（而非运行时抢同一个场景根）。
 * 保留本文件仅供后续参考（含踩坑记录：LAYER_3D 分层 / ImageAsset(canvas) 销毁链 / primitives API）。
 * ------------------------------------------------------------
 * 以下为历史注释（v1.2 及更早）保留备查：
 * v1.1 仍黑屏根因（device 端 vConsole 抓到 `[Farm3D] The asset has been destroyed!`）：
 *   构造里 `new ImageAsset(canvas)` 包了 `document.createElement('canvas')` 当地面贴图，ImageAsset
 *   在某些时序被引擎回收 → 后续 mr.material 引用这个已销毁 tex → 渲染器整批材质失效 →
 *   地面 + 同批 mesh 全不渲染 → 0 三角面，屏幕黑。层隔离（v1.1）是对的，但材质引销毁资产，
 *   整个 3D 帧空。
 * v1.2 修复：
 *   - 砍掉程序化 canvas 地面贴图，地面用**纯色 unlit 材质**（无 ImageAsset 依赖）；
 *   - 地面 mesh 创建用 try/catch 兜底，失败则不建地面——cam.clearColor 深草绿直接当"地面"；
 *   - 模型（glb）路径无此问题保留不变。
 * v1.1 修复（层隔离）：专用层 `LAYER_3D = 1<<20` + setLayerRecursive + Canvas UI 相机只清
 *   LAYER_3D 位（不动 DEFAULT）+ 3D 相机 visibility 锁 LAYER_3D + FARM3D_ENABLED 总开关 +
 *   构造 try/catch degrade。
 * v1.0 修复（层隔离前的根因）：uiCam.visibility &= ~DEFAULT 误清 DEFAULT 导致 2D 节点全黑 +
 *   3D 模型子节点 layer 不继承父节点。
 * 职责与边界、设计、坐标映射、平台注意：见 v1.0 注释。 */
import {
  Camera, Color, director, DirectionalLight, gfx, instantiate, Layers, Material, Mesh,
  MeshRenderer, Node, primitives, resources, Texture2D, UITransform, utils, view, _decorator, Component,
} from 'cc';
import type { Prefab } from 'cc';
import type { Animal } from '../core/Types';
import { makeLabel, newG, col } from './Draw2D';
import { mkBtn } from './Ui';

const { ccclass } = _decorator;

/* 总开关：false 时 Farm3D 直接退化为 no-op（按钮不出、世界不构造），出问题 1 行回 2D。
 * 2026-09-08 10:11 回退：当前 GameView 已不引用本类，此开关为二次保险（双保险，确保绝不构造） */
export const FARM3D_ENABLED = false;

/** 专用 3D 层位：与 DEFAULT(1<<30)/UI_2D(1<<25) 互不干扰；递归设到每个 3D 节点 */
const LAYER_3D = 1 << 20;

/** 俯视观察层宿主：GameView 提供对局数据与 UI 宿主节点（解耦避免循环 import） */
export interface Farm3DHost {
  session: { herd: Animal[] };
  design: Node;
}

const MODEL_HEIGHT: Record<string, number> = {
  chicken: 0.985, cow: 0.666, duck: 0.944, pig: 0.767, rabbit: 1.0, sheep: 0.741, rock: 0.9,
};
const MODEL_GIRTH: Record<string, number> = {
  chicken: 0.85, cow: 1.25, duck: 0.85, pig: 1.05, rabbit: 0.7, sheep: 1.0, rock: 1.0,
};
const FALLBACK_COLOR: Record<string, string> = {
  chicken: '#e8b64c', cow: '#f2efe9', duck: '#f4e6d0', pig: '#f0a8a8',
  rabbit: '#dfe3ea', sheep: '#e6dcc8', rock: '#8d9096',
};
const TARGET_H = 7;
const MODEL_YAW_CORR = 180;
const DIR_YAW: Record<string, number> = { up: 180, down: 0, left: -90, right: 90 };
const SPECIES = ['chicken', 'cow', 'duck', 'pig', 'rabbit', 'sheep', 'rock'];

/** 递归把 node 及其所有子节点的 layer 设为指定位（解决 glb 子节点 layer 不继承父节点问题） */
function setLayerRecursive(n: Node, layer: number): void {
  n.layer = layer;
  n.children.forEach(c => setLayerRecursive(c, layer));
}

@ccclass('Farm3DTicker')
class Farm3DTicker extends Component {
  cb: () => void = () => { };
  start(): void { this.schedule(this.cb, 0.4); }
}

export class Farm3D {
  private world: Node | null = null;
  private cam: Camera | null = null;
  private uiCam: Camera | null = null;
  private uiCamClear: number | null = null;
  private templates = new Map<string, Node>();
  private loading = new Set<string>();
  private missing = new Set<string>();
  private live = new Map<number, Node>();
  private open = false;
  private overlay: Node | null = null;
  private btn: Node | null = null;
  private degraded = false;   // WebGL/创建失败 → 降级（按钮隐藏）

  constructor(private host: Farm3DHost) {
    if (!FARM3D_ENABLED) return;
    try {
      const scene = director.getScene()!;
      this.world = new Node('Farm3DWorld');
      this.world.layer = LAYER_3D;
      scene.addChild(this.world);
      this.buildGround();
      this.buildLight();
      this.buildCamera(scene);
      // 调度器挂载：每 0.4s 镜像 core herd
      const ticker = new Node('Farm3DTicker');
      ticker.layer = LAYER_3D;
      const comp = ticker.addComponent(Farm3DTicker);
      comp.cb = () => { if (this.open) this.sync(); };
      this.world.addChild(ticker);
      // 2D 入口按钮：右上角（HUD 在左上，不抢位）
      this.btn = mkBtn({ w: 70, h: 34, kind: 'blue', title: '3D 俯视', titleSize: 12, onTap: () => this.setOpen(true) });
      const dut = this.host.design.getComponent(UITransform)!;
      this.btn.setPosition(dut.width / 2 - 46, 0, 0);
      this.host.design.addChild(this.btn);
    } catch (e) {
      console.error('[Farm3D] 初始化失败，已降级回 2D：', e);
      this.degrade();
    }
  }

  private degrade(): void {
    this.degraded = true;
    this.destroyWorld();
    if (this.btn) { this.btn.destroy(); this.btn = null; }
  }

  private destroyWorld(): void {
    if (this.uiCam && this.uiCamClear !== null) { this.uiCam.clearFlags = this.uiCamClear as gfx.ClearFlagBit; this.uiCam = null; }
    if (this.world) { this.world.destroy(); this.world = null; }
    this.cam = null;
    for (const [, n] of this.live) n.destroy();
    this.live.clear();
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
  }

  /* ---------- 场景构件 ---------- */

  private buildGround(): void {
    // v1.2：砍掉 v1.1 引入的程序化 canvas 地面（ImageAsset 销毁导致整批材质失效→0 三角面）。
    // 改用纯色 unlit 材质（无纹理），mesh 创建用 try/catch 兜底，失败则不建地面——
    // 摄像机的深草绿 clearColor 直接当"地面"，观感无损。
    const node = new Node('ground');
    const mr = node.addComponent(MeshRenderer);
    let mesh: Mesh | null = null;
    try {
      mesh = utils.MeshUtils.createMesh(primitives.plane({ width: 100, length: 125, widthSegments: 1, lengthSegments: 1 }));
    } catch (e) {
      console.warn('[Farm3D] 地面 mesh 创建失败，跳过地面（cam.clearColor 兜底）：', e);
      node.destroy();
      return;
    }
    mr.mesh = mesh;
    mr.material = this.unlitMaterial('#6fbf63');   // 纯色，零 ImageAsset 风险
    node.setPosition(50, 0, 62.5);
    setLayerRecursive(node, LAYER_3D);
    this.world!.addChild(node);
  }

  private buildLight(): void {
    const node = new Node('farmLight');
    const light = node.addComponent(DirectionalLight);
    node.setPosition(0, 40, 0);
    node.setRotationFromEuler(-50, -30, 0);
    light.illuminance = 1.4;
    setLayerRecursive(node, LAYER_3D);
    this.world!.addChild(node);
  }

  private buildCamera(scene: Node): void {
    const node = new Node('Farm3DCam');
    const cam = node.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.clearFlags = gfx.ClearFlagBit.COLOR;
    cam.clearColor = new Color(47, 88, 52, 255);
    cam.near = 1;
    cam.far = 600;
    cam.visibility = LAYER_3D;            // 只渲染 3D 层
    cam.priority = -1;                     // 先于 UI 相机渲染（priority 小先渲染）
    cam.enabled = false;
    node.setPosition(50, 160, 62.5);
    node.setRotationFromEuler(-90, 0, 0);
    setLayerRecursive(node, LAYER_3D);
    scene.addChild(node);
    this.cam = cam;
    // Canvas UI 相机：清 LAYER_3D 可见位（幂等，**不动 DEFAULT**——否则 2D 节点全黑）
    scene.getComponentsInChildren(Camera).forEach(c => {
      if (c !== cam) {
        c.visibility &= ~LAYER_3D;
        if (this.uiCam === null) { this.uiCam = c; this.uiCamClear = c.clearFlags; }
      }
    });
  }

  /* ---------- 模型加载与镜像 ---------- */

  private unlitMaterial(colorHex: string, tex?: Texture2D): Material {
    const mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit' });
    const c = new Color().fromHEX(colorHex);
    mat.setProperty('mainColor', c);
    if (tex) mat.setProperty('mainTexture', tex);
    return mat;
  }

  private ensureTemplates(): void {
    for (const id of SPECIES) {
      if (this.templates.has(id) || this.loading.has(id) || this.missing.has(id)) continue;
      this.loading.add(id);
      resources.load('art/models/' + id, (err, asset) => {
        this.loading.delete(id);
        if (err || !asset) {
          this.missing.add(id);
          console.warn('[Farm3D] 模型缺失，用占位柱体：', id, err);
          return;
        }
        let tpl: Node;
        try { tpl = instantiate(asset as unknown as Prefab) as Node; }
        catch (e) { this.missing.add(id); console.warn('[Farm3D] instantiate 失败，占位：', id, e); return; }
        setLayerRecursive(tpl, LAYER_3D);
        try { this.applyUnlit(tpl); } catch (e) { console.warn('[Farm3D] 材质换 unlit 失败（保留原）：', e); }
        this.templates.set(id, tpl);
        // 已在场的占位实例升级为真模型
        for (const [uid, node] of this.live) {
          const a = this.host.session.herd.find(x => x.uid === uid);
          if (a && a.type.id === id) {
            const fresh = instantiate(tpl);
            setLayerRecursive(fresh, LAYER_3D);
            this.world!.addChild(fresh);
            node.destroy();
            this.live.set(uid, fresh);
          }
        }
        if (this.open) this.sync();
      });
    }
  }

  private applyUnlit(root: Node): void {
    root.getComponentsInChildren(MeshRenderer).forEach(mr => {
      const src = mr.sharedMaterial;
      let tex: Texture2D | null = null;
      let hex = '#ffffff';
      try {
        const t = src?.getProperty('mainTexture') as Texture2D | null;
        if (t) tex = t;
        const c = src?.getProperty('mainColor') as Color | null;
        if (c) hex = '#' + c.toHEX();
      } catch { /* 材质无该属性时走默认白 */ }
      mr.material = this.unlitMaterial(hex, tex ?? undefined);
    });
  }

  private acquire(id: string): Node {
    const tpl = this.templates.get(id);
    if (!tpl) {
      const ph = new Node('ph_' + id);
      const mr = ph.addComponent(MeshRenderer);
      const mesh = utils.MeshUtils.createMesh(primitives.cylinder(3, 3, TARGET_H));
      mr.mesh = mesh;
      mr.material = this.unlitMaterial(FALLBACK_COLOR[id] ?? '#cccccc');
      setLayerRecursive(ph, LAYER_3D);
      return ph;
    }
    const node = instantiate(tpl);
    setLayerRecursive(node, LAYER_3D);
    return node;
  }

  private sync(): void {
    if (!this.world) return;
    const herd = this.host.session.herd;
    const seen = new Set<number>();
    for (const a of herd) {
      seen.add(a.uid);
      let node = this.live.get(a.uid);
      if (!node) {
        node = this.acquire(a.type.id);
        this.live.set(a.uid, node);
        this.world.addChild(node);
      }
      const h = MODEL_HEIGHT[a.type.id] ?? 0.9;
      const g = MODEL_GIRTH[a.type.id] ?? 1;
      const s = (TARGET_H / h) * g;
      node.setScale(s, s, s);
      node.setPosition(a.x, 0, a.yu);
      const yaw = (DIR_YAW[a.dir] ?? 0) + (a.obstacle ? 0 : MODEL_YAW_CORR);
      node.setRotationFromEuler(0, yaw, 0);
    }
    for (const [uid, node] of this.live) {
      if (!seen.has(uid)) { node.destroy(); this.live.delete(uid); }
    }
  }

  /* ---------- 开关与全屏观察态 ---------- */

  private setOpen(on: boolean): void {
    if (this.degraded || !this.cam) return;       // 降级态或未成功创建：直接忽略
    if (this.open === on) return;
    this.open = on;
    this.btn!.active = !on;
    this.cam.enabled = on;
    if (on) {
      this.ensureTemplates();
      const vis = view.getVisibleSize();
      const aspect = vis.width / vis.height;
      this.cam.orthoHeight = Math.max(125 / 2 + 4, (100 / 2 + 4) / aspect);
      if (this.uiCam) this.uiCam.clearFlags = gfx.ClearFlagBit.DEPTH;
      this.sync();
      this.buildOverlay();
    } else {
      if (this.uiCam && this.uiCamClear !== null) this.uiCam.clearFlags = this.uiCamClear as gfx.ClearFlagBit;
      if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    }
  }

  private buildOverlay(): void {
    const dut = this.host.design.getComponent(UITransform)!;
    const { width: dw, height: dh } = dut.contentSize;
    const root = new Node('farm3dOverlay');
    root.addComponent(UITransform).setContentSize(dw, dh);
    root.on(Node.EventType.TOUCH_START, () => { /* swallow：锁 2D 游玩输入 */ });
    const { g, node: bar } = newG('farm3dBar', dw, 44);
    g.fillColor = col('#2c2416');
    g.rect(-dw / 2, -22, dw, 44);
    g.fill();
    const title = makeLabel('牧场俯视 · 3D 模型观察', 14, '#ffe9c2');
    title.node.setPosition(-70, 0, 0);
    bar.addChild(title.node);
    const close = mkBtn({ w: 92, h: 32, kind: 'primary', title: '返回牧场', titleSize: 12, onTap: () => this.setOpen(false) });
    close.setPosition(dw / 2 - 70, 0, 0);
    bar.addChild(close);
    root.addChild(bar);
    bar.setPosition(0, dh / 2 - 22, 0);
    this.host.design.addChild(root);
    this.overlay = root;
  }
}
