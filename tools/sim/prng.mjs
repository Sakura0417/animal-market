/* mulberry32：确定性 PRNG（种子对拍用，核心/基准两侧共用同一实现）。
 *  2026-09-06 19:09 改造：唯一真相源迁至 `assets/scripts/core/Seed.ts`，
 *  此处仅 re-export，保持 sim 链路（refrun/verify）调用面零改动。 */
export { mulberry32 } from '../../assets/scripts/core/Seed.ts';
