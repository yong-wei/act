# 项目级 Custom Agents

本目录保存当前仓库的 Codex custom agents。

- `starter.toml`：多数起步任务与任务分流
- `deep-debugger.toml`：复杂分析与排障
- `critical-reviewer.toml`：关键审查与终审
- `explorer-librarian.toml`：探索、读扫、大文件与支持性文档
- `spark-coder.toml`：极低延迟简单编码

治理文件：

- `quality-ledger.jsonl`：运行质量台账

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
