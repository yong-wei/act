---
name: debug-issue
description: Use when diagnosing a bug, regression, failing test, startup failure, runtime exception, or suspicious behavior in this repository and you want to begin with the code-review-graph MCP before falling back to targeted shell inspection, logs, and tests.
---

# Debug Issue

## Overview

本技能用于本仓库的问题排查。核心要求不是“先猜测根因”，而是先用 `code-review-graph` MCP 工具做最小上下文、变更风险、调用关系和共享 chokepoint 识别，再进入日志、测试和定点读码。

重要：本环境中的 `code-review-graph` 工具存在**延迟暴露**。如果当前会话一开始只看到少量 CRG 工具，不要据此认定其他工具不存在；应先用 `tool_search` 搜索缺失的工具名，把 deferred schema 加载进当前会话。

## 工具加载规则

1. 先使用 `mcp__code_review_graph__.get_minimal_context_tool`。
2. 若当前会话尚未暴露所需工具，立即使用 `tool_search` 搜索：
   - `code-review-graph semantic_search_nodes query_graph get_flow get_impact_radius get_affected_flows`
3. 工具 schema 加载后，再调用对应 `mcp__code_review_graph__.*_tool`。

图谱工具负责缩小排查范围，不负责替代日志、测试和源码证据。

## When to Use

- 某个页面、接口、脚本、测试或启动流程突然失效
- 需要判断问题是否由最近变更引入
- 需要先识别共享基础设施、桥接节点或高风险变更，再决定读哪些文件
- 需要在大仓库里避免一上来全局 `rg`

## Workflow

1. 先调用 `mcp__code_review_graph__.get_minimal_context_tool`。
   - `task` 直接写明问题，例如 `debug login 500 after startup`、`debug lesson export regression`
   - 若已知可疑文件，可传 `changed_files`
2. 用 `tool_search` 补齐以下调试常用工具：
   - `semantic_search_nodes_tool`
   - `query_graph_tool`
   - `get_flow_tool`
   - `get_impact_radius_tool`
3. 若怀疑是近期回归，立刻调用 `mcp__code_review_graph__.detect_changes_tool`。
   - 默认 `detail_level="minimal"`
   - 只在确实需要源码片段时再升到 `get_review_context_tool`
4. 用 `mcp__code_review_graph__.semantic_search_nodes_tool` 找相关实体。
5. 用 `mcp__code_review_graph__.query_graph_tool` 追调用者、被调者、导入关系或测试关系。
6. 必要时用 `mcp__code_review_graph__.get_flow_tool` 看完整执行流。
7. 若问题看起来跨多个模块或像共享基础设施故障，调用 `mcp__code_review_graph__.get_bridge_nodes_tool`。
   - 目的是识别公共 chokepoint，而不是生成架构报告
8. 若仍不清楚下一跳，调用 `mcp__code_review_graph__.get_suggested_questions_tool`。
   - 把它当作“还缺哪类证据”的提示器
9. 用 `mcp__code_review_graph__.get_impact_radius_tool` 评估怀疑文件的 blast radius。
10. 图谱缩小范围后，再进入 shell 证据链：
   - `rtk rg` 定位符号、报错文案、配置项
   - `rtk git diff` / `rtk git blame` 看最近引入点
   - `rtk npm run test -- <scope>`、`rtk pytest`、`rtk node ...` 等定向复现
   - 读取 `.logs/`、服务日志、测试输出
11. 根因定位后，再决定是否修改代码；若已经有改动，再跑一次 `detect_changes_tool`、`get_review_context_tool` 或 `get_affected_flows_tool` 看影响面是否符合预期。

## Working Rules

- 永远先从 `get_minimal_context_tool` 开始，不要先大面积扫文件。
- 对图工具优先使用最小输出；只有最小输出无法支撑判断时，才打开更多源码片段。
- 若当前会话缺少某个 CRG 工具，先 `tool_search`，不要误判成上游能力缺失。
- 图谱找不到精确调用链时，再用 `rtk rg`、测试和日志补齐，不要伪造“全链路已确认”。
- 若问题是启动、部署、数据库或远端故障，图谱只负责缩小代码范围；运行态证据仍以日志、端口、容器状态和脚本输出为准。

## Expected Output

排查结论至少要落到以下四项：

- 现象：可复述的失败表现
- 根因：哪一处代码、配置或运行条件造成问题
- 证据：图工具结果、日志、测试或源码片段如何相互印证
- 影响面：是否只影响当前问题，还是会连带其他入口/模块

## Red Flags

图形与缓存适配的复现应包含真实运行协议：当前 ForceGraph `onZoom` 的 `x/y` 已是世界坐标中的视图中心，不能再次按原始 D3 平移换算；DOM 标签存在也不能证明 WebGL mesh 存在。相机测试应覆盖切换维度和改变视口后的恢复，必要时比较真实投影。浏览器标签验收还需检查与筛选栏等浮层的矩形交集；仅检查画布边界会漏掉控件遮挡，常驻控件应从画布可用尺寸中排除。版本缓存的失败关闭检查必须覆盖构建、内存命中、磁盘命中的共同返回边界。

- 一开始就递归扫描大量目录
- 在未尝试 `tool_search` 的情况下，就断言某个 graph API 不可用
- 只看图谱摘要，不跑复现、不读日志
- 根因还没锁定就直接改代码
