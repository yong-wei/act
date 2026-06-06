---
name: explore-codebase
description: Use when you need to orient inside this repository with the code-review-graph MCP before reading files, especially for architecture discovery, hotspot identification, shared chokepoints, or deciding which code paths deserve targeted shell inspection next.
---

# Explore Codebase

## Overview

本技能用于在本仓库中做“先图后码”的代码探索。目标不是把图谱当作万能搜索器，而是先用它给出仓库规模、当前任务上下文、社区结构、共享桥接节点和下一步问题，然后再做窄范围源码阅读。

重要：`code-review-graph` 在 Codex 里有 deferred tools。若当前会话刚开始只暴露少量 CRG 工具，应先用 `tool_search` 把缺失工具名加载进来，再执行完整探索流程。

## 工具加载规则

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
2. 再用 `tool_search` 搜索：
   - `code-review-graph get_architecture_overview list_communities get_community semantic_search_nodes query_graph list_flows get_flow find_large_functions traverse_graph`
3. 工具 schema 加载后，再进入完整探索工作流。

## When to Use

- 刚接手一个仓库子域，不知道从哪里开始读
- 需要理解本次任务应优先查看哪些模块，而不是先全局扫文件
- 需要识别共享基础设施、桥接节点、潜在热点或当前改动相关区域
- 需要在读源码前先拿到一个成本更低的结构化入口

## Workflow

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
   - `task` 写成本次真实任务，而不是泛泛的 `explore repo`
2. 若你对仓库规模和图谱状态还没有概念，调用 `mcp__code_review_graph__.list_graph_stats_tool`。
   - 它回答“图谱覆盖了多大范围、是否值得继续依赖图谱做第一跳”
3. 调用 `mcp__code_review_graph__.get_architecture_overview_tool` 看高层结构。
4. 调用 `mcp__code_review_graph__.list_communities_tool`，必要时再用 `get_community_tool` 看具体社区。
5. 若任务可能触及共享基础设施、公共模块或跨域逻辑，调用 `mcp__code_review_graph__.get_bridge_nodes_tool`。
   - 这一步适合找 chokepoint、枢纽函数和高连接区域
6. 用 `mcp__code_review_graph__.semantic_search_nodes_tool`、`query_graph_tool`、`traverse_graph_tool` 找目标实体和关系。
7. 用 `mcp__code_review_graph__.list_flows_tool` / `get_flow_tool` 看关键执行流。
8. 必要时用 `mcp__code_review_graph__.find_large_functions_tool` 找复杂节点。
9. 若还不知道下一步该看哪里，调用 `mcp__code_review_graph__.get_suggested_questions_tool`。
   - 它给的是“进一步验证什么”的问题，不是最终结论
10. 若当前任务与已有改动直接相关，再调用：
   - `mcp__code_review_graph__.detect_changes_tool`
   - 或 `mcp__code_review_graph__.get_review_context_tool`
11. 只有图谱完成第一轮收敛后，才使用 shell 做定向阅读：
   - `rtk rg --files <path>`
   - `rtk rg -n "<pattern>" <path>`
   - `rtk sed -n 'start,endp' <file>`

## Reading Strategy

- 先问“本次任务需要哪个局部上下文”，再读文件。
- 若图谱提示风险高、桥接节点集中，优先读共享模块和入口层。
- 若图谱提示改动集中在少量文件，优先用 `get_review_context_tool` 和定点 `sed`，不要扩散成整仓漫游。
- 若某个 CRG 工具当前未暴露，先 `tool_search` 再判断，不要把 deferred loading 误认为功能缺失。
- 若图谱仍无法回答某个精确符号问题，再转 `rtk rg`。

## Red Flags

- 跳过 `get_minimal_context_tool` 直接全局 `rg`
- 明明缺的是 schema 加载，却误判成上游没有社区、语义搜索或 flow 工具
- 为了“理解全貌”而先读一长串无关文件
- 图谱已经指出高风险区域，却仍按目录字母顺序浏览
