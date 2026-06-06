# 项目级 Codex Custom Agents

本目录保存 AI-OBE 船舶智控平台的项目级 Codex custom agents。它们不是插件系统，也不兼容其他代理工具；它们只用于 Codex 的 `.codex/agents/*.toml` 子代理机制。

## 使用边界

- 只有用户明确授权当前任务、会话、分支或 review 使用子代理后，主线程才按需调度本目录代理。
- 主线程始终负责最终判断、补丁范围、验证结果和合并准备度。子代理输出是证据，不是最终裁决。
- `agents.max_depth = 1`，子代理不得再启动子代理。
- 普通任务使用 0-2 个代理；非平凡功能、重构或 bug 修复使用 2-4 个；完整分支、PR、发布或架构 review 才使用 4-6 个。
- 读代理可以并行，写代理原则上串行。不得让两个 `workspace-write` 代理同时修改同一工作树。
- 详细路由规则见 [ROUTING.md](ROUTING.md)，主线程 harness 见 [HARNESS.md](HARNESS.md)。

## 推理强度命名

当前仓库校验脚本允许的 `model_reasoning_effort` 字段值为：`low`、`medium`、`high`、`xhigh`。

中文口径中的“超高”对应 TOML 字段值 `xhigh`，不要写成 `ultra` 或 `超高`，除非同步修改校验脚本。

## 代理清单

| Agent | 权限 | 模型 / 推理 | 主要用途 |
| --- | --- | --- | --- |
| `agent-router` | 只读 | `gpt-5.4` / `medium` | 子代理选择、任务拆分、执行批次建议 |
| `explorer-librarian` | 只读 | `gpt-5.4-mini` / `medium` | 搜索、读扫、大文件摘要、材料整理 |
| `code-mapper` | 只读 | `gpt-5.4` / `medium` | 代码路径、模块边界、执行流和数据流映射 |
| `spec-planner` | 只读 | `gpt-5.5` / `high` | 非平凡功能、重构、迁移的计划、验收和回滚 |
| `spark-coder` | 可写 | `gpt-5.3-codex-spark` / `medium` | 极低延迟简单编码、小范围修补、样板补全 |
| `patch-worker` | 可写 | `gpt-5.4` / `high` | 范围清晰后的最小安全实现 |
| `test-engineer` | 可写 | `gpt-5.4` / `high` | 复现、回归测试、最小充分验证路径 |
| `deep-debugger` | 可写但不做正式修复 | `gpt-5.5` / `high` | 复杂分析、跨文件排障、根因定位 |
| `critical-reviewer` | 只读 | `gpt-5.5` / `xhigh` | 正确性、回归、隐藏耦合、可维护性和测试缺口终审 |
| `security-reviewer` | 只读 | `gpt-5.5` / `high` | 认证、授权、密钥、注入、文件/shell 安全和数据暴露 |
| `performance-reviewer` | 只读 | `gpt-5.4` / `high` | 热路径、数据库、缓存、并发、渲染和运行稳定性 |
| `ui-flow-reviewer` | 只读 | `gpt-5.4` / `medium` | UI 路径、状态行为、响应式、可访问性和错误/空状态 |
| `course-pedagogy-reviewer` | 只读 | `gpt-5.5` / `high` | 讲义、BOPPPS、互动设计、知识图谱、媒体和教学活动有效性 |
| `simulation-domain-reviewer` | 只读 | `gpt-5.5` / `high` | 自动控制、仿真、Rust/WASM、Arena 评分和教学正确性 |
| `data-governance-reviewer` | 只读 | `gpt-5.5` / `high` | 学习事件、画像、分析语义、推荐输入和隐私边界 |
| `ai-context-reviewer` | 只读 | `gpt-5.5` / `high` | AI 上下文、课程 AI、仿真伴学、画像摘要和模型配置 |
| `release-sentinel` | 只读 | `gpt-5.5` / `high` | 迁移、环境变量、CI、部署、回滚和运维发布门禁 |
| `retro-analyst` | 只读 | `gpt-5.4` / `medium` | 重复失败复盘，沉淀规则、技能、脚本、测试或流程改进 |

## 治理文件

- `.codex/config.toml` 中的 `project-agent-catalog`：代理发现目录，必须与 `.codex/agents/*.toml` 保持一致。
- `quality-ledger.jsonl`：运行质量台账，用于后续调参，不作为一次性日志倾倒区。

## 校验命令

新增、删除、重命名或调参后运行：

```bash
python3 .agents/skills/agent-evolver/scripts/validate_agent_configs.py --root "$(pwd)"
```

重要调整后向 `quality-ledger.jsonl` 追加说明，记录调整原因和预期用途。
