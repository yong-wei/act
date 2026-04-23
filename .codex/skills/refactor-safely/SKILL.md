---
name: refactor-safely
description: Use when planning or executing refactors in this repository and you need graph-assisted impact estimation before editing, then graph-assisted validation after editing, with targeted shell search and tests filling the gaps that the current code-review-graph toolset does not cover.
---

# Refactor Safely

## Overview

本技能用于本仓库中的安全重构。这里的“安全”不是指完全自动化，而是指先用图谱判断共享 chokepoint、近期改动和潜在高风险区域，再用定向搜索、最小改动和回归验证完成重构。

重要：当前会话若一开始看不到 `refactor_tool`、`apply_refactor_tool`、`get_affected_flows`、`get_impact_radius` 等接口，先不要下结论。`code-review-graph` 在 Codex 中采用 deferred loading，需要先用 `tool_search` 加载缺失 schema。

## 工具加载规则

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
2. 再用 `tool_search` 搜索：
   - `code-review-graph refactor_tool apply_refactor_tool get_impact_radius get_affected_flows find_large_functions query_graph semantic_search_nodes`
3. schema 加载后，再进入完整重构流程。

## When to Use

- 需要做重命名、拆分、抽取公共逻辑或移动职责边界
- 需要判断某个共享模块是否适合改动
- 需要在动手前先估计哪些区域最脆弱
- 需要在改动后确认重构没有意外扩大影响面

## Workflow

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
   - `task` 写成具体重构目标，例如 `refactor lesson registry loading`、`split teacher insights service`
2. 若这次重构可能命中共享基础设施，调用 `mcp__code_review_graph__.get_bridge_nodes_tool`。
   - 目的是识别“看似局部、实际是枢纽”的位置
3. 调用 `mcp__code_review_graph__.get_impact_radius_tool` 估计 blast radius。
4. 用 `mcp__code_review_graph__.semantic_search_nodes_tool`、`query_graph_tool`、`find_large_functions_tool` 锁定目标。
5. 若是符号重命名、死代码清理或图谱建议型重构，优先使用 `mcp__code_review_graph__.refactor_tool`。
6. 仅在确认预览结果正确后，才用 `mcp__code_review_graph__.apply_refactor_tool` 落盘。
7. 若重构范围比较大，再调用 `mcp__code_review_graph__.list_graph_stats_tool` 或 `get_suggested_questions_tool`，判断是否需要进一步切小事务。
8. 图谱完成第一轮收敛后，再用 shell 做精确定位：
   - `rtk rg -n "<symbol|path|config-key>"`
   - `rtk rg --files <subtree>`
   - `rtk git grep "<symbol>"`
9. 先做最小必要改动。
   - 一次只做一个概念层面的重构
   - 不把“命名整理”和“行为变更”混在同一笔改动里
10. 改动后必须回到图谱做验证：
   - `mcp__code_review_graph__.detect_changes_tool`
   - `mcp__code_review_graph__.get_review_context_tool`
11. 再调用 `mcp__code_review_graph__.get_affected_flows_tool` 检查关键执行流。
12. 再跑定向验证：
   - `rtk git diff --check`
   - 相关单测、集成测试、lint、build 或脚本校验

## Safety Rules

- 如果桥接节点显示某模块是 chokepoint，就先缩小改动面，再考虑是否值得动它。
- 如果当前工作树已有用户改动，重构必须与现有改动共存，不能回滚他人修改。
- `refactor_tool` 的结果是高价值预览，不是绝对真理；删代码前还要看运行入口、配置装配和测试覆盖。
- 即使使用 `apply_refactor_tool`，仍要跑测试和 review graph 校验。

## Red Flags

- 未先 `tool_search` 就断言自动重构 API 不存在
- 未评估共享 chokepoint 就直接改公共模块
- 把重构和功能修改混成一次提交
- 改完不跑 `detect_changes_tool`、`get_review_context_tool` 和定向测试
