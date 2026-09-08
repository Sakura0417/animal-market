# 动物素材 AI 生成 Prompt 手册（3D 俯视渲染风）

> 修改时间：2026-09-06 11:20 ｜ 配套：docs/art-spec.md（v1.1）
> 用法：任选一个 AI 生图工具（即梦 AI / 豆包 / 可灵 / Midjourney / DALL·E / SD），复制下述
> Prompt 生成后，按 §4 后处理，产出文件名 `{species}_{dir}.png` 发回（或自行覆盖
> `assets/art/animals/`）。**推荐"2×2 四向网格"出图**：同一张图内的四个朝向天然保持
> 造型/光照一致，比单张四次生成可靠得多。

## 1. 通用风格尾缀（所有 Prompt 末尾都要带）

**中文：**
```
3D卡通渲染，Q版圆润胖乎的体积感，软胶糖果色材质，轻微次表面散射，俯视45度视角，
完整全身居中构图，纯白背景，无地面阴影，柔和均匀布光，手机游戏素材，高清细节
```

**负面（支持负面词的工具填写）：**
```
文字, 水印, 多余动物, 背景场景, 强投影, 剪影, 线稿, 写实照片风格, 出画, 裁切
```

**英文（Midjourney 追加 `--ar 1:1 --style raw`；DALL·E 直接用）：**
```
3D cartoon render, chibi chubby volume, soft candy-colored glossy material with subtle
subsurface scattering, 45-degree top-down camera view, full body centered, pure white
background, no ground shadow, soft even lighting, mobile game asset, high detail
```
**Negative prompt：** `text, watermark, multiple animals, background scene, strong shadow, silhouette, line art, photorealistic, cropped`

## 2. 物种主体描述（替换到模板的 `{主体}` 处）

| 物种 | 中文 | English |
|---|---|---|
| 鸡 chicken | 黄色小鸡，白色肚皮，红色小鸡冠，橙色尖嘴和橙脚 | yellow chick, white belly, tiny red comb, orange beak and feet |
| 鸭 duck | 黄色小鸭，扁平橙色鸭嘴，圆滚滚身体 | yellow duckling with flat orange bill, round chubby body |
| 兔 rabbit | 白色小兔，粉色内耳长耳朵，粉腮红，圆团尾巴 | white bunny with long pink inner ears, pink blush, round puff tail |
| 羊 sheep | 奶白色卷毛小羊，米色脸部与耳朵 | cream woolly lamb with beige face and ears |
| 猪 pig | 粉色小猪，折折小耳朵，圆猪鼻 | pink piglet with folded ears and round snout |
| 牛 cow | 白底棕斑小牛，米色牛角耳朵，粉色口鼻 | white calf with brown patches, beige horns and ears, pink muzzle |

## 3. 朝向模板

### 3.1 四向网格版（推荐，一致性最好）

**中文模板（即梦/豆包/可灵）：**
```
同一只{主体}的四个朝向，2×2网格整齐排列：
左上＝背对镜头（头朝画面上方，看到后背和屁股）；
右上＝面对镜头（头朝画面下方，看到脸）；
左下＝头朝画面左侧的侧面；
右下＝头朝画面右侧的侧面。
四个朝向是同一只、同比例同光照，仅朝向不同。
{通用风格尾缀}
```

**英文模板（Midjourney / DALL·E）：**
```
Character sprite sheet, 2x2 grid, the SAME {subject} in four orientations:
top-left back view facing away (head up), top-right front view facing camera (head down),
bottom-left profile facing left, bottom-right profile facing right.
Identical character design, proportions and lighting across all four, only orientation differs.
{style suffix}
```

### 3.2 单张版（网格失败时逐张生成；同物种建议用首图做角色参考：即梦"参考图"、MJ v6 `--cref`）

| 朝向 | 中文追加 | English 追加 |
|---|---|---|
| up | 背对镜头，头朝画面上方，看到后脑、背部和臀部 | back view facing away from camera, head toward top, showing back and rump |
| down | 正对镜头，头朝画面下方，看到脸和胸口 | front view facing camera, head toward bottom, showing face and chest |
| left | 侧身，头朝画面左侧 | side profile, head toward the left of frame |
| right | 侧身，头朝画面右侧 | side profile, head toward the right of frame |

## 4. 出图后处理（交回给我，或自行处理）

1. **抠背景**：remove.bg / PS 魔棒 / 即梦自带抠图 → 透明 PNG；
2. **网格切割**：2×2 图按象限裁成 4 张（**把原图发我，我来切割**）；
3. **规格化**：等比缩放至主体高 ~112px，放入 144×144 画布居中、脚底基线对齐；
4. **命名**：`{species}_{dir}.png`（chicken_up.png …），发我或直接覆盖 `assets/art/animals/`；
5. 我做终检（四向叠帧一致性/透明度/尺寸）后接入引擎。

> 提示：AI 对"四只完全一致"仍有随机性——每物种多生成 2~3 组挑最好的一组；
> 朝下（露脸）与朝上（露臀）是辨识度关键，优先保证这两张的可爱度。
