# Agent Role Catalog

## Luna：机械读扫、实现与测试

- Luna `high`：`explorer-librarian`、`code-mapper`，用于机械、低风险、可直接验证的读扫和映射。
- Luna `xhigh`：`spark-coder`、`test-engineer`，用于局部实现、复现和回归测试。
- Luna `max`：`patch-worker`，用于边界明确但跨文件、状态非平凡或返工代价较高的实现。

## Terra：长上下文、复合规划和领域审查

- Terra `xhigh`：`agent-router`、`spec-planner`、`ui-flow-reviewer`、`retro-analyst`、`course-pedagogy-reviewer`、`performance-reviewer`、`ai-context-reviewer`、`data-governance-reviewer`、`simulation-domain-reviewer`。
- Terra `max`：`deep-debugger`、`long-context-investigator`；前者负责复杂证据和根因定位，后者仅用于上下文规模与任务歧义同时显著的调查。

## Sol：困难风险判断与独立终审

- Sol `medium`：`decision-advisor`、`security-reviewer`、`release-sentinel`、`independent-reviewer`。
- Sol `high`：`critical-reviewer`，只用于仍未解决的安全、隐私、数据丢失、发布或架构关键风险。

所有角色均不使用 `ultra`。

## 权限

- 正式写代理：`spark-coder`、`patch-worker`、`test-engineer`。
- 诊断写权限：`deep-debugger`，不得完成正式修复。
- 其余角色只读。
