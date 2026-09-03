/**
 * 让依赖 server-only 的服务端模块可以在 tsx CLI（非 Next.js 运行时）
 * 下加载：把 server-only / client-only 解析为空模块。仅用于诊断基准
 * 评测与公平基线实验入口，不影响应用运行时。
 *
 * 两条拦截路径必须同时安装：
 * - ESM：新 Node 用同步 registerHooks；尚无该 API 的受支持 Node 20
 *   回退 module.register + 独立 resolve hook 模块。
 * - CommonJS：tsx 在 CJS 模式下经 Module._resolveFilename 加载
 *   server-only，register/registerHooks 的 ESM 钩子链都不覆盖该路径
 *   （Node 20 实测），必须补丁 _resolveFilename 指向空 CJS 替身。
 */
import Module from 'node:module';
import * as nodeModule from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const emptyModuleUrl = pathToFileURL(path.join(here, 'empty-module.mjs')).href;
const emptyModuleCjsPath = path.join(here, 'empty-module.cjs');

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

const originalResolveFilename = Module._resolveFilename;
if (typeof originalResolveFilename === 'function') {
  Module._resolveFilename = function patchedResolveFilename(request, ...args) {
    if (request === 'server-only' || request === 'client-only') {
      return emptyModuleCjsPath;
    }
    return originalResolveFilename.call(this, request, ...args);
  };
}
