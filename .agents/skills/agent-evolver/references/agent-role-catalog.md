# Agent Role Catalog

## Luna / medium

- 角色：`agent-router`、`explorer-librarian`、`code-mapper`、`ui-flow-reviewer`、`retro-analyst`
- 模型：`gpt-5.6-luna`
- 默认推理：`medium`
- 主要职责：路由、读扫、路径映射、UI 轻审和失败复盘
- 不做：复杂实现、关键领域判断或最终裁决

## Luna / low

- 角色：`spark-coder`
- 模型：`gpt-5.6-luna`
- 默认推理：`low`
- 主要职责：边界明确、可快速验证和易回滚的极小改动
- 不做：复杂排障、跨文件重构或关键审查

## Terra / high

- 角色：`patch-worker`、`test-engineer`、`deep-debugger`、`performance-reviewer`
- 模型：`gpt-5.6-terra`
- 默认推理：`high`
- 主要职责：工程实现、测试、复杂排障、性能和可靠性审查
- 不做：高风险领域最终判断或发布终审

## Sol / high

- 角色：`spec-planner`、`course-pedagogy-reviewer`、`simulation-domain-reviewer`、`data-governance-reviewer`、`ai-context-reviewer`、`security-reviewer`、`release-sentinel`
- 模型：`gpt-5.6-sol`
- 默认推理：`high`
- 主要职责：规划、课程与控制领域审查、数据与 AI 治理、安全和发布门禁
- 不做：普通读扫、简单补丁或低风险样板工作

## Sol / xhigh

- 角色：`critical-reviewer`
- 模型：`gpt-5.6-sol`
- 默认推理：`xhigh`
- 主要职责：关键正确性审查、架构回归和高风险终审
- 不做：普通探索、业务实现或常规测试执行

`max` 与 `ultra` 不配置给常设角色。主线程只在一次性自由派发中按明确风险依据使用。
