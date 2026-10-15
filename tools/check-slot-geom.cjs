/* 槽内几何核算（2026-09-26 22:41）：验证 ParkView 车位槽「内容块整体居中 + 计数只显示缺口数
 * + 计数按动物本体留白对齐」布局在任意订单组数下都落在槽框内、互不重叠，
 * 且上下留白对称、车-单间距恒定、图标↔数字视觉间距恒定。
 * 用法：node tools/check-slot-geom.cjs
 * 注意：常量必须与 ParkView 顶部 token / syncNeeds 分档保持一致，改动布局后同步本文件再跑。
 */
const DESIGN_W = 375, COL_PAD = 12;
const w = DESIGN_W - COL_PAD * 2;          // 351
const padX = 7, gap = 6;
const sw = (w - padX * 2 - gap * 4) / 5;   // 62.6
const SLOT_RATIO = 0.92;
const sh = sw / SLOT_RATIO;                // 68
const half = sh / 2;                       // tw 原点=槽中心
const PARK_BAND_H = 84, SLOT_PAD_TOP = 8;
const TRUCK_PX = 34, CARGO_DY = -5, GAP_TRUCK_NEED = 5;
const TRUCK_K = TRUCK_PX / 64;
const TRUCK_VIS_LO = -24 * TRUCK_K, TRUCK_VIS_HI = 19 * TRUCK_K;
const TRUCK_VIS_H = TRUCK_VIS_HI - TRUCK_VIS_LO;
const TRUCK_VIS_DY = -(TRUCK_VIS_LO + TRUCK_VIS_HI) / 2;
const NEED_BAND_MAX = 36, NEED_ROW_MAX = 16, NEED_GAP = 1;
const SW_IN = sw - 4;          // 槽内可用宽
const COL_W = 28;              // 两列时的列宽（含组间隙）
const DIGIT_K = 0.58;          // 单个数字宽 ≈ 0.58em
/* 动物 PNG 右缘留白率（2026-09-26 22:41 新增）：animalIcon 的 sprite 层用不裁透明边的
 * 512×512 PNG，alpha 包围盒实测水平填充率 W∈[0.443,0.607]、右边距 R∈[0.195,0.279]。
 * 22:41 取 0.20（零间隙线）；23:01 用户要求再收紧，改为 0.24 —— 见下方 ⚠️。 */
const ANIMAL_PAD_R = 0.24;   // ⚠️ 0.24 已越过 cow(R=0.195) 的零间隙线，cow 间距仅 0.24px（靠字形侧边距兜住）

const fmt = (v) => v.toFixed(1).padStart(6);
const span = (center, px) => [center - px / 2, center + px / 2];

console.log(`槽 sw=${sw.toFixed(1)} sh=${sh.toFixed(1)}  tw 纵向 ${(+half).toFixed(1)}..${(-half).toFixed(1)}  带高 ${PARK_BAND_H}（槽占 ${SLOT_PAD_TOP}..${(SLOT_PAD_TOP + sh).toFixed(1)}）`);
console.log(`槽内可用宽 ${SW_IN.toFixed(1)}｜两列列宽 ${COL_W}｜计数格式 = 缺口数（单数字）\n`);

const perRowOf = (n) => (n <= 1 ? 1 : 2);
const rowsOf = (n) => Math.max(1, Math.ceil(n / perRowOf(n)));
// 2026-09-26 23:37 重新配平：图标按行数给足空间、字号整体下调（动物是主体、数字是附注）
const ICON = (n) => (n <= 1 ? 24 : n <= 2 ? 20 : n <= 4 ? 18 : 12);
const FS = (n) => (n <= 1 ? 13 : n <= 4 ? 12 : 10);   // 2026-09-27 00:01 再降 2（图标不动）
const rowHOf = (n) => Math.max(ICON(n), Math.min(NEED_ROW_MAX, NEED_BAND_MAX / rowsOf(n)));

