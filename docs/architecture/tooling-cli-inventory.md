# Active tooling CLI inventory

真源：`docs/architecture/tooling-cli-inventory.json`（revision-bound，文件所在 Git 修订即 source identity）。
回归：`src/lib/__tests__/tooling-cli-inventory.test.ts`（completeness、retired 防复活、compatibility 转发等价、unknown 可见性、target 存在性、门禁语义、graph 独立、privacy）。

## 分类规则

- `active`：有活调用证据（CI、docs、测试、复合命令、git hooks）或属于 owner CLI 的显式模式入口族。
- `compatibility`：与 canonical 完全等价的薄转发 adapter，仅保留有 operator compatibility 价值的入口，必须带 sunset 条件。
- `retired`：零语义重复 alias，已从 `package.json` 删除；evidence 记录等价证明与 canonical。
- `unknown`：无当前调用证据、删除需 owner 确认的入口；不得转发、不得标 active。

目录存在或命令名字本身不构成 active 证据。

## Canonical command map

每个 namespace 在 inventory JSON 中登记 owner、authority、graph scope、verification 与 receipt/privacy class；namespace 内命令逐条绑定 status 与 target 文件。核心 canonical gates：

| 操作 | canonical 命令 |
|------|----------------|
| 提交门禁 | `verify:commit`（managed pre-commit hook） |
| 推送门禁 | `verify:push`（managed pre-push hook） |
| TypeScript 门禁 | `typecheck`（production graph）+ `typecheck:test/tools/web/worker` 各自独立 |
| 迁移/回填 | `tools/migration-backfill/cli.ts`（apply/check/dry-run） |
| 内容/知识/运行时发布 | `tools/content-knowledge-runtime-release/cli.ts`（check/dry-run/apply/write/run），非激活 |
| 发布/回滚安全验证 | 既有 runtime-release validator 链（`test:runtime-release-activation-rollback` 等），inventory 不引入第二 validator |

## 本次收敛（C34）

删除 4 个零语义重复 alias（canonical 见 JSON `retired` 块）：

- `db:repair-class-session-attribution` → `db:backfill-class-attribution`
- `db:verify-authoritative-knowledge-deployment` → `db:import-authoritative-actkg-release`
- `db:materialize-core-semantic-review` → `db:resource-field-completion-audit`
- `db:validate-longform-textbook-reference-resource-semantics` → `db:complete-longform-textbook-reference-resource-semantics`

保留 1 个 compatibility adapter：`test:math-document-grading-readyz` → `test:runtime-production-readyz`（同一 python target；交付链测试与 trust-boundary-matrix 按名引用）。

`docs/architecture/modular-monolith/baseline/census-core.json` 与 `modular-monolith-charter.json` 中的旧命令名是冻结的历史基线快照，不是活调用者，不随本收敛改写。

## Rollback mapping

恢复某个 retired alias：按 JSON `retired` 条目中记录的等价调用（同一 target + 同一 CLI 模式）重新添加 `package.json` script 行即可。本收敛不触碰 selector、部署、receipt 或数据库状态。
