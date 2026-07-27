---
name: use-grill-me
description: 在团队或多工作树仓库中运行 Grill-with-Docs，并以显式任务作用域隔离和汇集决策记录。用户要求 use-grill-me，或要求在协作仓库中使用 grill-with-docs 时使用。
---

# Use Grill Me

包装已安装的 `grill-with-docs` 技能。保留其 grilling 与 domain-modeling 行为，仅替换文档发现和写入位置，并在实施前建立可提交的任务清单。

## 上游技能

开始访谈前，定位并完整读取可用的原生 `grill-with-docs/SKILL.md`，再遵循它及其调用技能的全部规则，包括一次只提一个问题和 domain-modeling 规则。找不到或无法读取原生技能时，停止并说明原因；不得自行近似其访谈行为。

## 解析隔离作用域

对实施任务，先从 GitHub Issue 或本地任务派生 `task-id`：Issue 使用 `issue-<number>-<slug>`，本地任务使用 `local-<YYYYMMDD>-<slug>`。调用：

```bash
python3 .agents/skills/use-grill-me/scripts/resolve_scope.py --repo-root <repo-root> --scope <task-id> --json
```

解析器依次使用命令行 `--scope`、`GRILL_SCOPE_ID`、`git config grill.scopeId` 与当前日期会话作用域。不得从 Git 分支、Git 用户名或工作树目录推断默认作用域。

只按返回路径读取或写入；仅在已经形成术语或 ADR 时创建目录。

## 每次访谈前读取共享决策

读取返回的 `globalContextFiles`、`globalAdrFiles` 和 `globalManifestFiles`。它们覆盖根上下文、领域上下文、全局 ADR 以及所有隔离任务目录中的上下文、ADR 和清单。

将这些文件视为已合并的共享知识。如果它们互相矛盾，指出准确冲突，并提出解决冲突所需的下一个单一问题；不得自行选择语义、覆盖其他任务目录或维护全局索引。

## 写入当前任务目录

访谈中只能写入当前作用域：

- glossary：`docs/grill/<task-id>/CONTEXT.md`
- ADR：`docs/grill/<task-id>/adr/YYYYMMDD-<slug>.md`；同日冲突时使用时间戳

沿用原生 domain-modeling 的格式和 ADR 条件。术语确认时立即更新 scoped `CONTEXT.md`；只有同时满足难以回滚、缺少背景会令人意外、且经过真实取舍时才创建 ADR。

不得修改根 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/contexts/**/CONTEXT.md`、`docs/adr/**` 或其他任务目录。

## 从决策到实施

完成 Grill 后，依据复杂度确定规划真源：复杂任务创建 OpenSpec change；简单任务在当前目录创建 `plan.md`。随后在 `docs/grill/<task-id>/manifest.json` 写入版本、任务来源、决策记录、唯一规划真源和实施范围。

有 OpenSpec 时，清单只关联 change，不再复制计划；无 OpenSpec 时，清单必须关联当前目录的 `plan.md`。开始实施前运行任务决策交付校验；实现、清单和决策记录必须进入同一 PR。

创建 PR 时，目标分支必须为 `integration`；若误设为 `main`，必须在请求审查前改正。创建后请求已配置的 Codex 审查，不得沿用范围过大的旧审查请求。
