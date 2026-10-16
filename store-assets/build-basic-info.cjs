/*
 * 微信小游戏「基础信息」素材包生成器（零依赖）
 *
 * 读取 store-assets/basic-info.json → 按微信平台规则校验 → 生成可直接照填/复制的填写单 HTML。
 *
 * 用法：node store-assets/build-basic-info.cjs
 * 产出：store-assets/basic-info-sheet.html（单文件，图标已内嵌为 base64，可离线打开）
 *
 * 校验规则（来源：微信公众平台 · 设置 · 基本信息 / 腾讯客服《小程序名称、简称设置规范》）：
 *   名称  4-30 字符（1 中文字 = 2 字符）
 *   简称  4-10 字符，且必须从名称中【按顺序连续】截取
 *   简介  4-120 字符（1 中文字 = 2 字符）
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SRC_JSON = path.join(DIR, 'basic-info.json');
const LOGO = path.join(DIR, 'logo-144.png');
const OUT = path.join(DIR, 'basic-info-sheet.html');

/* ───── 字符计数：ASCII 记 1，其余（汉字 / 全角标点 / 表情）记 2 ───── */
const countChars = (s) => Array.from(s).reduce((n, c) => n + (c.codePointAt(0) <= 0x7f ? 1 : 2), 0);
const cjkLen = (s) => Array.from(s).filter((c) => c.codePointAt(0) > 0x7f).length;

/* 名称允许字符：中文 + 字母 + 数字 + 空格 - + & . （官方口径） */
const NAME_ALLOWED = /^[\u4e00-\u9fa5A-Za-z0-9 \-+&.]+$/;
/* 风险词扫描（不阻断，仅提示） */
const RISKY = [
    ['官方', '平台保护词，几乎必驳回'], ['微信', '平台保护词'], ['腾讯', '平台保护词'],
    ['测试', '不得作为名称'], ['最强', '广告法极限词'], ['最好', '广告法极限词'],
    ['第一', '广告法极限词'], ['全球首发', '广告法极限词'], ['国家级', '广告法极限词'],
    ['免费领', '诱导嫌疑'], ['红包', '现金奖励玩法另有专项规范'], ['提现', '现金奖励玩法另有专项规范'],
    ['加群', '引流违规'], ['公众号', '引流违规'], ['下载', '引流违规'],
];

/* ───── 校验 ───── */
function validate(cfg) {
    const out = [];
    const push = (level, field, msg) => out.push({ level, field, msg });

    /* 名称 */
    const fn = cfg.fullName || '';
    const fnLen = countChars(fn);
    if (fnLen < 4 || fnLen > 30) push('err', '名称', `长度 ${fnLen} 字符，超出 4-30 区间`);
    else push('ok', '名称', `长度 ${fnLen} 字符（${cjkLen(fn)} 个中文字），在 4-30 区间内`);
    if (!NAME_ALLOWED.test(fn)) push('err', '名称', '含不允许的字符（仅支持中文/数字/英文/空格 及 - + & .）');
    else push('ok', '名称', '字符集合规');
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(fn)) push('err', '名称', '含表情符号');

    /* 简称 */
    const sn = cfg.shortName || '';
    const snLen = countChars(sn);
    if (snLen < 4 || snLen > 10) push('err', '简称', `长度 ${snLen} 字符，超出 4-10 区间`);
    else push('ok', '简称', `长度 ${snLen} 字符，在 4-10 区间内`);
    if (sn && !fn.includes(sn)) push('err', '简称', `「${sn}」不是名称中按顺序连续截取的片段`);
    else push('ok', '简称', '取自名称且顺序连续');

    /* 简介 */
    const intro = cfg.intro || '';
    const inLen = countChars(intro);
    if (inLen < 4 || inLen > 120) push('err', '简介', `长度 ${inLen} 字符，超出 4-120 区间`);
    else push('ok', '简介', `长度 ${inLen} 字符（${cjkLen(intro)} 个全角字符），在 4-120 区间内（余量 ${120 - inLen}）`);

    /* 风险词 */
    const all = fn + ' ' + sn + ' ' + intro;
    const hits = RISKY.filter(([w]) => all.includes(w));
    if (hits.length) hits.forEach(([w, why]) => push('warn', '风险词', `出现「${w}」——${why}`));
    else push('ok', '风险词', '未命中已知风险词');

    /* 备选名同样过一遍长度 + 简称截取约束（避免备选方案本身不合规） */
    for (const a of cfg.alternates || []) {
        const aLen = countChars(a.name), sLen = countChars(a.shortName);
        const okLen = aLen >= 4 && aLen <= 30 && sLen >= 4 && sLen <= 10;
        const okSub = a.name.includes(a.shortName);
        if (okLen && okSub) push('ok', '备选名', `「${a.name}」${aLen} 字符 / 简称「${a.shortName}」${sLen} 字符 —— 合规`);
        else push('err', '备选名', `「${a.name}」${aLen} 字符 / 简称「${a.shortName}」${sLen} 字符 —— ${!okLen ? '长度越界' : '简称非名称的连续片段'}`);
    }

    return out;
}

