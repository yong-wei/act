## 1. Dependency and boundary baseline

- [x] 1.1 验证 C22 的 Artifact/Run contract readiness 和 C23 的 bridge deletion/replacement 证据。
- [x] 1.2 冻结 `domain.ts`、`client.ts`、`server.ts`、`index.ts` 的 exports、生产/测试/dynamic/operator callers 和当前 client/server boundary。
- [x] 1.3 对每个 legacy entrypoint 记录 owner、replacement、zero-caller 目标、rollback 用途、删除条件和保留理由。

## 2. Consumer migration and cleanup

- [x] 2.1 将生产代码从 `@/features/arena` root barrel 迁移到既有 domain/client/server 或更窄 public API。
- [x] 2.2 迁移 challenge/workbench/preview、teacher publication、route、worker 和 test callers，保持 Artifact/Run、task/publication、role 和 privacy 语义。
- [x] 2.3 删除已证明 zero-caller 的 root barrel/re-export/legacy aliases 及仅保护这些入口的测试；保留仍有正式或历史责任的显式边界。
- [x] 2.4 确认 official submission/evaluation/leaderboard 仍只走 server authority，browser/worker preview 仍 non-persistent、non-official。

## 3. Verification and handoff

- [x] 3.1 增加或更新 client-import/server-import negative tests、dynamic caller scan 和 root barrel zero-caller check。
- [x] 3.2 验证 fixed-step Rust/WASM facade、server preview persistence、hidden-input protection、official protocol/cache identity 和 historical replay 未改变。
- [x] 3.3 运行 Arena boundary/submission/preview/replay tests、受影响 domain suite、`rtk npm run typecheck`、`rtk openspec validate retire-arena-legacy-entrypoints --type change --strict` 和 `rtk git diff --check`。
