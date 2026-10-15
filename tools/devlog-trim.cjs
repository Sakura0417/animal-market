/* DEVLOG 热区/冷归档工具（2026-09-26 23:18）：把 DEVLOG.md 热区（默认最近 30 条）之外的最旧条目
 * 原样搬运到 docs/devlog/DEVLOG-YYYY-MM.md（按条目日期所在月），并对全部条目做严格时间倒序归一
 * + 刷新 DEVLOG.md 内的归档索引表。
 * 目的：DEVLOG.md 体积封顶（≈55KB / 30 条），不再随开发进度无限增长；历史按月冷存、rg 检索。
 * 用法：node tools/devlog-trim.cjs            # 归档 + 刷新索引
 *       node tools/devlog-trim.cjs --dry      # 只打印计划，不写文件
 *       node tools/devlog-trim.cjs --keep=20  # 临时改热区条数（默认 30）
 * 纪律：条目内容零改写（只换位置、分隔线统一为 ---）；条目总数必须守恒，不守恒即报错退出。
 * 注意：DEVLOG.md 头部强制规则第 3 条与本工具绑定，改阈值须同步改两处。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEVLOG = path.join(ROOT, 'DEVLOG.md');
const ARCHIVE_DIR = path.join(ROOT, 'docs', 'devlog');
const KEEP_DEFAULT = 30;
const ENTRY_RE = /^## \[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/;
const IDX_BEGIN = '<!-- DEVLOG-INDEX:BEGIN -->';
const IDX_END = '<!-- DEVLOG-INDEX:END -->';
const EOL = '\r\n';                                  // 与仓库主流换行保持一致

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const keepArg = argv.find(a => a.startsWith('--keep='));
const KEEP = keepArg ? Math.max(1, parseInt(keepArg.split('=')[1], 10) || KEEP_DEFAULT) : KEEP_DEFAULT;

const readIf = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const kb = s => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(0);
const toEol = s => s.replace(/\r?\n/g, EOL);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 首个差异下标（-1 = 完全相同）—— 用于把"非幂等"暴露成可定位的证据，而不是悄悄重写 */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/* 去掉尾部的空行与 --- 分隔线（preamble / 条目块通用）——归一后由输出端统一补一个 ---，
 * 否则 preamble 自带的 --- 会被当成正文读回、每跑一次多一条分隔线（非幂等的根因）。 */
function stripTail(lines) {
  const out = lines.slice();
  while (out.length && (out[out.length - 1].trim() === '' || out[out.length - 1].trim() === '---')) out.pop();
  return out;
}

/* 解析：preamble（首条条目之前）+ blocks（条目块）+ tail（末条条目之后的非条目小节） */
function parse(text) {
  const lines = text.split(/\r?\n/);
  const entryAt = [], sectionAt = [];
  lines.forEach((ln, i) => {
    if (ENTRY_RE.test(ln)) entryAt.push(i);
    else if (/^## /.test(ln)) sectionAt.push(i);      // 「强制规则」「遗留与后续」等小节
  });
  const first = entryAt.length ? entryAt[0] : lines.length;
  const last = entryAt.length ? entryAt[entryAt.length - 1] : lines.length;
  const tailAt = sectionAt.find(i => i > last);
  const entriesEnd = tailAt === undefined ? lines.length : tailAt;
  const blocks = entryAt.map((from, k) => {
    const to = k + 1 < entryAt.length ? entryAt[k + 1] : entriesEnd;
    return stripTail(lines.slice(from, to)).join('\n').replace(/\s+$/, '');
  });
  return {
    preamble: stripTail(lines.slice(0, first)).join('\n').replace(/\s+$/, ''),
    blocks,
    tail: tailAt === undefined ? '' : lines.slice(tailAt).join('\n').replace(/\s+$/, ''),
  };
}

const tsOf = b => { const m = b.match(ENTRY_RE); return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`; };
const monthOf = b => tsOf(b).slice(0, 7);

function renderIndex(stats) {
  return [
    IDX_BEGIN,
    '<!-- 本表由 tools/devlog-trim.cjs 自动生成；归档是冷存，改本表不会同步文件 -->',
    '| 月份 | 归档文件 | 条数 | 时间范围 |',
    '|---|---|---|---|',
    ...stats.map(s => `| ${s.month} | [${s.file}](docs/devlog/${s.file}) | ${s.count} | ${s.from} ~ ${s.to} |`),
    IDX_END,
  ].join('\n');
}

function buildArchive(month, blocks) {
  const ts = blocks.map(tsOf);                       // blocks 已倒序（承自全局倒序）
  return toEol(`# 《动物集市》DEVLOG 冷归档 · ${month}

> 本文件是 [DEVLOG.md](../../DEVLOG.md) 的冷归档，**严格时间倒序**；热区（DEVLOG.md）只保留最近 ${KEEP} 条。
> 检索：\`rg "关键词" animal-market-cocos/docs/devlog/\`（跨全部月份归档，比通读 DEVLOG.md 更快）。
> 由 \`node tools/devlog-trim.cjs\` 自动生成：条目内容**原样搬运、零改写**，仅统一分隔线为 \`---\`；请勿手工整理顺序。
> 时间范围：${ts[ts.length - 1]} ~ ${ts[0]}（共 ${blocks.length} 条）

---

${blocks.join('\n\n---\n\n')}
`);
}

