## Context

现有 Arena 模块已经提供 `domain.ts`、`client.ts`、`server.ts` 三种边界，但 root `index.ts` 仍是兼容 barrel；历史 caller 还可能从不合适的层导入 evaluator、Prisma store、client components 或 Workbench 内部实现。C22 收口 artifact/run 适配，C23 消除横向 experience bridge，为入口清理提供 replacement 基础。

本变更不假设每个显式 `domain/client/server` 文件都能删除。是否保留由当前 caller、公开 spec 和 client/server 分层共同决定；删除对象是已无必要的 legacy alias，而不是为了减少文件数破坏公共边界。

## Goals / Non-Goals

**Goals:**

- 让每个生产 caller 使用符合其层级的 Arena entrypoint 或稳定 direct public API。
- 删除 root barrel 及其他已证明无消费者的 compatibility entrypoints。
- 保持 client-safe preview 与 server-only official evaluation、hidden inputs、persistence、leaderboard 和 role isolation。
- 输出供后续架构 fitness 使用的 zero-caller、replacement、rollback 和 boundary evidence。

**Non-Goals:**

- 不重建 Artifact/Run contract、Arena evaluator、WASM facade、Rust numerical modules 或 official protocol。
- 不因文件名包含 `legacy` 就删除仍被历史数据、rollback、operator 或测试契约使用的入口。
- 不删除仍是公开能力的 `domain.ts`、`client.ts` 或 `server.ts`；若未来要替换，必须另有明确 spec 与迁移证据。
- 不改变 challenge route、submission identity、score/validity/constraint semantics、preview visibility 或 production selectors。

## Decisions

### 1. Root barrel is the first retirement target

新的和迁移后的代码直接使用 `@/features/arena/domain`、`client`、`server` 或更窄的 public module。root `index.ts` 仅在 caller inventory 仍发现外部兼容需求时短期保留；零 caller 后删除，不建立新的 umbrella barrel。

### 2. Preserve explicit client/server separation

Client components may consume display-safe domain/client exports and Artifact/Run public projections; server routes and evaluator services may consume server exports and persistence adapters. Client imports of server evaluator/store and server imports of client components remain invalid, regardless of alias cleanup.

### 3. Keep official Arena authority independent

入口迁移不改变 `/api/arena/evaluate`、submission persistence、hidden scenario/model resolution、metric extraction、hard constraints、score or leaderboard authority. Browser/worker preview stays non-persistent and non-official; server preview persistence continues through the existing server control-engine facade.

### 4. Delete only with complete caller proof

Static imports, dynamic import strings, route references, test-only callers, operator scripts and compatibility readers are classified separately. A test-only caller can be removed only when it exclusively asserts the retired entrypoint; a historical/rollback caller keeps the entrypoint retained with an owner and condition.

## Risks / Trade-offs

- [Risk] Root barrel hides a caller not found by static imports. → Scan dynamic strings and run route/import contract tests before deletion; keep an explicit rollback commit.
- [Risk] Alias migration accidentally exposes server-only evaluator data to the client. → Add negative client/server import checks and role/privacy tests; review export lists at the boundary.
- [Risk] Removing a compatibility entry breaks old challenge links or historical replay. → Separate route compatibility from module imports; retain only documented supported compatibility with a deletion condition.

## Migration Plan

1. Confirm C22 and C23 receipts and freeze current Arena entrypoint behavior.
2. Build the caller matrix for root/domain/client/server entries, classify each caller and choose its existing owner/replacement.
3. Migrate production, test, dynamic and operator callers; remove root barrel imports first.
4. Delete zero-caller aliases and redundant tests; retain explicit domain/client/server files where the current contract still requires them.
5. Run client/server boundary, preview/official, hidden-input, role/privacy, replay and submission tests, then typecheck and strict OpenSpec validation.

Rollback restores the last entrypoint-cleanup commit and its import map. It does not restore a second Arena authority or permit client preview data to feed official evaluation.

## Open Questions

无。任何入口若仍有未分类 caller 或回滚责任，保持 retained/blocked，不删除。
