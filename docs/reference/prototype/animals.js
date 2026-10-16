/* ============================================================
 * 《动物集市》Q 版动物 SVG 库（全站共用）
 * 风格公式：胶囊身体 + 物种符号 + 点状眼 + 深棕硬描边 + 粉彩糖果色
 * 对标参考：挪车游戏的棋盘箭头语言 + 农场消除游戏的萌系动物
 * ============================================================ */
(function () {
  'use strict';

  var OUT = '#5f4a3a';
  var EYE = '#3d2f23';

  function circles(list, attrs) {
    return list.map(function (c) {
      return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" ' + attrs + '/>';
    }).join('');
  }

  /* 双遍绘制法：先整体描边，再无描边覆盖内部线 → 得到外轮廓完整的云朵形 */
  var SHEEP_WOOL = [[32, 21.5, 9], [17.5, 29, 10], [46.5, 29, 10], [15, 41.5, 9.5], [49, 41.5, 9.5], [32, 45.5, 11]];
  var ALPACA_FLUFF = [[32, 46, 12.5], [20.5, 50, 8.5], [43.5, 50, 8.5]];

  var BODIES = {

    chicken:
      '<path d="M26 51v6M38 51v6" fill="none" stroke="#e8912d" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M26.5 22Q32 7 37.5 22Z" fill="#ff6157" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<ellipse cx="13.5" cy="40" rx="4.6" ry="7.6" fill="#f4ead2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="50.5" cy="40" rx="4.6" ry="7.6" fill="#f4ead2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="32" cy="38.5" rx="19" ry="16" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<circle cx="26" cy="31.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="31.5" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M28 36.5h8l-4 5z" fill="#ffb13d" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M29.5 43q2.5 4 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',

    duck:
      '<path d="M26 53v5M38 53v5" fill="none" stroke="#e8912d" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M47 28q7-2 8 4-4 4-9 1z" fill="#ffd23e" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<ellipse cx="32" cy="39" rx="19" ry="16" fill="#ffd23e" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<path d="M29 23q3-5 6-1" fill="none" stroke="' + OUT + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="26" cy="32.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="32.5" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M25.5 38q6.5-4 13 0-1.5 5-6.5 5t-6.5-5z" fill="#ff9430" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<ellipse cx="19.5" cy="39.5" rx="3" ry="2" fill="#ffb3a0"/>' +
      '<ellipse cx="44.5" cy="39.5" rx="3" ry="2" fill="#ffb3a0"/>',

    rabbit:
      '<g transform="rotate(-14 24 16)"><ellipse cx="24" cy="15" rx="4.6" ry="11.5" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.6"/><ellipse cx="24" cy="16.5" rx="2" ry="7" fill="#ffb3c0"/></g>' +
      '<g transform="rotate(14 40 16)"><ellipse cx="40" cy="15" rx="4.6" ry="11.5" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.6"/><ellipse cx="40" cy="16.5" rx="2" ry="7" fill="#ffb3c0"/></g>' +
      '<ellipse cx="32" cy="41" rx="17.5" ry="15" fill="#fffdf3" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<circle cx="26" cy="38" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="38" r="2.8" fill="' + EYE + '"/>' +
      '<path d="M30.3 43.2q1.7-1.6 3.4 0t-1.7 2z" fill="#ff8fa3" stroke="' + OUT + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M29.5 46.5q2.5 2.5 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="20" cy="44.5" rx="3" ry="2" fill="#ffb3c0"/>' +
      '<ellipse cx="44" cy="44.5" rx="3" ry="2" fill="#ffb3c0"/>',

    sheep:
      '<ellipse cx="12.5" cy="35" rx="5.4" ry="3.4" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(-16 12.5 35)"/>' +
      '<ellipse cx="51.5" cy="35" rx="5.4" ry="3.4" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(16 51.5 35)"/>' +
      '<g>' + circles(SHEEP_WOOL, 'fill="#fffaf0" stroke="' + OUT + '" stroke-width="2.8"') + circles(SHEEP_WOOL, 'fill="#fffaf0"') + '</g>' +
      '<ellipse cx="32" cy="35" rx="10.5" ry="9" fill="#e5cfa5" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<circle cx="26" cy="33.5" r="2.6" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33.5" r="2.6" fill="' + EYE + '"/>' +
      '<path d="M29.5 40q2.5 2.5 5 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',

    pig:
      '<path d="M14.5 29Q12 17.5 21.5 19.5L26 26Z" fill="#ffb3c8" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M49.5 29Q52 17.5 42.5 19.5L38 26Z" fill="#ffb3c8" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<ellipse cx="32" cy="39" rx="19.5" ry="16.5" fill="#ffa8bf" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<circle cx="26" cy="33" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33" r="2.8" fill="' + EYE + '"/>' +
      '<ellipse cx="32" cy="41" rx="8" ry="6" fill="#ff8fae" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<circle cx="29.2" cy="41" r="1.5" fill="#c25d7e"/>' +
      '<circle cx="34.8" cy="41" r="1.5" fill="#c25d7e"/>' +
      '<ellipse cx="18.5" cy="38.5" rx="2.6" ry="1.8" fill="#ff7d9e" opacity=".75"/>' +
      '<ellipse cx="45.5" cy="38.5" rx="2.6" ry="1.8" fill="#ff7d9e" opacity=".75"/>',

    cow:
      '<path d="M17 22q-6-2.5-5.5-8.5 6.5 1 8.5 6z" fill="#ffd9a0" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M47 22q6-2.5 5.5-8.5-6.5 1-8.5 6z" fill="#ffd9a0" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<ellipse cx="12.5" cy="27.5" rx="5.5" ry="3.4" fill="#f7f1e8" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(-18 12.5 27.5)"/>' +
      '<ellipse cx="51.5" cy="27.5" rx="5.5" ry="3.4" fill="#f7f1e8" stroke="' + OUT + '" stroke-width="2.4" transform="rotate(18 51.5 27.5)"/>' +
      '<ellipse cx="32" cy="39.5" rx="19.5" ry="16.5" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<path d="M19.5 31q7-5.5 10.5 1.5-2.5 6-8.5 3.5-4.5-1.5-2-5z" fill="#5a4a3f"/>' +
      '<path d="M44.5 44q6.5-1 5.5 5-3.5 3.5-8-.5z" fill="#5a4a3f"/>' +
      '<circle cx="26" cy="33.5" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="33.5" r="2.8" fill="' + EYE + '"/>' +
      '<ellipse cx="32" cy="43" rx="8.8" ry="6.4" fill="#ffc9d2" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<circle cx="28.8" cy="43" r="1.6" fill="#b36e7c"/>' +
      '<circle cx="35.2" cy="43" r="1.6" fill="#b36e7c"/>',

    alpaca:
      '<path d="M22 18 19 9l8 4z" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M42 18 45 9l-8 4z" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M26.5 45V27q0-8.5 5.5-8.5t5.5 8.5v18z" fill="#f2e7d5" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<g>' + circles(ALPACA_FLUFF, 'fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.8"') + circles(ALPACA_FLUFF, 'fill="#fdfcf7"') + '</g>' +
      '<ellipse cx="32" cy="23" rx="10" ry="8.5" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<circle cx="32" cy="15.5" r="5" fill="#fdfcf7" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<circle cx="27" cy="21" r="2.5" fill="' + EYE + '"/>' +
      '<circle cx="37" cy="21" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M28.5 26q3.5 3 7 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',

    peacock:
      '<g stroke="' + OUT + '" stroke-width="2.4">' +
        '<circle cx="10" cy="26" r="7" fill="#58c06c"/><circle cx="54" cy="26" r="7" fill="#58c06c"/>' +
        '<circle cx="14" cy="13" r="7" fill="#58c06c"/><circle cx="50" cy="13" r="7" fill="#58c06c"/><circle cx="32" cy="7.5" r="7" fill="#58c06c"/>' +
      '</g>' +
      '<g fill="#3d9ee0" stroke="' + OUT + '" stroke-width="1.6">' +
        '<circle cx="10" cy="26" r="2.6"/><circle cx="54" cy="26" r="2.6"/><circle cx="14" cy="13" r="2.6"/><circle cx="50" cy="13" r="2.6"/><circle cx="32" cy="7.5" r="2.6"/>' +
      '</g>' +
      '<ellipse cx="32" cy="38" rx="16" ry="17" fill="#4aa3e8" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<ellipse cx="32" cy="41" rx="8.5" ry="10" fill="#6dbcf0" stroke="' + OUT + '" stroke-width="2.2"/>' +
      '<path d="M29 20v-6M35 20v-6M32 20v-8" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="29" cy="13" r="2" fill="#58c06c" stroke="' + OUT + '" stroke-width="1.4"/>' +
      '<circle cx="35" cy="13" r="2" fill="#58c06c" stroke="' + OUT + '" stroke-width="1.4"/>' +
      '<circle cx="32" cy="11" r="2" fill="#58c06c" stroke="' + OUT + '" stroke-width="1.4"/>' +
      '<circle cx="27" cy="31" r="2.5" fill="' + EYE + '"/>' +
      '<circle cx="37" cy="31" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M30 36.5q2 2 4 0" fill="none" stroke="' + OUT + '" stroke-width="2" stroke-linecap="round"/>',

    deer:
      '<g fill="none" stroke="#a97c50" stroke-width="2.8" stroke-linecap="round">' +
        '<path d="M22.5 21Q21 12 15 10"/><path d="M19.5 15Q14 15 12 10"/>' +
        '<path d="M41.5 21Q43 12 49 10"/><path d="M44.5 15Q50 15 52 10"/>' +
      '</g>' +
      '<ellipse cx="13" cy="24" rx="5" ry="3" fill="#f3d3a4" stroke="' + OUT + '" stroke-width="2.2" transform="rotate(-14 13 24)"/>' +
      '<ellipse cx="51" cy="24" rx="5" ry="3" fill="#f3d3a4" stroke="' + OUT + '" stroke-width="2.2" transform="rotate(14 51 24)"/>' +
      '<ellipse cx="32" cy="39" rx="19" ry="16.5" fill="#f3d3a4" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<circle cx="22" cy="33" r="2" fill="#fff8ea"/><circle cx="29" cy="29" r="2" fill="#fff8ea"/><circle cx="39" cy="31" r="2" fill="#fff8ea"/>' +
      '<circle cx="45" cy="37" r="2" fill="#fff8ea"/><circle cx="24" cy="42" r="2" fill="#fff8ea"/><circle cx="36" cy="45" r="2" fill="#fff8ea"/>' +
      '<circle cx="26" cy="35" r="2.8" fill="' + EYE + '"/>' +
      '<circle cx="38" cy="35" r="2.8" fill="' + EYE + '"/>' +
      '<ellipse cx="32" cy="44" rx="7.5" ry="5.5" fill="#ffdfb0" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<circle cx="29.5" cy="43.5" r="1.4" fill="#a97c50"/>' +
      '<circle cx="34.5" cy="43.5" r="1.4" fill="#a97c50"/>'
  };

  var RARE_DECO =
    '<g fill="#ffd24d" stroke="#d9990a" stroke-width="1.5" stroke-linejoin="round">' +
      '<path d="M51 5l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/>' +
      '<path d="M11 43l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z"/>' +
      '<path d="M53 41l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/>' +
    '</g>';

  var ROCK =
    '<path d="M13 47q-5-13 5-22 8-7 17-3 12 5 12 17 0 11-10 13-9 2-16 0-9-2-8-5z" fill="#cbc4ba" stroke="' + OUT + '" stroke-width="2.8" stroke-linejoin="round"/>' +
    '<path d="M23 25l7 8-10 6M39 23l-9 10 13 7" fill="none" stroke="#a8a094" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M12 49q2-5 4 0M45 47q2-5 4 0" fill="none" stroke="#58c06c" stroke-width="2.2" stroke-linecap="round"/>';

  function truckBody(color, stripe) {
    return '<rect x="7" y="13" width="50" height="36" rx="10" fill="' + color + '" stroke="' + OUT + '" stroke-width="2.8"/>' +
      '<rect x="13" y="20" width="38" height="13" rx="6" fill="#c3e8f7" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<path d="M13 38h38" stroke="' + stripe + '" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="18" cy="49" r="7" fill="#5a4a3f" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<circle cx="46" cy="49" r="7" fill="#5a4a3f" stroke="' + OUT + '" stroke-width="2.6"/>' +
      '<circle cx="18" cy="49" r="2.6" fill="#c9c2b8"/><circle cx="46" cy="49" r="2.6" fill="#c9c2b8"/>' +
      '<circle cx="13" cy="44" r="2.6" fill="#fff3dd" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="51" cy="44" r="2.6" fill="#fff3dd" stroke="' + OUT + '" stroke-width="1.8"/>';
  }

  var COIN =
    '<circle cx="32" cy="32" r="26" fill="#ffc93c" stroke="#d9990a" stroke-width="3"/>' +
    '<circle cx="32" cy="32" r="19" fill="none" stroke="#d9990a" stroke-width="2.4"/>' +
    '<path d="M32 22l2.5 6.6 7 .3-5.3 4.5 1.6 6.9-5.8-3.4-5.8 3.4 1.6-6.9-5.3-4.5 7-.3z" fill="#ffe9a8" stroke="#d9990a" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M21 17q-5 4-5.5 10" fill="none" stroke="#ffe9a8" stroke-width="4" stroke-linecap="round"/>';

  var CLAW =
    '<path d="M32 4v12" fill="none" stroke="#7d8894" stroke-width="4.5" stroke-linecap="round"/>' +
    '<rect x="21" y="16" width="22" height="11" rx="4.5" fill="#9d7df5" stroke="' + OUT + '" stroke-width="2.6"/>' +
    '<path d="M25 27q-7 15 4 20" fill="none" stroke="#9d7df5" stroke-width="5.5" stroke-linecap="round"/>' +
    '<path d="M39 27q7 15-4 20" fill="none" stroke="#9d7df5" stroke-width="5.5" stroke-linecap="round"/>';

  var LOCK =
    '<rect x="5" y="10" width="14" height="10" rx="2.5" fill="#ffffff"/>' +
    '<path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>';

  var ARROW =
    '<path d="M32 12L50 34H39V52H25V34H14Z" fill="#ffffff" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';

  var VIDEO =
    '<rect x="6" y="14" width="38" height="36" rx="9" fill="#ff5b5b" stroke="' + OUT + '" stroke-width="2.8"/>' +
    '<path d="M26 24l14 8-14 8z" fill="#ffffff" stroke="' + OUT + '" stroke-width="2" stroke-linejoin="round"/>';

  function wrap(inner, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 64 64" aria-hidden="true">' + inner + '</svg>';
  }

  window.AM = window.AM || {};
  AM.animals = {
    svg: function (id, opts) {
      opts = opts || {};
      var body = BODIES[id] || BODIES.chicken;
      return wrap(body + (opts.rare ? RARE_DECO : ''), 'am-animal' + (opts.rare ? ' am-rare' : ''));
    },
    has: function (id) { return Object.prototype.hasOwnProperty.call(BODIES, id); },
    rock: function () { return wrap(ROCK, 'am-rock'); },
    truck: function (color, stripe) { return wrap(truckBody(color || '#ffcf3e', stripe || '#ff9d2b'), 'am-truck'); },
    coin: function () { return wrap(COIN, 'am-coin'); },
    claw: function () { return wrap(CLAW, 'am-claw'); },
    arrow: function () { return wrap(ARROW, 'am-arrow'); },
    video: function () { return wrap(VIDEO, 'am-video'); },
    lock: function () { return wrap(LOCK, 'am-lock'); }
  };

  document.querySelectorAll('.rail-logo').forEach(function (el) {
    el.innerHTML = AM.animals.svg('chicken');
  });
})();
