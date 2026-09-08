/* 动物四向精灵草稿生成管线（程序化产出，风格与游戏内矢量 100% 同源）
 * 修改时间：2026-09-06 10:55
 * 用法：node tools/gen-animal-sprites.mjs → 生成 tools/sprite-preview.html
 *       浏览器打开后执行页面内 window.exportSprites() 得到 24 张 144×144 PNG 的 base64，
 *       由调用方落盘到 art-draft/animals/{species}_{dir}.png（命名契约见 docs/art-spec.md）。
 * 派生规则（docs/art-spec.md §4）：
 *   down = 原型正面原样；up = 去脸(眼/嘴/鼻/腮) + 物种尾巴；left/right = 3/4 侧脸
 *   （五官整组向朝向侧平移 7）+ 对侧尾巴。身体/描边/配色与现行完全一致。
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const OUT = '#5f4a3a';
const EYE = '#3d2f23';

/* ---------- 物种定义（与原型 animals.js 逐字同源，仅替换 EYE/OUT 常量） ---------- */
const SPECIES = {
  chicken: {
    body:
      '<path d="M26 51v6M38 51v6" fill="none" stroke="#e8912d" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M26.5 22Q32 7 37.5 22Z" fill="#ff6157" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<ellipse cx="13.5" cy="40" rx="4.6" ry="7.6" fill="#f4ead2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="50.5" cy="40" rx="4.6" ry="7.6" fill="#f4ead2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="32" cy="38.5" rx="19" ry="16" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.8"/>',
    face:
      '<circle cx="26" cy="31.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="31.5" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M28 36.5h8l-4 5z" fill="#ffb13d" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M29.5 43q2.5 4 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',
    tail: '<path d="M25 49q7 8 14 0-2 9-7 9t-7-9z" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>',
    tailColor: '#fffdf3',
  },
  duck: {
    body:
      '<path d="M26 53v5M38 53v5" fill="none" stroke="#e8912d" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M47 28q7-2 8 4-4 4-9 1z" fill="#ffd23e" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<ellipse cx="32" cy="39" rx="19" ry="16" fill="#ffd23e" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<path d="M29 23q3-5 6-1" fill="none" stroke="' + OUT + '" stroke-width="2.2" stroke-linecap="round"/>',
    face:
      '<circle cx="26" cy="32.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="32.5" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M25.5 38q6.5-4 13 0-1.5 5-6.5 5t-6.5-5z" fill="#ff9430" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<ellipse cx="19.5" cy="39.5" rx="3" ry="2" fill="#ffb3a0"/>' +
      '<ellipse cx="44.5" cy="39.5" rx="3" ry="2" fill="#ffb3a0"/>',
    tail: '<path d="M37 51q10 2 13-6-7-2-13 6z" fill="#ffd23e" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>',
    tailColor: '#ffd23e',
  },
  rabbit: {
    body:
      '<g transform="rotate(-14 24 16)"><ellipse cx="24" cy="15" rx="4.6" ry="11.5" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.6"/><ellipse cx="24" cy="16.5" rx="2" ry="7" fill="#ffb3c0"/></g>' +
      '<g transform="rotate(14 40 16)"><ellipse cx="40" cy="15" rx="4.6" ry="11.5" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.6"/><ellipse cx="40" cy="16.5" rx="2" ry="7" fill="#ffb3c0"/></g>' +
      '<ellipse cx="32" cy="41" rx="17.5" ry="15" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.8"/>',
    face:
      '<circle cx="26" cy="38" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="38" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M30.3 43.2q1.7-1.6 3.4 0t-1.7 2z" fill="#ff8fa3" stroke="' + OUT + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M29.5 46.5q2.5 2.5 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="20" cy="44.5" rx="3" ry="2" fill="#ffb3c0"/>' +
      '<ellipse cx="44" cy="44.5" rx="3" ry="2" fill="#ffb3c0"/>',
    tail: '<circle cx="32" cy="52" r="5" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.4"/>',
    tailColor: '#fffdf3',
  },
  sheep: {
    body:
      '<ellipse cx="12.5" cy="35" rx="5.4" ry="3.4" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(-16 12.5 35)"/>' +
      '<ellipse cx="51.5" cy="35" rx="5.4" ry="3.4" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(16 51.5 35)"/>' +
      '<g>' +
      [[32, 21.5, 9], [17.5, 29, 10], [46.5, 29, 10], [15, 41.5, 9.5], [49, 41.5, 9.5], [32, 45.5, 11]].map(c =>
        '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="#fffaf0" stroke="' + OUT + '" stroke-width="2.8"/>' +
        '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="#fffaf0"/>').join('') +
      '</g>',
    face:
      '<ellipse cx="32" cy="35" rx="10.5" ry="9" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<circle cx="26" cy="33.5" r="2.6" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33.5" r="2.6" fill="' + EYE + '"/>' +
      '<path d="M29.5 40q2.5 2.5 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',
    tail: '<circle cx="32" cy="52" r="4.5" fill="#fffaf0" stroke="' + OUT + '" stroke-width="2.4"/>',
    tailColor: '#fffaf0',
  },
  pig: {
    body:
      '<path d="M14.5 29Q12 17.5 21.5 19.5L26 26Z" fill="#ffb3c8" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M49.5 29Q52 17.5 42.5 19.5L38 26Z" fill="#ffb3c8" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<ellipse cx="32" cy="39" rx="19.5" ry="16.5" fill="#ffa8bf" stroke="' + OUT + '" stroke-width="2.8"/>',
    face:
      '<circle cx="26" cy="33" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33" r="2.8" fill="' + EYE + '"/>' +
      '<ellipse cx="32" cy="41" rx="8" ry="6" fill="#ff8fae" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<circle cx="29.2" cy="41" r="1.5" fill="#c25d7e"/>' +
      '<circle cx="34.8" cy="41" r="1.5" fill="#c25d7e"/>' +
      '<ellipse cx="18.5" cy="38.5" rx="2.6" ry="1.8" fill="#ff7d9e" opacity=".75"/>' +
      '<ellipse cx="45.5" cy="38.5" rx="2.6" ry="1.8" fill="#ff7d9e" opacity=".75"/>',
    tail: '<path d="M29 51q6 3 9-2t-3-6" fill="none" stroke="#ff8fae" stroke-width="2.6" stroke-linecap="round"/>',
    tailColor: '#ffa8bf',
  },
  cow: {
    body:
      '<path d="M17 22q-6-2.5-5.5-8.5 6.5 1 8.5 6z" fill="#ffd9a0" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M47 22q6-2.5 5.5-8.5-6.5 1-8.5 6z" fill="#ffd9a0" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<ellipse cx="12.5" cy="27.5" rx="5.5" ry="3.4" fill="#f7f1e8" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(-18 12.5 27.5)"/>' +
      '<ellipse cx="51.5" cy="27.5" rx="5.5" ry="3.4" fill="#f7f1e8" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(18 51.5 27.5)"/>' +
      '<ellipse cx="32" cy="39.5" rx="19.5" ry="16.5" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<path d="M19.5 31q7-5.5 10.5 1.5-2.5 6-8.5 3.5-4.5-1.5-2-5z" fill="#5a4a3f"/>' +
      '<path d="M44.5 44q6.5-1 5.5 5-3.5 3.5-8-.5z" fill="#5a4a3f"/>',
    face:
      '<circle cx="26" cy="33.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33.5" r="2.8" fill="' + EYE + '"/>' +
      '<ellipse cx="32" cy="43" rx="8.8" ry="6.4" fill="#ffc9d2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<circle cx="28.8" cy="43" r="1.6" fill="#b36e7c"/>' +
      '<circle cx="35.2" cy="43" r="1.6" fill="#b36e7c"/>',
    tail: '<path d="M40 50q7 3 5 10" fill="none" stroke="' + OUT + '" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="45.5" cy="61" rx="2.6" ry="3.4" fill="#5a4a3f"/>',
    tailColor: '#fdfcf7',
  },
};

