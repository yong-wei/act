## 1. Freeze and characterize the control plane

- [x] 1.1 Consume C34 inventory and map census, charter/deprecation, dependency/fitness, quality/toolchain, QA and release trust validators, callers, inputs, outputs and authority.（map 见 simplification-ledger.md）
- [x] 1.2 Run the code-simplification process and record before/after validator branches, wrappers, aliases, receipts, failure codes and deletion reasons.（删除 3 个零消费者文件：可重建 denominator.json、已完成系列 migration-map.md、过期 preexisting-tools-typecheck.md；before/after boundary check exit 与输出一致）
- [x] 1.3 Verify replay fixtures cover clean, dirty/mixed, tree drift, stale/duplicate receipts, denominator/privacy conflict and qualified/blocked/unresolved states.（本轮补齐 mixed-worktree 与 stale-receipt 两个 fixture 后：independent-toolchain-execution-boundary 14 项（dirty、mixed、duplicate owner、privacy，及经真实消费路径 checkMigrationBackfillCompetition 的三类 stale receipt 语义：跨历史 → inventory-revision-not-ancestor、篡改树绑定 → inventory-source-tree-mismatch、同历史 HEAD 推进且命令集演化 → inventory-command-set-drift；同历史+指纹未变的祖先 receipt 按设计接受并显式断言无 inventory-* 失败）+ tooling-cli-inventory 14 项（dirty-guard、workspace/HEAD 双比对 drift））

## 2. Simplify without weakening trust

- [x] 2.1 Audit for equivalent duplicate validation inside the existing authority owners; none found to consolidate without weakening（入口脚本已是薄委托，强行合并为 facade 化，见 ledger）。
- [x] 2.2 Verify C34 canonical commands and consumers are canonical（quality-gates registry 33 commands/40 checks 与 package.json 零失配；无残留 alias 消费者）。
- [x] 2.3 Release/rollback unique security validator remains the sole selector/deployment safety authority（test:runtime-release-activation-rollback / test:runtime-production-cutover-contract 保持 active 与唯一；C34 inventory release contract 断言持有）。
- [x] 2.4 Preserve `verify:commit`, `verify:push`, `typecheck`, graph boundaries, portable receipts, PlatformSetting, AppShell/role/SSR/R3F and business owner contracts.（diff 仅删除 3 个零消费者文件，零触碰）

## 3. Verify and hand off

- [x] 3.1 No-second-gate/no-selector-write/no-private-output coverage held by existing static contracts（tooling-cli-inventory 门禁唯一性/release 非激活/privacy 断言 + boundary privacy fail-close；本 diff 未弱化）。
- [x] 3.2 Run boundary check (before/after identical), typecheck (0 errors), lint, `verify:commit`, diff checks and strict OpenSpec validation.（architecture/fitness/closure suites 以其既有测试文件为证据未受本 diff 触碰）
- [x] 3.3 Control-plane map, deleted paths and rollback recorded in simplification-ledger.md（无 retained alias）。
- [x] 3.4 Run `openspec validate simplify-architecture-control-plane-and-active-trust-validators --type change --strict` before completion.（归档前在本分支运行两次通过：tasks 勾选前与 ledger 写入后各一次）
