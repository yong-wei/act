# Quality gates handoff

## 交付面

- Registry authority：`scripts/quality-gates/registry.ts`
- Generated registry projection：`docs/architecture/quality-gates/registry.json`
- Runner：`scripts/quality-gates.ts` 与 `scripts/quality-gates/runner.ts`
- Impact fallback：`scripts/quality-gates/impact.ts`
- Layer receipts：`scripts/quality-gates/receipts.ts`
- Integration protection receipt：`docs/architecture/quality-gates/integration-protection-verification.json`
- Governance ledger：`docs/architecture/quality-gates/governance-ledger.json`

源 revision 为 `8f66b75e01ba1fa0365e5997895cc8e647914e16`；本工作区在实现期间为 dirty，因此本次保护 receipt 明确记录 `dirty=true`，不能作为 clean release evidence。

## 已实现的控制

1. PR、integration、main/release、nightly 具有独立 event、scope、owner、required check 和 receipt contract。
2. required check 映射到既有 test command、四张 TS graph、fitness evaluator 或 package script；workflow 不再维护第二份测试列表。
3. PR denominator 未闭合时扩大或 fail closed；shared/unknown 边界不会因空路径匹配而跳过 mandatory checks。
4. 所有四张 graph 在 PR/integration 为 mandatory，main/release 要求当前 clean、passed、zero-tsc-error receipts。
5. main/release 的 release、runtime、knowledge、OSS、rollback、readyz 和 DB compatibility gate 保持 blocking；nightly 不补漏。
6. Node 20 runner 使用 `node --import tsx`，没有 `node --import tsx/esm`。

## 尚未解除的 blocker

- integration GitHub protection 没有在本 patch-worker 范围读取；receipt 为 `blocked-unverified`，不得声称 branch 已保护。
- 当前 fitness 仍有冻结预算增长、未登记 feature→app 和 frozen graph receipt 缺失。
- tools/test graph 保留既有 tsc debt/OOM，按要求继续阻断 PR/integration，而不是移到 nightly。
- `test:release` 缺 qualification manifest，仍为 fail-closed。
- 全量 integration、Next build、WASM、migration rehearsal、critical E2E 和真实 nightly breadth 未在本 patch-worker 验收中运行；需要在稳定 integration revision 上由 CI 执行。

## 后续责任

| owner | action | unblock condition |
| --- | --- | --- |
| platform/release | 读取并导出 integration ruleset / branch protection | receipt 为 `verified`，且 required check 集合与 registry 一致 |
| architecture/platform | 修复 fitness 输入或建立新的授权预算变更 | `fitness:architecture` 当前 revision 通过 |
| tooling/test | 修复 tools/test graph tsc 错误和资源问题 | 四张 graph receipts 均 source-bound、clean、passed、`tscErrorCount=0` |
| release | 生成当前 qualification manifest，执行 runtime/OSS/rollback/readyz/DB contracts | `main-release` layer receipt passed |
| integration/platform | 执行 full integration 与 nightly breadth | 对应 layer receipt 记录真实结果；未运行不写为 passed |
