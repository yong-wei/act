# HANDOFF — establish-control-engine-wasm-facade

捕获 Git 修订：`653b4a7cd0cedf3e70902411404f0c297cd00901`（提案原文快照 `a3e6ce743`）。工作树 `act-dev1`。

## Facade identity

- Protocol: `control-engine-facade/v1`
- Adapters: `src/lib/control-engine/{client,analysis.worker,server,wasm-browser,wasm-server}.ts`
- Generated allowlist: `wasm-browser.ts`, `wasm-server.ts`
- Capability matrix: analysis / nonlinear analysis / simulation step / virtual simulation step / RL training / arena virtual preview

## Caller inventory

九项 raw business loader 仍作为 compatibility entry 存在，但不再直连 generated 包。完整名单见 `src/lib/control-engine/inventory.ts`。Unit 5-5 `rl-training-runtime.ts` 不是 facade/build 例外。

R6 删除条件：caller 扫描为零、回滚包可恢复、浏览器与服务端验证通过。本 change 不删除 loader。

## Fallback

`fallbackResult` 只能展示。`ControlFigureWorkspace` 不会把 fallback 交给 `onResult`。超时或错误保持 `isAuthoritative=false`。

## Rollback

回滚 facade commit 并恢复匹配 hash 的 generated package / `identity.json` / `identity.generated.ts`。不要改写已持久化 run。
