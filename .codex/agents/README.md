# 项目级 Codex Custom Agents

本目录保存 ACT 的项目命名子代理。全局 `AGENTS.md` 定义通用授权、模型分层、独立审查和回收规则；这里仅定义项目角色、权限与领域边界。

## 调用约束

- 用户已授权子代理且存在匹配角色时，必须调用命名角色，不得以自由派发替代。
- 派发后核对 `agent_role`、模型和推理强度；`agent_role = null` 表示自由派发，不算命名代理调用成功。
- 自由派发仅允许在没有匹配角色且运行时能够显式控制模型与推理强度时使用。
- 写任务优先交给写代理，以保持主线程上下文聚焦；写代理串行修改同一工作树。
- 角色是可组合能力，不是固定流水线。主线程按任务风险选择最小充分集合。

## 代理清单

| Agent | 权限 | 模型 / 推理 | 主要用途 |
| --- | --- | --- | --- |
| `agent-router` | 只读 | Luna / `high` | 复杂任务的角色选择与批次建议 |
| `explorer-librarian` | 只读 | Luna / `xhigh` | 材料读扫、大文件摘要与路径索引 |
| `code-mapper` | 只读 | Luna / `xhigh` | 代码路径、模块边界与数据流映射 |
| `spark-coder` | 可写 | Luna / `high` | 简单、局部、可快速验证的改动 |
| `patch-worker` | 可写 | Luna / `max` | 常规实现、有边界的多文件改动与普通重构 |
| `test-engineer` | 可写 | Luna / `xhigh` | 复现、测试生成与聚焦验证 |
| `deep-debugger` | 诊断写权限 | Luna / `xhigh` | 范围明确的复杂排障与根因定位 |
| `ui-flow-reviewer` | 只读 | Luna / `high` | UI 路径、状态、响应式与可访问性审查 |
| `retro-analyst` | 只读 | Luna / `high` | 失败复盘与持久流程改进 |
| `long-context-investigator` | 只读 | Terra / `high` | Luna 不足时的仓库级、长上下文调查 |
| `spec-planner` | 只读 | Sol / `medium` | 非平凡功能、迁移和验收规划 |
| `independent-reviewer` | 只读 | Sol / `medium` | 代码产出后的常规独立审查 |
| `course-pedagogy-reviewer` | 只读 | Sol / `medium` | 课程、教学活动和 runtime 语义审查 |
| `performance-reviewer` | 只读 | Sol / `medium` | 性能、可靠性与运行成本审查 |
| `ai-context-reviewer` | 只读 | Sol / `medium` | AI 上下文、模型配置与可信性审查 |
| `data-governance-reviewer` | 只读 | Sol / `medium` | 学习事件、画像、指标与隐私审查 |
| `simulation-domain-reviewer` | 只读 | Sol / `medium` | 控制、仿真、Rust/WASM 与 Arena 审查 |
| `security-reviewer` | 只读 | Sol / `medium` | 认证、授权、注入与数据暴露审查 |
| `release-sentinel` | 只读 | Sol / `medium` | 迁移、CI、部署、回滚与发布门禁 |
| `critical-reviewer` | 只读 | Sol / `high` | 高风险、架构回归与发布关键终审 |

## 权限说明

- `spark-coder`、`patch-worker` 和 `test-engineer` 可以修改任务范围内的文件。
- `deep-debugger` 的写权限只用于诊断命令、临时产物或父任务明确授权的诊断性改动，正式修复交给实现代理。
- reviewer、planner、mapper 和 investigator 均只读，不得修复自己发现的问题。

## 治理与验证

- `.codex/config.toml` 的 `project-agent-catalog` 必须与 TOML 一致。
- `quality-ledger.jsonl` 记录真实运行质量、成本、返工和派发方式，不再只记录能否启动。
- 配置变更后运行：

```bash
python3 .agents/skills/agent-evolver/scripts/validate_agent_configs.py --root "$(pwd)"
```
