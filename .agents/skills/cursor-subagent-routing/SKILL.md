---
name: cursor-subagent-routing
description: Route Cursor Task subagents to non-Composer models by task type. Use when dispatching Cursor subagents, choosing Task model slugs, or when AGENTS.md Codex TOML routing does not apply in Cursor.
---

# Cursor 子代理路由

## 何时使用

- 当前运行时是 Cursor（含 Auto），需要派发 `Task` 子代理。
- 需要避免全部子代理 `inherit` / Composer 同构。
- Codex `.codex/agents/*.toml` 的模型与 effort 与 Cursor 不一致时。

## 硬约束

1. 只使用当前 Cursor `Task` 允许的 model slug；列表变更时先更新本表再派发。
2. Cursor **没有**独立 `reasoning` / `effort` 参数；强度编码在 slug 中。
3. 新开子代理默认禁止 `inherit`；仅 `resume` 续跑可 `inherit`。
4. 用户显式点名模型时优先生效（仍须在允许列表内）。
5. 写任务串行；探索与审查可并行。
6. 不要修改或复用 `.codex/agents` TOML 作为 Cursor 模型真源。

## 当前允许 slug（会话基线）

- `inherit`
- `composer-2.5-fast`
- `cursor-grok-4.6-high-fast`（默认不用 `cursor-grok-4.5-high-fast`）
- `gpt-5.6-sol-medium`
- `claude-fable-5-thinking-high`
- `claude-opus-5-thinking-high`

## 路由表

| 任务类型 | `subagent_type` | 模型 |
| --- | --- | --- |
| 代码库定位 / 结构探索 | `explore` | `composer-2.5-fast` |
| 广域材料汇总 / 多点并行探查 | `explore` 或 `generalPurpose` | `cursor-grok-4.6-high-fast` |
| 小范围实现 / 局部修补 | `generalPurpose` | `composer-2.5-fast` |
| 多文件功能实现 / 状态较复杂 | `generalPurpose` | `gpt-5.6-sol-medium` |
| 复杂排障 / 根因分析 | `generalPurpose` | `gpt-5.6-sol-medium` |
| 架构/方案对比（只读） | `code-architect` | `gpt-5.6-sol-medium` |
| 深度已有功能摸底 | `code-explorer` | `gpt-5.6-sol-medium` |
| 普通 diff 审查 | `code-reviewer` | `gpt-5.6-sol-medium` |
| Bugbot 式审查 | `bugbot` | `gpt-5.6-sol-medium` |
| 安全审查 | `security-reviewer` | `gpt-5.6-sol-medium` |
| CI 失败调查 | `ci-investigator` | `gpt-5.6-sol-medium` |
| Cursor 产品用法 | `cursor-guide` | `composer-2.5-fast` |
| 隔离实验 / best-of-n | `best-of-n-runner` | 默认 `composer-2.5-fast`；质量对比用 `gpt-5.6-sol-medium` |
| 极短续跑、无独立决策 | 任意 `resume` | `inherit` |

### 审查模型选择

- 默认使用 `gpt-5.6-sol-medium`。不要主动调用 Claude 系列（`claude-fable-*`、`claude-opus-*`）。
- 用户显式点名 Claude 且 slug 仍在允许列表内时，才使用该模型。
- 实现默认 `cursor-grok-4.6-high-fast` 或 `composer-2.5-fast`；多文件复杂实现用 `gpt-5.6-sol-medium`。

## 派发检查清单

1. 任务是否匹配上表某一行？写出选定的 `subagent_type` 与 `model`。
2. 是否误用了 Codex 模型名或独立 effort？若是，改回本表 slug。
3. 是否新开却传了 `inherit`？若是且非 resume，改为表内显式模型。
4. 写代理是否已有另一个在跑？若是，等待或改串行计划。
5. 派发后在回报中写明实际使用的 model slug。

## 与 Codex 的边界

- Codex 会话：继续遵循 `AGENTS.md` + `.codex/agents/*`。
- Cursor 会话：模型路由以本 skill + `.cursor/rules/subagent-routing.mdc` 为准；职责分工可类比，但 slug 不共享。
