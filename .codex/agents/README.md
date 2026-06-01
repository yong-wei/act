# 项目级 Custom Agents

本目录保存当前仓库的 Codex custom agents。

## 使用边界

- 只有用户明确授权当前任务、会话、分支或 review 使用子代理后，主代理才按需调度本目录代理。
- 子代理只做窄角色工作；父线程负责最终判断、补丁范围、验证与合并准备度。
- `agents.max_depth = 1`，子代理不得再启动子代理。
- 普通任务使用 1-3 个代理；完整分支、PR、发布或架构 review 才使用 4-6 个代理。
- 详细路由规则见 [ROUTING.md](ROUTING.md)。

## 代理清单

| Agent | 读写权限 | 主要用途 |
| --- | --- | --- |
| `starter` | 默认 | 多数起步任务、任务分流、初步判断 |
| `code-mapper` | 只读 | 代码路径、模块边界、执行流和数据流映射 |
| `explorer-librarian` | 只读 | 搜索、读扫、大文件审阅和支持性材料整理 |
| `spec-planner` | 只读 | 非平凡功能、重构、迁移的范围计划与验收条件 |
| `spark-coder` | 可写 | 极低延迟简单编码、小范围修补、样板补全 |
| `patch-worker` | 可写 | 范围清晰后的最小安全实现 |
| `test-engineer` | 可写 | 复现、回归测试和最小充分验证路径 |
| `deep-debugger` | 可写 | 复杂分析、跨文件排障、根因定位 |
| `critical-reviewer` | 只读 | 正确性、回归、隐藏耦合、可维护性和测试缺口终审 |
| `security-reviewer` | 只读 | 认证、授权、密钥、注入、文件/shell 安全和数据暴露 |
| `performance-reviewer` | 只读 | 热路径、数据库、缓存、并发、渲染和运行稳定性 |
| `ui-flow-reviewer` | 只读 | UI 路径、状态行为、响应式、可访问性和错误/空状态 |
| `data-governance-reviewer` | 只读 | 学习事件、画像、分析语义、推荐输入和隐私边界 |
| `simulation-domain-reviewer` | 只读 | 控制理论、仿真语义、数值有效性、Arena 评分和教学正确性 |
| `release-sentinel` | 只读 | 迁移、环境变量、CI、部署、回滚和运维发布门禁 |
| `retro-analyst` | 只读 | 重复失败复盘，沉淀规则、技能、脚本、测试或流程改进 |

治理文件：

- `quality-ledger.jsonl`：运行质量台账
- `.codex/config.toml` 中的 `project-agent-catalog`：代理发现目录，与本目录 `.toml` 文件保持一致

校验与调参工具位于：

- `.codex/skills/agent-evolver/scripts/validate_agent_configs.py`
- `.codex/skills/agent-evolver/scripts/propose_agent_tuning.py`
- `.codex/skills/agent-evolver/scripts/record_agent_run.py`

质量台账 JSONL 字段：

- `timestamp`
- `agent`
- `model`
- `reasoning_effort`
- `task_type`
- `outcome`
- `quality`
- `notes`

## 维护要求

- 新增、删除、重命名或调参后，运行：
  `python3 .codex/skills/agent-evolver/scripts/validate_agent_configs.py --root /Users/yw/Documents/Site/act.just.edu.cn`
- 重要调整需要向 `quality-ledger.jsonl` 追加一条说明，记录调整原因和预期用途。
