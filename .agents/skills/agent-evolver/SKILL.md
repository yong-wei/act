---
name: agent-evolver
description: Use when project-local Codex custom agents under `.codex/agents/*.toml` need to be audited, tuned, extended, or quality-tracked, especially when model choice, reasoning effort, role boundaries, or project-specific subagent constraints must be updated without guessing.
---

# agent-evolver

## Overview
本技能负责治理本仓库的项目级 Codex custom agents，而不是替代它们执行业务任务。核心原则是先看运行质量台账，再调模型、推理强度和行为边界，避免凭印象修改 `.codex/agents/*.toml`。

## When to Use
- 需要新增、删除或重命名项目级 custom agent
- 某个子代理频繁超时、越权、误分流、审查过重或审查不足
- 需要根据实际运行质量调整 `model`、`model_reasoning_effort` 或 `developer_instructions`
- 需要核对 `.codex/config.toml` 的项目级 agent 目录发现表是否仍与实际一致

不要用于：
- 一次性业务分析或课程实现任务本身
- 代替 `lesson`、`interactive-design`、`interactive-lesson` 这些业务技能

## Quick Reference
- 校验当前配置：
  `python3 .agents/skills/agent-evolver/scripts/validate_agent_configs.py --root /abs/repo`
- 记录一次运行质量：
  `python3 .agents/skills/agent-evolver/scripts/record_agent_run.py --ledger .codex/agents/quality-ledger.jsonl --agent agent-router --model gpt-5.6-luna --reasoning-effort medium --task-type triage --outcome success --quality good --notes "分流准确"`
- 生成调参建议：
  `python3 .agents/skills/agent-evolver/scripts/propose_agent_tuning.py --ledger .codex/agents/quality-ledger.jsonl`

## Core Pattern
1. 先运行 `validate_agent_configs.py`，确认 `.codex/config.toml` 与 `.codex/agents/*.toml` 一致。
2. 再查看 `quality-ledger.jsonl`，判断问题是：
   - 模型过强或过弱
   - 推理强度过重或过轻
   - 角色边界不清
   - 说明词缺少项目特定硬约束
3. 只做最小必要修改，不一次改多个代理的多个维度。
4. 修改后再校验配置，并补一条台账说明本次调整原因。

## Implementation
项目固定目录：
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/agents/quality-ledger.jsonl`

参考材料：
- `references/agent-role-catalog.md`
- `references/tuning-rules.md`

## Common Mistakes
| 误区 | 正确做法 |
|------|----------|
| 看到一次超时就直接换模型 | 先看是否是任务分派错误或推理强度过重 |
| 把 custom agents 与 skill 内 `agents/openai.yaml` 混为一谈 | 项目级 custom agents 只管 Codex 子代理，skill agent prompt 只是技能入口提示 |
| 为了“更智能”让低时延代理处理复杂 debug | `spark-coder` 必须保持窄任务边界 |
| 没看台账就改 `developer_instructions` | 先记录症状，再改约束 |

## Red Flags
- 没看 `quality-ledger.jsonl` 就直接调参
- 一次同时改模型、推理强度和行为边界
- 把项目 custom agents 的问题归因到 repo-local skill 本身
- 让 `critical-reviewer` 或 `deep-debugger` 去承担普通读扫任务

这些都意味着应先停下，回到台账与校验结果。
