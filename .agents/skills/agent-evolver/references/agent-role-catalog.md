# Agent Role Catalog

## Sol Low：窄执行与窄读扫

- `spark-coder`：简单、局部、可快速验证的写任务。
- `explorer-librarian`、`code-mapper`、`test-engineer`：窄读扫、路径定位和聚焦测试。

## Sol Medium：复合任务、主协调和常规审核

- `agent-router`：复杂任务角色选择和主协调建议。
- `patch-worker`、`deep-debugger`、`long-context-investigator`：复合实现、复杂排障和长上下文调查。
- `ui-flow-reviewer`、`retro-analyst`：常规 UI 审核与失败复盘。
- `spec-planner`、`independent-reviewer` 及常规领域 reviewer：规划、常规审核和一般任务终审。

## Sol High：高风险任务与终审

- `security-reviewer`、`release-sentinel`：安全敏感和发布关键审查。
- `critical-reviewer`：只用于高风险、架构回归、安全敏感或发布关键终审。
- 一般任务终审仍使用 `independent-reviewer` 的 Sol `medium`。

所有角色只使用 `gpt-5.6-sol`，不使用 `xhigh`、`max` 或 `ultra`。

## 权限

- 正式写代理：`spark-coder`、`patch-worker`、`test-engineer`。
- 诊断写权限：`deep-debugger`，不得完成正式修复。
- 其余角色只读。
