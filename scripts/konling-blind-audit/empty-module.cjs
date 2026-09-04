// server-only/client-only 在 CLI 环境下的空替身（见 server-only-shim.mjs）。
// CommonJS 版本：Node 20 的 require() 无法加载 .mjs，CJS 拦截路径指向本文件。
module.exports = {};
