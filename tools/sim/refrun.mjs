/* 基准对拍加载器：以指定种子执行冻结的原型基准 _sim-trace.js，捕获其输出行。
 * 原理：_sim-trace.js 只依赖 Math.random / console.log / process.argv，
 * 在 require 前打补丁即可获得"同种子、同随机流"的基准运行。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SIM_PATH = fileURLToPath(new URL('../../../_sim-trace.js', import.meta.url));

export function runReference(level, games, seed, mulberry32) {
  const resolved = require.resolve(SIM_PATH);
  delete require.cache[resolved]; /* 允许多次（每关）重新执行 */
  const origRandom = Math.random;
  const origLog = console.log;
  const origArgv = process.argv;
  const lines = [];
  try {
    Math.random = mulberry32(seed);
    console.log = function () { lines.push(Array.prototype.join.call(arguments, ' ')); };
    process.argv = ['node', SIM_PATH, String(level), String(games)];
    require(resolved);
  } finally {
    Math.random = origRandom;
    console.log = origLog;
    process.argv = origArgv;
  }
  return lines;
}
