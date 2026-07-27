## ADDED Requirements

### Requirement: 独立任务决策目录
系统 SHALL 为每项实施任务在 `docs/grill/<task-id>/` 保存独立的决策记录。带 GitHub Issue 的任务标识 SHALL 使用 `issue-<number>-<slug>`；本地任务 SHALL 使用 `local-<YYYYMMDD>-<slug>`。任务目录 SHALL 包含 `CONTEXT.md` 和 `manifest.json`，不得要求不同任务写入共享决策文件。

#### Scenario: 建立 Issue 驱动任务
- **WHEN** 实施任务关联 GitHub Issue `995`
- **THEN** 系统使用 `docs/grill/issue-995-<slug>/` 保存该任务的上下文、ADR 和任务清单

#### Scenario: 建立无 Issue 任务
- **WHEN** 实施任务没有 GitHub Issue
- **THEN** 系统使用 `docs/grill/local-<YYYYMMDD>-<slug>/` 保存该任务的上下文、ADR 和任务清单

### Requirement: Use-Grill-Me 加载与写回任务决策
项目级 Use-Grill-Me 包装流程 SHALL 在开始 Grill-with-Docs 前读取当前任务目录和其他隔离 scope 中已有的 `CONTEXT.md`、ADR 和任务清单，并在决策确认时将术语和符合 ADR 条件的决策写回当前任务目录。该流程不得以原生 Grill-with-Docs 替代项目目录的读取与写回。

#### Scenario: 延续既有任务的决策
- **WHEN** 执行者再次处理已有任务标识
- **THEN** Use-Grill-Me 在提出新决策问题前读取该任务和其他 scope 已有的上下文、ADR 和清单

### Requirement: 任务清单关联交付依据
每个任务清单 SHALL 包含版本号、与目录一致的任务标识、任务来源、Grill 决策记录引用、唯一规划真源和非空实施范围。规划真源 SHALL 互斥地关联一个 OpenSpec change 或同目录的 `plan.md`；实施范围 SHALL 由仓库相对的文件或目录前缀组成。

#### Scenario: 关联 OpenSpec 变更
- **WHEN** 任务复杂度要求 OpenSpec 变更
- **THEN** 任务清单关联该 change，且不要求重复的本地计划文件

#### Scenario: 关联无 OpenSpec 计划
- **WHEN** 任务不创建 OpenSpec 变更
- **THEN** 任务清单关联同目录的 `plan.md`

### Requirement: 决策记录随实现 PR 交付
包含受管实施改动的 PR SHALL 提供覆盖全部受管实施范围的有效任务清单，使审阅者能够从同一 PR 追溯到 Grill 决策记录和规划真源。

#### Scenario: 审阅实现与决策依据
- **WHEN** PR 包含应用、脚本、工作流、项目技能、依赖声明、Prisma 或 Rust 数值内核的改动
- **THEN** 审阅者能够从有效任务清单定位对应的任务决策目录和规划真源

### Requirement: 实现 PR 使用集成目标与配置审查
包含任务实现的 PR SHALL 以 `integration` 为目标分支，并在创建后请求已配置的 Codex 审查。目标为 `main` 的 PR MUST 在请求审查前改为 `integration`，且不得使用范围过大的旧审查请求。

#### Scenario: 创建任务实现 PR
- **WHEN** 实施任务的决策记录、规划产物和代码已准备提交
- **THEN** PR 以 `integration` 为目标并带有已配置的 Codex 审查请求
