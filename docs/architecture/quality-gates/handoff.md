# Quality gates handoff

## 交付面

- Registry authority：`scripts/quality-gates/registry.ts`
- Generated registry projection：`docs/architecture/quality-gates/registry.json`
- Runner：`scripts/quality-gates.ts` 与 `scripts/quality-gates/runner.ts`
- Impact fallback：`scripts/quality-gates/impact.ts`
- Layer receipts：`scripts/quality-gates/receipts.ts`
- Hosted CI boundary receipt：`docs/architecture/quality-gates/integration-protection-verification.json`
- Governance ledger：`docs/architecture/quality-gates/governance-ledger.json`

本纠正把 #1554 误加的 GitHub PR/integration/nightly 通用质量 CI 删除。合入证据是本地命令与 exact-current-HEAD 审查，不是 GitHub status check。

## 已实现的控制

1. PR、integration、main/release、nightly 仍是独立 scope、owner、required check 和 receipt contract，但 layer event 全部为 `local`。
2. required check 映射到既有 test command、四张 TS graph、fitness evaluator 或 package script。
3. PR denominator 未闭合时扩大或 fail closed。
4. 四张 graph 在 PR/integration 为 mandatory；main/release 要求当前 clean、passed、zero-tsc-error receipts。
5. GitHub Actions 只保留 `ci.yml` 的 `main` push / `workflow_dispatch`，以及 Wolfram 专项 `workflow_dispatch`。
6. `quality-gates.yml`、`ci.yml` 的 `release/**` 与 `main-release-quality-gates` 已删除；再引入会 fail closed。

## 尚未解除的 blocker

- 当前 fitness 仍有冻结预算增长、未登记 feature→app 和 frozen graph receipt 缺失。
- tools/test graph 保留既有 tsc debt/OOM，按要求继续阻断 PR/integration 证据层，而不是移到 nightly 或 GitHub CI。
- `test:release` 缺 qualification manifest，仍为 fail-closed。
- 全量 integration、Next build、WASM、migration rehearsal、critical E2E 和真实 nightly breadth 不由 GitHub Actions 自动执行；未运行不得写成 passed。

## 后续责任

| owner | action | unblock condition |
| --- | --- | --- |
| platform | 保持 hosted CI 白名单 | `quality-gates.yml` 缺席，`ci.yml` 仍只服务 `main` |
| architecture/platform | 修复 fitness 输入或建立新的授权预算变更 | `fitness:architecture` 当前 revision 通过 |
| tooling/test | 修复 tools/test graph tsc 错误和资源问题 | 四张 graph receipts 均 source-bound、clean、passed、`tscErrorCount=0` |
| release | 生成当前 qualification manifest，执行 runtime/OSS/rollback/readyz/DB contracts | `main-release` layer receipt passed |
| integration/platform | 按需本地执行 full integration 与 nightly breadth | 对应 layer receipt 记录真实结果；未运行不写为 passed |
