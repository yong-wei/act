/**
 * module.register() 回退路径的 server-only 解析 hook（老 Node 20），
 * 行为与 server-only-shim.mjs 的 registerHooks 分支一致。
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const emptyModuleUrl = pathToFileURL(path.join(here, 'empty-module.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only' || specifier === 'client-only') {
    return { url: emptyModuleUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