/* ---------- 读入 ---------- */
const main = parse(readIf(DEVLOG));
if (!main.blocks.length) { console.error('✗ DEVLOG.md 中未找到任何 `## [YYYY-MM-DD HH:MM]` 条目，中止。'); process.exit(1); }

const perMonth = new Map();
const stale = [];
if (fs.existsSync(ARCHIVE_DIR)) {
  for (const f of fs.readdirSync(ARCHIVE_DIR).filter(x => /^DEVLOG-\d{4}-\d{2}\.md$/.test(x))) {
    for (const b of parse(readIf(path.join(ARCHIVE_DIR, f))).blocks) {
      const m = monthOf(b);
      if (`DEVLOG-${m}.md` !== f) stale.push(`${f} 内含 ${m} 条目 → 将并入 DEVLOG-${m}.md`);
      if (!perMonth.has(m)) perMonth.set(m, []);
      perMonth.get(m).push(b);
    }
  }
}
const totalBefore = main.blocks.length + [...perMonth.values()].reduce((n, a) => n + a.length, 0);

/* ---------- 归一排序 + 切分 ---------- */
const all = main.blocks.concat([...perMonth.values()].flat());
all.sort((a, b) => tsOf(b).localeCompare(tsOf(a)));  // V8 sort 稳定 ⇒ 同时间戳保持原相对顺序
const hot = all.slice(0, KEEP);
const coldByMonth = new Map();
for (const b of all.slice(KEEP)) {
  const m = monthOf(b);
  if (!coldByMonth.has(m)) coldByMonth.set(m, []);
  coldByMonth.get(m).push(b);
}
const totalAfter = hot.length + [...coldByMonth.values()].reduce((n, a) => n + a.length, 0);
if (totalAfter !== totalBefore) {
  console.error(`✗ 条目数不守恒：前 ${totalBefore} → 后 ${totalAfter}，已中止（未写任何文件）。`);
  process.exit(1);
}

/* ---------- 索引表 ---------- */
const monthStats = [...coldByMonth.entries()]
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([month, blocks]) => {
    const ts = blocks.map(tsOf);
    return { month, file: `DEVLOG-${month}.md`, count: blocks.length, from: ts[ts.length - 1], to: ts[0] };
  });

let preamble = main.preamble;
if (preamble.includes(IDX_BEGIN) && preamble.includes(IDX_END)) {
  preamble = preamble.replace(new RegExp(`${escRe(IDX_BEGIN)}[\\s\\S]*?${escRe(IDX_END)}`), renderIndex(monthStats));
} else {
  console.warn('⚠ DEVLOG.md 头部未找到索引标记（<!-- DEVLOG-INDEX:BEGIN/END -->），跳过索引刷新。');
}
const devlogOut = toEol(
  `${preamble}\n\n---\n\n${hot.join('\n\n---\n\n')}` +
  (main.tail ? `\n\n---\n\n${main.tail}` : '') + '\n'
);

/* ---------- 报告 / 落盘 ---------- */
console.log(`DEVLOG 归档${dry ? '（--dry，不写盘）' : ''}｜热区上限 ${KEEP} 条`);
console.log(`  条目总数守恒：${totalBefore} 条`);
console.log(`  DEVLOG.md：热区 ${hot.length} 条（${tsOf(hot[hot.length - 1])} ~ ${tsOf(hot[0])}）≈ ${kb(devlogOut)}KB`);
for (const s of monthStats) {
  const text = buildArchive(s.month, coldByMonth.get(s.month));
  console.log(`  ${s.file}：归档 ${s.count} 条（${s.from} ~ ${s.to}）≈ ${kb(text)}KB`);
}
if (stale.length) stale.forEach(w => console.warn(`  ⚠ ${w}`));
if (main.tail) console.warn('  ⚠ DEVLOG.md 末尾仍有非条目小节，已原样保留在条目之后（建议把「遗留与后续」上移到头部）。');

if (!dry) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  for (const s of monthStats) {
    const p = path.join(ARCHIVE_DIR, s.file);
    const text = buildArchive(s.month, coldByMonth.get(s.month));
    if (readIf(p) !== text) { fs.writeFileSync(p, text, 'utf8'); console.log(`  ✓ 已写入 ${s.file}`); }
  }
  const cur = readIf(DEVLOG);
  if (cur !== devlogOut) {
    const i = firstDiff(cur, devlogOut);
    console.warn(`  ⚠ DEVLOG.md 与目标不一致（首个差异 @${i}）：`);
    console.warn(`      现：${JSON.stringify(cur.slice(Math.max(0, i - 60), i + 60))}`);
    console.warn(`      新：${JSON.stringify(devlogOut.slice(Math.max(0, i - 60), i + 60))}`);
    fs.writeFileSync(DEVLOG, devlogOut, 'utf8');
    console.log('  ✓ 已写入 DEVLOG.md');
  } else console.log('  ✓ DEVLOG.md 无需变更（已是目标状态）');
}