let allOk = true;
[1, 2, 3, 4, 6].forEach((n) => {
  const cols = perRowOf(n), rows = rowsOf(n), rowH = rowHOf(n), ip = ICON(n), fs = FS(n);
  const needSpan = (rows - 1) * rowH + ip;
  const blockH = TRUCK_VIS_H + GAP_TRUCK_NEED + needSpan;
  const pad = (sh - blockH) / 2;
  const blockTop = half - pad;
  const needTop = blockTop - TRUCK_VIS_H - GAP_TRUCK_NEED;
  const needCenter = needTop - needSpan / 2;
  const truckCy = blockTop - TRUCK_VIS_H / 2 + TRUCK_VIS_DY;

  // 横向：检查每组是否落在列内（含两位数 SHRINK 的最坏情况）
  const digitW = DIGIT_K * fs, twoW = DIGIT_K * fs * 2;
  const single = n <= 1;
  const textL = ip / 2 - ip * ANIMAL_PAD_R + NEED_GAP;   // 文本框左缘（相对图标中心）
  const groupW = ip / 2 + textL + digitW;                // 紧凑组宽（方框左缘 → 数字右缘）
  const boxes = [];
  let visGap = 0, frameGap = 0, singleFits = true;
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / cols);
    const inRow = Math.min(cols, n - row * cols);
    const x = single || inRow === 1 ? 0 : -(inRow * COL_W) / 2 + (k % cols) * COL_W + COL_W / 2;
    const iconDX = single ? -(groupW / 2) + ip / 2 : -(COL_W / 2) + ip / 2;
    const textLeftRel = iconDX + textL;
    const textW = single ? digitW * 2 : COL_W / 2 - textLeftRel - 1;
    // 最坏：文字实际宽 = min(两位宽, 框宽)（SHRINK）；计数已左对齐 ⇒ 右缘 = 左缘 + 实宽
    const worstW = Math.min(twoW, textW);
    /* 单数字不得触发 SHRINK（2026-09-26 23:xx 新增）：contentSize 必须 ≥ 单数字宽，否则
       Label 会把字号等比缩小 —— 这正是"名义 16px、实际渲染 8px"的机制（见 ParkView 注释）。 */
    if (digitW > textW + 0.01) singleFits = false;
    boxes.push({ k, row, lo: x + iconDX - ip / 2, hi: x + textLeftRel + worstW });
    // 间距校验：本体右缘（= 图标中心 + ip×填充率/2）到字形左缘
    visGap = textLeftRel - (iconDX + ip * (1 - 2 * ANIMAL_PAD_R) / 2);
    frameGap = textLeftRel - (iconDX + ip / 2);          // 方框右缘 → 字形左缘（负 = 落在框内）
  }
  // 同一行内相邻组是否重叠
  let overlap = false;
  boxes.forEach((a) => boxes.forEach((b) => {
    if (a.row === b.row && a.k < b.k && a.hi > b.lo - 0.01 && b.lo < a.hi) overlap = true;
  }));
  const widest = Math.max(...boxes.map((b) => b.hi)) - Math.min(...boxes.map((b) => b.lo));

  // 纵向
  const spans = [];
  for (let r = 0; r < rows; r++) spans.push(span(needCenter + ((rows - 1) * rowH / 2 - r * rowH), ip));
  const needLo = Math.min(...spans.map((s) => s[0]));
  const needHi = Math.max(...spans.map((s) => s[1]));
  const tHi = truckCy + TRUCK_VIS_HI, tLo = truckCy + TRUCK_VIS_LO;
  const cargo = span(truckCy + CARGO_DY, 14);
  const noOverlapV = tLo - needHi >= -0.01 && cargo[0] >= needHi - 0.01;
  const inSlot = needLo >= -half - 0.01 && tHi <= half + 0.01;
  const sym = Math.abs((half - tHi) - (needLo + half));
  if (!noOverlapV || !inSlot || sym > 0.5 || overlap || widest > SW_IN + 0.01
    || Math.abs(visGap - NEED_GAP) > 0.01 || !singleFits) allOk = false;
  console.log(
    `n=${n} ${cols}列×${rows}行 rowH=${rowH.toFixed(2)} icon=${String(ip).padStart(2)} fs=${String(fs).padStart(2)}`
    + ` | 纵: 卡车 ${fmt(tLo)}..${fmt(tHi)} 订单 ${fmt(needLo)}..${fmt(needHi)} 载货 ${fmt(cargo[0])}..${fmt(cargo[1])}`
    + ` | 顶留白=${(half - tHi).toFixed(1)} 车-单=${(tLo - needHi).toFixed(1)} 底留白=${(needLo + half).toFixed(1)} 对称差=${sym.toFixed(1)}`
    + ` | 横: 组宽=${groupW.toFixed(1)} 整体宽=${widest.toFixed(1)}/${SW_IN.toFixed(1)}`
    + ` 本体→数字=${visGap.toFixed(1)}px 方框→数字=${frameGap.toFixed(1)}px`
    + ` 单数字不缩=${singleFits ? 'Y' : 'N'}`
    + ` | ${inSlot && noOverlapV && !overlap && singleFits ? 'OK' : '✗'}`
  );
});

console.log(`\n结论：${allOk ? '全部档位通过（宽度不溢出、上下留白对称、车-单间距固定、无重叠）' : '存在问题，需调整'}`);