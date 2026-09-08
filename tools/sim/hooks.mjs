/* ESM resolve 钩子：core 层 TS 采用无扩展名相对导入（Cocos 惯例），
 * Node 原生 ESM 要求显式扩展名 → 在此为 .ts 父模块的无扩展名相对导入补 .ts */
export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExt = /\.(ts|js|mjs|cjs|json|node)$/i.test(specifier);
  const parentIsTs = typeof context.parentURL === 'string' && context.parentURL.endsWith('.ts');
  if (isRelative && !hasExt && parentIsTs) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch (e) {
      /* 回落到默认解析 */
    }
  }
  return nextResolve(specifier, context);
}
