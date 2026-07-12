# Agent Role Catalog

## Luna 执行与常规分析

- `agent-router`：Luna `high`，复杂任务角色选择。
- `spark-coder`：Luna `high`，简单、局部、可快速验证的写任务。
- `explorer-librarian`、`code-mapper`、`test-engineer`、`deep-debugger`：Luna `xhigh`，读扫、路径、测试和范围明确的复杂诊断。
- `patch-worker`：Luna `max`，常规实现、有边界的多文件改动和普通重构。
- `ui-flow-reviewer`、`retro-analyst`：Luna `high`，UI 流程审查与失败复盘。

## Terra 长上下文补位

- `long-context-investigator`：Terra `high`，仅用于 Luna 无法高效承载的仓库级探索、大文件联合审阅和长历史证据汇集。
- Terra 不承担日常实现、常规测试或普通审查。

## Sol 分级决策与审查

- `spec-planner`、`independent-reviewer`、`course-pedagogy-reviewer`、`performance-reviewer`：Sol `medium`，规划、常规独立审查和中等风险领域判断。
- `ai-context-reviewer`、`data-governance-reviewer`、`simulation-domain-reviewer`、`security-reviewer`、`release-sentinel`：Sol `high`，高语义或高正确性风险领域审查。
- `critical-reviewer`：Sol `xhigh`，只用于高风险、架构回归、安全敏感或发布关键终审。

## 权限

- 正式写代理：`spark-coder`、`patch-worker`、`test-engineer`。
- 诊断写权限：`deep-debugger`，不得完成正式修复。
- 其余角色只读。
