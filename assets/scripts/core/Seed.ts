/* 确定性 PRNG（mulberry32）。唯一真相源：
 *  - core/GameSession.ts 在 seed 调度时调用
 *  - tools/sim/prng.mjs 通过 re-export 复用此实现，保持 sim 链路不变
 * 同一 seed 下完全可复现；算法与上游 `tools/sim/prng.mjs`（2026-09-06 之前的版本）一致。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