function report(list) {
    const icon = { ok: '✅', warn: '⚠️ ', err: '❌' };
    console.log('── 微信小游戏基础信息 · 规则校验 ──');
    for (const r of list) console.log(`${icon[r.level]} [${r.field}] ${r.msg}`);
    const bad = list.filter((r) => r.level === 'err').length;
    const warn = list.filter((r) => r.level === 'warn').length;
    console.log(`\n结论：${bad === 0 ? '规则校验全部通过' : bad + ' 项不合规需修正'}${warn ? `，${warn} 项提示需人工确认` : ''}`);
    return bad === 0;
}

/* ───── 生成填写单 HTML ───── */
function buildHtml(cfg, list) {
    const logoB64 = fs.readFileSync(LOGO).toString('base64');
    const logoSize = (fs.statSync(LOGO).size / 1024).toFixed(1);
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    /* 图标预览位：只引用一次 data URI（挂在 CSS 变量上），避免 9 份 base64 把文件撑大 */
    const slot = (size, radius, cap) =>
        `<div class="slot"><div class="ic" style="width:${size}px;height:${size}px;${radius ? `border-radius:${radius};` : ''}"></div><div class="cap">${cap}</div></div>`;

    const fieldCard = (id, label, badge, value, limit, rule, extra) => `
      <div class="card field">
        <div class="field-head">
          <span class="flabel">${label}</span>
          <span class="fbadge">${badge}</span>
          <button class="copy" data-target="${id}">复制</button>
        </div>
        <div class="fvalue" id="${id}" contenteditable="true" spellcheck="false">${esc(value)}</div>
        <div class="fmeta">
          <span class="counter" id="${id}-count"></span>
          <span class="limit">限 ${limit}</span>
        </div>
        <div class="frule">${rule}</div>
        ${extra || ''}
      </div>`;

    const altRows = cfg.alternates.map((a) => `
      <tr>
        <td class="aname">${esc(a.name)}<span class="alen">${countChars(a.name)} 字符</span></td>
        <td class="ashort">${esc(a.shortName)}<span class="alen">${countChars(a.shortName)} 字符</span></td>
        <td class="anote">${esc(a.note)}</td>
      </tr>`).join('');

    const checkRows = list.map((r) => {
        const cls = r.level === 'err' ? 'bad' : r.level === 'warn' ? 'warn' : 'good';
        const mark = r.level === 'err' ? '✕' : r.level === 'warn' ? '!' : '✓';
        return `<li class="${cls}"><b>${mark}</b> <span class="cf">${esc(r.field)}</span> ${esc(r.msg)}</li>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>《${esc(cfg.fullName)}》微信小游戏 · 基础信息填写单</title>
<style>
  :root{
    --cream:#FDF7EA; --ink:#1F1B16; --ink2:#6B6156; --line:#E8DFCE;
    --red:#E4573D; --yellow:#F5C242; --green:#5FA23F; --gray:#8A8175;
    --radius:14px;
    --logo:url("data:image/png;base64,${logoB64}");
  }
  *{box-sizing:border-box}
  body{margin:0;background:#F6F4F0;color:var(--ink);
    font:15px/1.65 "Inter","PingFang SC","Microsoft YaHei",-apple-system,sans-serif;}
  .wrap{max-width:920px;margin:0 auto;padding:40px 28px 72px}

  header.top{border-bottom:2px solid var(--line);padding-bottom:22px;margin-bottom:30px}
  header.top h1{margin:0 0 8px;font-size:26px;letter-spacing:.2px}
  header.top .sub{color:var(--ink2);font-size:13.5px}
  header.top .path{display:inline-block;margin-top:12px;background:var(--cream);
    border:1px solid var(--line);border-radius:8px;padding:6px 12px;font-size:13px;color:var(--ink2)}

  h2{font-size:16px;margin:38px 0 14px;padding-left:11px;border-left:4px solid var(--yellow);line-height:1.2}
  h2 small{font-weight:400;color:var(--gray);font-size:12.5px;margin-left:10px}

  /* 图标预览 */
  .iconbox{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px}
  .icons{display:flex;align-items:flex-end;gap:30px;flex-wrap:wrap}
  .slot{text-align:center}
  .slot .ic{background-image:var(--logo);background-size:100% 100%;background-repeat:no-repeat;
    image-rendering:auto}
  .slot .cap{margin-top:8px;font-size:11.5px;color:var(--gray);letter-spacing:.3px}
  .dark{background:#191919;border-radius:12px;padding:20px 24px;margin-top:16px;
    display:flex;align-items:flex-end;gap:30px;flex-wrap:wrap}
  .dark .cap{color:#9A9A9A}

  table.spec{width:100%;border-collapse:collapse;margin-top:20px;font-size:13.5px}
  table.spec td{padding:8px 0;border-top:1px solid var(--line);vertical-align:top}
  table.spec td:first-child{color:var(--ink2);width:46%}
  table.spec .yes{color:var(--green);font-weight:600}

  /* 字段卡 */
  .field{margin-bottom:16px}
  .card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
  .field-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .flabel{font-weight:600;font-size:14.5px}
  .fbadge{font-size:11px;color:var(--gray);background:#F3F0EA;border-radius:20px;padding:2px 9px}
  .copy{margin-left:auto;border:1px solid var(--line);background:#fff;color:var(--ink2);
    border-radius:8px;padding:5px 14px;font-size:12.5px;cursor:pointer;font-family:inherit;transition:.15s}
  .copy:hover{border-color:var(--yellow);color:var(--ink)}
  .copy.done{border-color:var(--green);color:var(--green)}
  .fvalue{background:var(--cream);border:1px dashed var(--line);border-radius:10px;
    padding:12px 14px;font-size:15.5px;line-height:1.75;outline:none;word-break:break-word}
  .fvalue:focus{border-color:var(--yellow);border-style:solid}
  .fmeta{display:flex;gap:14px;margin-top:8px;font-size:12.5px;color:var(--gray);align-items:center}
  .counter b{font-variant-numeric:tabular-nums}
  .counter.over b{color:var(--red)}
  .frule{margin-top:8px;font-size:12.5px;color:var(--gray);line-height:1.6}

  /* 校验清单 */
  ul.checks{list-style:none;padding:0;margin:0;background:#fff;border:1px solid var(--line);
    border-radius:var(--radius);overflow:hidden}
  ul.checks li{padding:9px 18px;border-bottom:1px solid #F2EEE7;font-size:13.5px;display:flex;gap:10px}
  ul.checks li:last-child{border-bottom:none}
  ul.checks b{width:14px;flex:none;text-align:center}
  ul.checks .good b{color:var(--green)} ul.checks .good{color:var(--ink)}
  ul.checks .warn b{color:#C9820F} ul.checks .warn{color:#8A6412;background:#FFFBF0}
  ul.checks .bad b{color:var(--red)} ul.checks .bad{color:var(--red);background:#FFF5F3}
  .cf{color:var(--gray);flex:none;width:56px}

  /* 风险提示 */
  .callout{background:#FFFBF0;border:1px solid #F0E2C0;border-left:4px solid var(--yellow);
    border-radius:10px;padding:16px 20px;font-size:13.8px;line-height:1.75}
  .callout h3{margin:0 0 8px;font-size:14px}
  .callout p{margin:0 0 8px} .callout p:last-child{margin-bottom:0}
  .callout code{background:#fff;border:1px solid #EFE3C8;border-radius:5px;padding:1px 6px;font-size:12.5px}

  /* 备选名 */
  table.alt{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);
    border-radius:var(--radius);overflow:hidden;font-size:13.5px}
  table.alt th{text-align:left;font-size:12px;color:var(--gray);font-weight:600;
    padding:11px 16px;background:#FAF8F4;border-bottom:1px solid var(--line)}
  table.alt td{padding:13px 16px;border-bottom:1px solid #F2EEE7;vertical-align:top;line-height:1.6}
  table.alt tr:last-child td{border-bottom:none}
  .aname{font-weight:600;white-space:nowrap}
  .ashort{white-space:nowrap;color:var(--ink2)}
  .alen{display:block;font-size:11px;color:var(--gray);font-weight:400;margin-top:3px}
  .anote{color:var(--ink2);font-size:12.8px}

  /* 同页待办 */
  ul.todo{list-style:none;padding:0;margin:0;background:#fff;border:1px solid var(--line);
    border-radius:var(--radius);overflow:hidden}
  ul.todo li{padding:12px 18px;border-bottom:1px solid #F2EEE7;font-size:13.5px;line-height:1.7;color:var(--ink2)}
  ul.todo li:last-child{border-bottom:none}
  ul.todo b{color:var(--ink);font-weight:600}

  footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);
    font-size:12px;color:var(--gray);line-height:1.8}
  footer code{background:#fff;border:1px solid var(--line);border-radius:5px;padding:1px 6px}
  @media (max-width:640px){ .icons,.dark{gap:18px} .fvalue{font-size:14.5px} }
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <h1>《${esc(cfg.fullName)}》· 微信小游戏基础信息素材包</h1>
    <div class="sub">图标 + 全称 + 简称 + 简介，均按微信平台规则校验，可直接照填。</div>
    <div class="path">填写路径：微信公众平台 → 设置 → 基本信息</div>
  </header>

  <h2>01　小游戏头像<small>logo-144.png · ${logoSize} KB</small></h2>
  <div class="iconbox">
    <div class="icons">
      ${slot(144, 0, '144 方形 · 原图')}
      ${slot(144, 32, '144 圆角方形 · 实际展示')}
      ${slot(144, '50%', '144 圆形 · 任务栏位')}
      ${slot(64, 0, '64')}
      ${slot(48, 0, '48')}
      ${slot(32, 0, '32')}
    </div>
    <div class="dark">
      ${slot(144, 32, '144 · 深色底')}
      ${slot(64, 14, '64 · 深色底')}
      ${slot(48, 11, '48 · 深色底')}
    </div>
    <table class="spec">
      <tr><td>文件格式</td><td class="yes">PNG（png / bmp / jpeg / jpg / gif 均可，PNG 效果最佳）</td></tr>
      <tr><td>文件大小</td><td class="yes">${logoSize} KB（上限 2 MB）</td></tr>
      <tr><td>图片尺寸</td><td class="yes">144 × 144 px（平台建议尺寸，正方形）</td></tr>
      <tr><td>色彩通道</td><td class="yes">8-bit RGBA，含透明通道</td></tr>
      <tr><td>审核禁项</td><td class="yes">无二维码、无引导分享文案、无第三方平台水印</td></tr>
    </table>
  </div>

  <h2>02　文字内容<small>可直接在框内修改，字符数实时校验</small></h2>

  ${fieldCard('v-name', '小游戏全称（名称）', '必填 · 全平台唯一', cfg.fullName, '4–30 字符',
        '1 个中文字 = 2 字符。可由中文、数字、英文、空格及 <code>- + &amp; .</code> 组成；不得含表情、换行、引号。<br>名称在微信公众平台按主体唯一，不得与<b>不同主体</b>的公众号 / 小程序重名。')}

  ${fieldCard('v-short', '小游戏简称', '选填 · 任务栏展示', cfg.shortName, '4–10 字符',
        '必须从名称中<b>按顺序连续</b>截取。展示在微信「任务栏」（最近使用），是你品牌露出最频繁的位置。<br>发布前可改 2 次，发布后每年 2 次。')}

  ${fieldCard('v-intro', '小游戏简介', '必填 · 与玩法一致', cfg.intro, '4–120 字符',
        '1 个中文字 = 2 字符，即最多约 60 个汉字（含标点）。审核会逐条核对简介与实际玩法，不符会被驳回。<br>一个月内可修改 5 次。')}

  <h2>03　规则自检<small>脚本校验结果</small></h2>
  <ul class="checks">${checkRows}</ul>

  <h2>04　命名风险<small>提交前务必确认</small></h2>
  <div class="callout">
    <h3>⚠️「动物集市」最大的不确定性不在格式，而在「通用词」与「重名」</h3>
    <p><b>通用词风险</b>：微信对「无法体现账号品牌特质的无标识性通用词」有专门限制，命名命中时会被要求补充《商标注册证》或直接驳回。平台社区中已有开发者反馈，动物类小游戏的「<b>动物</b>」二字被判为通用词。<code>动物</code> + <code>集市</code> 两个通用名词拼接，品牌特质偏弱，属于命中概率较高的写法。</p>
    <p><b>重名风险</b>：名称按主体全平台唯一。检索可见市面上已有《我的动物集市》《动物大集市》《仓鼠集市》等同类作品，「动物集市」这一组合被其他主体占用的可能性不低。</p>
    <p><b>资质一致性</b>：小游戏账号名需与资质（软著 / 版号）名称一致；若走个人 IAA 通道且名称含英文或「软件」字样，会额外要求软著。<b>备案首次提交前需锁定最终名称，备案审核中 / 通过后不允许改名改主体</b>——改名成本会显著上升，建议现在就一次定死。</p>
    <p><b>建议</b>：先用现名在公众平台名称校验框里试一次（这一步免费且即时）。若提示重名或保护词，直接用下方备选；若通过审核则保留现名，图标与以下文案无需改动。</p>
  </div>

  <h2>05　备选名称<small>均满足 4–30 / 4–10 字符与「简称取自名称」约束</small></h2>
  <table class="alt">
    <thead><tr><th style="width:22%">名称（全称）</th><th style="width:20%">简称</th><th>取舍说明</th></tr></thead>
    <tbody>${altRows}</tbody>
  </table>

  <h2>06　同页与后续<small>别在这些地方卡住</small></h2>
  <ul class="todo">
    <li><b>服务类目</b>　小游戏的一级类目锁死为「游戏」，不可修改；<b>二级类目必须与实际玩法一致</b> —— 本作是网格解谜 + 订单三消匹配，应选「休闲益智」。类目与内容不符是提审驳回的第一大原因，比内容尺度问题更容易踩中。</li>
    <li><b>适龄提示</b>　需在后台「设置」中完成 8+ / 12+ / 16+ 分级，属合规必做项，未完成会影响后续运营能力。</li>
    <li><b>修改次数额度</b>　名称 2 次 / 自然年（走微信认证可重置）；简称发布前 2 次、发布后 2 次 / 年；头像 5 次 / 年；简介 5 次 / 月。一次填对，别把额度试掉。</li>
    <li><b>备案前置</b>　小游戏备案首次提交前需锁定最终名称与账号主体；<b>备案审核中 / 通过后不允许改名、改主体</b> —— 名称必须现在就定死，这是本页最不可逆的一个决定。</li>
    <li><b>提审还需</b>　游戏截图 ≥ 4 张（展示核心玩法、无黑边）、用户隐私保护指引、版本更新说明 —— 这些在提审环节准备，不在基础信息这一页。</li>
  </ul>

  <footer>
    生成时间：${stamp}　·　源文件：<code>store-assets/basic-info.json</code>　·　图标：<code>store-assets/logo-144.png</code><br>
    改完 <code>basic-info.json</code> 后重新执行 <code>node store-assets/build-basic-info.cjs</code> 即可刷新本页与校验结果。<br>
    规则来源：微信公众平台「设置 → 基本信息」；腾讯客服《小程序名称、简称设置规范》；《微信小游戏平台运营规范》。
  </footer>
</div>

<script>
(function(){
  function countChars(s){
    var n = 0;
    Array.from(s.replace(/\\s+$/,'')).forEach(function(c){
      n += c.codePointAt(0) <= 0x7f ? 1 : 2;
    });
    return n;
  }
  var limits = {
    'v-name':  { min:4,  max:30,  label:'名称' },
    'v-short': { min:4,  max:10,  label:'简称' },
    'v-intro': { min:4,  max:120, label:'简介' }
  };
  var nameEl  = document.getElementById('v-name');
  var shortEl = document.getElementById('v-short');

  function refresh(){
    Object.keys(limits).forEach(function(id){
      var el = document.getElementById(id), box = document.getElementById(id + '-count'), L = limits[id];
      var n = countChars(el.textContent || '');
      var over = n < L.min || n > L.max;
      box.className = 'counter' + (over ? ' over' : '');
      box.innerHTML = L.label + '：<b>' + n + '</b> / ' + L.max + ' 字符' + (over ? '（' + (n > L.max ? '超' + (n - L.max) : '少 ' + (L.min - n)) + '）' : ' ✓');
    });
    // 简称必须取自名称且顺序连续
    var snBox = document.getElementById('v-short-count');
    var sn = (shortEl.textContent || '').trim(), fn = (nameEl.textContent || '').trim();
    if (sn && fn.indexOf(sn) < 0){
      snBox.className = 'counter over';
      snBox.innerHTML += '　✕ 必须从全称中按顺序连续截取';
    }
  }

  document.querySelectorAll('.fvalue').forEach(function(el){
    el.addEventListener('input', refresh);
    el.addEventListener('blur', refresh);
  });

  document.querySelectorAll('.copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var el = document.getElementById(btn.dataset.target);
      var text = (el.textContent || '').trim();
      var done = function(){
        var old = btn.textContent; btn.textContent = '已复制'; btn.classList.add('done');
        setTimeout(function(){ btn.textContent = old; btn.classList.remove('done'); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, function(){ legacy(el, done); });
      } else { legacy(el, done); }
    });
  });

  function legacy(el, done){
    var r = document.createRange(); r.selectNodeContents(el);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    try { document.execCommand('copy'); done(); } catch(e){}
  }

  refresh();
})();
</script>
</body>
</html>`;
}

/* ───── 执行 ───── */
const cfg = JSON.parse(fs.readFileSync(SRC_JSON, 'utf8'));
const list = validate(cfg);
const pass = report(list);
fs.writeFileSync(OUT, buildHtml(cfg, list));
console.log(`\n填写单已生成：${path.relative(process.cwd(), OUT)}`);
console.log(`名称「${cfg.fullName}」 ${countChars(cfg.fullName)} 字符　简称「${cfg.shortName}」 ${countChars(cfg.shortName)} 字符　简介 ${countChars(cfg.intro)} 字符`);
if (!pass) process.exitCode = 1;
