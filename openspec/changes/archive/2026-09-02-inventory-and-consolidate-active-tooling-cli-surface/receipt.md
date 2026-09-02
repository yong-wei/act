# Receipt — inventory-and-consolidate-active-tooling-cli-surface

## 交付内容（PR #1867）

- `docs/architecture/tooling-cli-inventory.json`：269→265 个 package scripts 逐条分类（active 255 / compatibility 1 / unknown 5）+ retired 4 条防复活记录；9 个 namespace 绑定 owner、authority、graph scope、verification、receipt/privacy class；`sourceIdentity.scriptsCanonicalSha256` 绑定捕获时 scripts 内容；`documentedDirectEntries` 登记 11 条无 npm 包装的文档化直接调用入口。
- 删除 4 个零语义重复 alias：`db:repair-class-session-attribution`、`db:verify-authoritative-knowledge-deployment`、`db:materialize-core-semantic-review`、`db:validate-longform-textbook-reference-resource-semantics`（canonical 与等价证据见 JSON `retired` 块；仅冻结 census 基线快照引用旧名，不改写）。
- 保留 `test:math-document-grading-readyz` 为 compatibility 薄 adapter（sunset 条件已登记）。
- `src/lib/__tests__/tooling-cli-inventory.test.ts`：12 项断言（completeness、retired 防复活、compatibility 转发等价、unknown 可见性、target 存在性、canonical gates 语义、5 typecheck graph 独立、发布非激活合同、privacy、source identity 工作区+HEAD 双比对、documented direct entries 存在性与 README/AGENTS 反向覆盖）。
- `docs/architecture/tooling-cli-inventory.md`、`scripts/README.md` 更新。

## Review 修复（head `9c58009639` 上 Codex 2 findings，均已修复）

- P1（清单修订漂移不失败关闭）：新增 `sourceIdentity.scriptsCanonicalSha256`，测试对工作区与 `git show HEAD:package.json` 双比对；命令体或命令名变化而清单未更新时 fail closed（行为已用变异用例验证）。
- P2（完整性分母缺直接调用入口）：新增 `documentedDirectEntries`，并加 README/AGENTS 文档化脚本路径的反向覆盖断言。

## 验证

- `npm run verify:commit` 通过；`npm run lint`（--max-warnings=0）通过；新增 12 项测试通过。
- `openspec validate <change> --type change --strict` 通过；`validate --specs --strict` 中 `student-micro-tutoring-eligibility-projection` 为既有旧债。
- 既有失败（与本变更无关，干净基线 `734ac45d3f` stash 对照一致，与归档 receipt `2026-09-02-retire-graph-center-and-parallel-knowledge-surfaces` 记录一致）：`resource-field-completion-audit.test.ts` 2 项。
- typecheck 聚合报告 web graph `production-to-documentation` 为基线既有观察，门禁 exit 0。

## 零触碰

selector、部署、生产数据库、receipt 历史、第二套 shell/门禁/validator 均未引入。
