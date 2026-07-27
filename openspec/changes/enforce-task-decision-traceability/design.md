## Context

项目已有多个 `docs/grill/` 目录，也已有未纳入项目技能索引的 Use-Grill-Me 包装技能。该包装技能能通过显式 scope 隔离文档并扫描其他 scope 的上下文和 ADR，但未关联任务计划、实现范围或 PR。现有 `verify:commit` 由 managed pre-commit hook 调用，GitHub CI 目前不在 PR 上运行；因此任何一层都无法证明决策记录随实现 PR 交付。

本变更以 `docs/grill/issue-995-decision-traceability/` 为首个受约束任务。它必须同时覆盖 Issue 驱动的 OpenSpec 变更和无 Issue、无 OpenSpec 的小任务，且不把不同任务写入共享的 ADR 或上下文文件。

## Goals / Non-Goals

**Goals:**

- 将 Use-Grill-Me 作为项目技能，保留其全局知识扫描和隔离写入规则。
- 为每个实施任务建立稳定、独立且可提交的决策目录。
- 用机器可读任务清单将决策记录、规划真源和实现范围关联起来。
- 在提交时快速发现无效清单，在 PR 中检查完整实现范围的覆盖关系。

**Non-Goals:**

- 不迁移或追溯要求现有历史 `docs/grill/` 目录补齐任务清单。
- 不禁止纯文档、OpenSpec 归档或其他不含实施范围的 PR。
- 不把决策记录集中到根级 `CONTEXT.md`、全局索引或共享 ADR 编号序列。
- 不变更 GitHub Issue 的创建、认领或 PR 合并权限。

## Decisions

### Use-Grill-Me 作为任务决策入口

将现有 Use-Grill-Me 包装技能及其无副作用 scope 解析器纳入 `.agents/skills/use-grill-me/`，并更新项目技能索引。该包装流程继续先定位可用的原生 Grill-with-Docs、读取其要求的技能，再按 `--scope` 读取全仓库已有上下文和 ADR；实施任务传入本次任务标识作为 scope。

任务目录固定为 `docs/grill/<task-id>/`。有 Issue 的标识为 `issue-<number>-<slug>`；本地任务为 `local-<YYYYMMDD>-<slug>`。目录必须含 `CONTEXT.md` 和 `manifest.json`，可按已确认的硬决策添加 `adr/*.md`。

直接调用原生 Grill-with-Docs 不会读取其他隔离 scope；建立新的平行包装技能则会重复已有 scope 解析逻辑，因此均不采用。

### 显式任务清单

`manifest.json` 采用版本化 JSON 合同：`schemaVersion`、`taskId`、`source`、`grill`、`planning` 和非空的 `implementationScope`。`source` 区分 `github-issue` 与 `local`；`planning` 互斥地关联一个 OpenSpec change 或本目录的 `plan.md`。范围项均为仓库相对的文件或目录前缀，避免引入新的 glob 解释器；每个受管实施文件必须且只能被一个任务清单的范围覆盖。

全局登记表会重新引入多人写冲突，按扩展名或代码路径推断任务则无法表达无 Issue 任务和真实边界，因此均不采用。

### 双层验证

新增一个无第三方依赖的 Node 校验器。`--staged` 使用索引中的文件和任务清单：它验证已改动的清单结构，并要求每个受管实施改动均能匹配一个有效清单。该模式接入 `verify:commit`，沿用现有 managed pre-commit hook。

`--base <ref>` 使用 merge-base 到 `HEAD` 的完整差异列表：它复用同一合同，确认一个 PR 的全部受管实施范围均有且仅有一个有效清单覆盖。新增轻量 GitHub Actions workflow，在 `pull_request` 事件中执行该模式；不改变现有发布型 CI 只在 `main` push 和手动触发的范围。

受管实施路径包括应用、脚本、工作流、项目技能、依赖声明、Prisma 和 Rust 数值内核。`docs/grill/`、`openspec/` 与其他纯文档路径本身不触发覆盖要求，但清单一旦被改动必须可解析且完整。

### 集成 PR 与审查请求

实施 PR 的目标分支固定为 `integration`。若创建时误设为 `main`，必须在请求审查前改正；创建后使用已在 Codex App 中配置的 Codex 审查请求，不得沿用范围过大的旧审查请求。该约束写入 Use-Grill-Me 的交付步骤，使任务从决策到审查都保留在同一集成语境。

### 规划真源保持单一

复杂任务在清单中关联 `openspec/changes/<change>`，其中 `tasks.md` 是唯一实施计划；无 OpenSpec 任务必须在任务目录保存 `plan.md`。不为 OpenSpec 任务再生成副本计划，避免两个计划版本分叉。

## Risks / Trade-offs

- [清单维护增加一次任务启动成本] → Use-Grill-Me 在工作流中生成清单骨架，校验错误指出缺失字段、未覆盖文件或冲突范围。
- [范围声明不精确会阻塞提交] → 仅采用可读的文件或目录前缀，并提供针对校验器的 fixture 测试。
- [PR 只运行轻量门禁可能被绕过] → 本地 `verify:commit` 提供前置反馈；PR 门禁保留全量差异校验，不依赖单个提交顺序。
- [历史目录不符合新合同] → 校验仅处理本次受管实现和被改动的清单，不对历史目录追溯失败。

## Migration Plan

1. 添加 Use-Grill-Me 项目技能、任务清单校验器、测试和 PR workflow。
2. 将校验器接入 `verify:commit`，保持现有 hook 安装脚本不变。
3. 以 #995 目录和本 OpenSpec change 填写首个清单并验证。
4. 需要回滚时移除 `verify:commit` 与 PR workflow 的调用；既有决策目录和清单保持可读，不影响运行时产品。

## Open Questions

- 无。任务目录、标识规则、规划真源和验证阶段已在 Grill 决策中确认。
