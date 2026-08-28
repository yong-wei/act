# 第一刀删除收据

候选：`src/resources/control-system/analysis/control-engine-server-runtime.ts`

捕获修订：`d4531207086d006f60d4ff8ea21e75410fea78c1`

生产 caller：无。`/api/simulation/runs` 已使用 `@/lib/control-engine/server` 的 `computeControlAnalysisServer`。

删除后：

- 生成 WASM import 仍只在 `wasm-browser.ts` / `wasm-server.ts`
- 路由行为不变
- WASM 不可用时 façade 失败关闭，不恢复 TS 降级
- 回滚：`git revert` 本删除，父提交为上述捕获修订

同一 change 随后删除其余 thin server/client wrapper（simulation / Odyssey）及 R5 步进实现。
