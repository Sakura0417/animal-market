#!/usr/bin/env node
/**
 * bundle-fingerprint.cjs —— 构建产物「指纹」取证工具
 *
 * 【为什么需要它】本项目已两次被同一个坑绊住：
 *   ① 2026-09-07：编辑器预览滞留旧 bundle，修复"看似无效"；
 *   ② 2026-09-21：源码 20:35 修好，但 build/wechatgame 停在 19:55，
 *      微信开发者工具读的是**构建产物**，于是用户截图里仍然是旧行为。
 *   —— 源码正确 ≠ 你看到的东西用的是新代码。改完必须回答"我跑的到底是哪份产物"。
 *
 * 【用法】
 *   node tools/bundle-fingerprint.cjs <构建目录> <关键词1> [关键词2 ...]
 *   例：node tools/bundle-fingerprint.cjs build/wechatgame getSafeAreaRect getSafeInsets
 *       node tools/bundle-fingerprint.cjs build/web-mobile BUILD_TAG
 *
 * 【读法】
 *   · 某关键词在**旧产物**命中、在新源码里已删除 → 该产物是旧的，重新构建。
 *   · 关键词只在源码有、产物没有 → 要么没编译，要么打错目录。
 *   · 顺带核对 mtime：产物 mtime < 源码 mtime ⇒ 必然旧。
 */
const fs = require('fs');
const path = require('path');

const [root, ...needles] = process.argv.slice(2);
if (!root || !needles.length) {
  console.error('用法: node tools/bundle-fingerprint.cjs <构建目录> <关键词...>');
  process.exit(2);
}

const TEXT_EXT = new Set(['.js', '.json', '.ts', '.mjs', '.cjs', '.txt', '.html']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const st = fs.statSync(p);
      files.push({ p, st, rel: path.relative(root, p) });
    }
  }
})(root);

files.sort((a, b) => b.st.mtime - a.st.mtime);
console.log('产物根目录: ' + root);
console.log('文件数: ' + files.length + '   最新 mtime: ' + files[0].st.mtime.toISOString());
console.log('\n-- 最近改动的 15 个文件 --');
for (const f of files.slice(0, 15)) {
  console.log('  ' + f.st.mtime.toISOString() + '  ' + String(f.st.size).padStart(9) + '  ' + f.rel);
}

console.log('\n-- 关键词命中（只看文本类、>40MB 跳过）--');
for (const n of needles) {
  const hits = [];
  for (const f of files) {
    if (!TEXT_EXT.has(path.extname(f.p)) || f.st.size > 40 * 1024 * 1024) continue;
    const t = fs.readFileSync(f.p, 'utf8');
    let c = 0, i = -1;
    while ((i = t.indexOf(n, i + 1)) !== -1) c++;
    if (c) hits.push(f.rel + ' x' + c);
  }
  console.log('  [' + n + '] -> ' + (hits.length ? hits.join(' | ') : '未命中'));
}

console.log('\n提示：产物里若仍能搜到「源码已删除的旧符号」，说明这份产物是旧代码，必须重新构建。');
