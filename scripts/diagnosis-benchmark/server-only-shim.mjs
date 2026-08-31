/**
 * 让依赖 server-only 的服务端模块可以在 tsx CLI（非 Next.js 运行时）
 * 下加载：把 server-only / client-only 解析为空模块。仅用于诊断基准
 * 评测入口，不影响应用运行时。
 */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const emptyModuleUrl = pathToFileURL(path.join(here, 'empty-module.mjs')).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only' || specifier === 'client-only') {
      return { url: emptyModuleUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