/* ---------- 四向派生 ---------- */
function variant(species, dir) {
  const s = SPECIES[species];
  if (dir === 'down') return s.body + s.face;                       // 正面 = 原型原样
  if (dir === 'up') return s.body + s.tail;                         // 背面 = 去脸 + 尾巴
  const dx = dir === 'right' ? 7 : -7;                              // 3/4 侧脸：五官移向朝向侧
  const sideTail = '<ellipse cx="' + (dir === 'right' ? 8 : 56) + '" cy="45" rx="5" ry="6" fill="' +
    s.tailColor + '" stroke="' + OUT + '" stroke-width="2.4"/>';    // 对侧露尾
  return s.body + sideTail + '<g transform="translate(' + dx + ',0)">' + s.face + '</g>';
}

/* ---------- 产出 24 张 SVG + 预览 HTML ---------- */
const sprites = {};
for (const sp of Object.keys(SPECIES)) {
  for (const dir of ['up', 'down', 'left', 'right']) {
    sprites[sp + '_' + dir] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + variant(sp, dir) + '</svg>';
  }
}

const cells = Object.entries(sprites).map(([name, svg]) =>
  '<figure><canvas width="144" height="144" data-name="' + name + '"></canvas><figcaption>' + name + '</figcaption></figure>'
).join('\n');
const spriteJson = JSON.stringify(sprites).replace(/<\//g, '<\\/');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>动物四向精灵草稿预览</title>
<style>
  body { background:#e9f1f8; font-family:sans-serif; padding:16px; }
  .grid { display:grid; grid-template-columns:repeat(8, 144px); gap:10px; }
  figure { margin:0; text-align:center; font-size:12px; color:#4b4237; }
  canvas { background:repeating-conic-gradient(#dfe9f2 0 25%, #ffffff 0 50%) 50%/16px 16px; border-radius:10px; }
  h2 { color:#4b4237; } p { color:#8b95a3; }
</style></head><body>
<h2>动物四向精灵草稿（程序化派生 · 与游戏内矢量同源）</h2>
<p>透明底以棋盘格表示 · 规格 144×144 · 命名 {species}_{dir} · 详见 docs/art-spec.md</p>
<div class="grid">${cells}</div>
<script>
window.SPRITES = ${spriteJson};
window.addEventListener('load', () => {
  document.querySelectorAll('canvas').forEach(cv => {
    const name = cv.dataset.name;
    const img = new Image();
    img.onload = () => cv.getContext('2d').drawImage(img, 0, 0, 144, 144);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.SPRITES[name]);
  });
});
window.exportSprites = () => {
  const out = {};
  const cv = document.createElement('canvas');
  cv.width = 144; cv.height = 144;
  for (const name of Object.keys(window.SPRITES)) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 144, 144);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.SPRITES[name]);
    // 同步绘制依赖 dataURL 已缓存（load 事件后调用）
    ctx.drawImage(img, 0, 0, 144, 144);
    out[name] = cv.toDataURL('image/png').split(',')[1];
  }
  return out;
};
window.exportSpritesAsync = async () => {
  const out = {};
  const cv = document.createElement('canvas');
  cv.width = 144; cv.height = 144;
  const ctx = cv.getContext('2d');
  for (const name of Object.keys(window.SPRITES)) {
    ctx.clearRect(0, 0, 144, 144);
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, 144, 144); res(); };
      img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.SPRITES[name]);
    });
    out[name] = cv.toDataURL('image/png').split(',')[1];
  }
  return out;
};
</script></body></html>`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'sprite-preview.html'), html);
console.log('已生成 tools/sprite-preview.html（24 张四向草稿）。浏览器打开后执行 window.exportSpritesAsync() 导出 PNG base64。');
