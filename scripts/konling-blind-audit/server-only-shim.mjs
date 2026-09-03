/**
 * 让依赖 server-only 的服务端模块可以在 tsx CLI（非 Next.js 运行时）
 * 下加载：把 server-only / client-only 解析为空模块。仅用于诊断基准
 * 评测与公平基线实验入口，不影响应用运行时。
 *
 * 新 Node 用同步 registerHooks；尚无 registerHooks 的受支持 Node 20
 * 回退到 module.register + 独立 resolve hook 模块（同一解析行为）。
 */
import * as nodeModule from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const emptyModuleUrl = pathToFileURL(path.join(here, 'empty-module.mjs')).href;

if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only' || specifier === 'client-only') {
        return { url: emptyModuleUrl, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
} else {
  nodeModule.register(new URL('./server-only-resolve-hook.mjs', import.meta.url));
}
