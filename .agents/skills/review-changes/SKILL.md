---
name: review-changes
description: Use when performing code review in this repository and you want a graph-assisted, risk-first review flow based on actual changed files, source snippets, bridge-node awareness, and targeted follow-up reads instead of generic LGTM-style summaries.
---

# Review Changes

## Overview

本技能用于本仓库的代码审查。主线是“先变更检测，再风险聚焦，再定点读码”，输出必须以发现的问题为主，而不是空泛总结。

重要：`code-review-graph` 的部分审查工具在 Codex 中采用 deferred loading。若当前会话最初只暴露了少量 CRG 工具，应先用 `tool_search` 补齐缺失 schema，再走完整审查流程，而不是误判为上游已删除这些能力。

## 工具加载规则

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
2. 再用 `tool_search` 搜索：
   - `code-review-graph get_affected_flows get_impact_radius query_graph semantic_search_nodes list_flows get_flow`
3. schema 加载后，再进入完整审查流程。

## When to Use

- 用户要求 review、审查、找风险、看改动是否安全
- 需要判断最近改动是否引入行为回归
- 需要优先聚焦高风险文件，而不是平均读所有 diff
- 需要给出“缺什么测试、为什么危险、可能影响哪里”的具体意见

## Workflow

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
   - 若用户已限定文件，直接传 `changed_files`
2. 调用 `mcp__code_review_graph__.detect_changes_tool`。
   - 默认 `detail_level="minimal"`
   - 先拿风险分层和优先级，不急着展开源码
3. 调用 `mcp__code_review_graph__.get_review_context_tool`。
   - 默认 `detail_level="minimal"`
   - 需要源码片段时设 `include_source=true`
4. 调用 `mcp__code_review_graph__.get_affected_flows_tool` 看影响到哪些执行流。
5. 调用 `mcp__code_review_graph__.get_impact_radius_tool` 看 blast radius。
6. 用 `mcp__code_review_graph__.query_graph_tool` 的 `tests_for`、`callers_of`、`callees_of` 补测试与关系证据。
7. 若高风险文件命中共享基础设施、公共工具层或跨域边界，再调用 `mcp__code_review_graph__.get_bridge_nodes_tool`。
8. 若审查过程中还不清楚缺哪类证据，调用 `mcp__code_review_graph__.get_suggested_questions_tool`。
9. 只对高风险项做定点补读：
   - `rtk sed -n`
   - `rtk rg -n`
   - 必要的测试、lint、build 或脚本检查

## Review Focus

优先查这几类问题：

- 行为回归或与既有契约不一致
- 只修表面、没修作者态真源或共享层
- 缺测试，尤其是共享 chokepoint 上的改动
- 导出路径、runtime 路径、媒体路径、配置边界或数据库边界被改坏
- 现有异常路径、空值路径、旧数据兼容路径被忽略

## Output Rules

- 先列 findings，按严重度排序。
- 每条 finding 都要说清：
  - `文件/位置`
  - `问题是什么`
  - `为什么重要`
  - `缺什么验证或应补什么测试`
- 如果没有发现问题，要明确写“未发现明确缺陷”，并补一句剩余风险或验证缺口。
- 结尾的变更总结只能很短，不能喧宾夺主。

## Red Flags

- 先写总体印象，再勉强找问题
- 未先 `tool_search` 就断言 flow/test 查询工具不存在
- 对所有文件平均用力，导致高风险点读得不够深
- 没有测试证据就给出强结论
