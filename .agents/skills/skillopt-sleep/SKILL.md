---
name: skillopt-sleep
description: 按用户要求从会话提取 Buddy 技能改进候选并验证，不自动采用。
---

# SkillOpt-Sleep：ACT 项目 Buddy Auto 优化

本项目集成 Microsoft SkillOpt-Sleep `0.2.0`，用于从 Codex Desktop 历史会话中提取与 `openspec-buddy-auto` 相关的重复任务，生成受验证门控的技能文本候选。它优化的是自然语言技能文档，不改变模型权重，也不替代 Buddy controller、helper 或 GitHub 真源逻辑。

## 项目入口

所有操作通过项目 runner 执行：

```bash
rtk bash scripts/skillopt-sleep.sh <action> [options]
```

首次使用先安装项目本地运行时：

```bash
rtk bash scripts/skillopt-sleep-install.sh
```

运行时、配置副本、状态、会话摘要和 staging 产物都位于被忽略的 `.skillopt-sleep/`；不安装到用户级 `~/.agents/skills`，不写入全局 Python 环境。

## 优化目标与安全边界

- 默认目标是 `.agents/skills/openspec-buddy-auto/SKILL.md`。
- 该路径当前是指向 `/Users/YW/Documents/Project/OpenSpec-buddy` 的符号链接；ACT 项目只负责配置和 staging，不把外部技能源码复制进本仓库。
- `evolve_memory=false`：本任务只优化 Buddy 技能，不修改 ACT 的 `AGENTS.md`、`CLAUDE.md` 或其他记忆文件。
- `gate_mode=on`、`gate_metric=mixed`、`auto_adopt=false`：候选必须通过验证门控，且默认只生成提案，不覆盖 live 文件。
- Buddy 的 controller-first、远端 GitHub 真源、review/merge/achievement 硬闸门、单前台写车道和 helper 不直接暴露是不可退让的优化约束。
- 当前外部 OpenSpec-buddy 工作树有未提交变动。没有用户明确批准、staging 报告和外部工作树差异核对，不得执行 `adopt`。

## 推荐闭环

先做无 API 消耗的状态与 dry-run：

```bash
rtk bash scripts/skillopt-sleep.sh status --json
rtk bash scripts/skillopt-sleep.sh dry-run --backend mock --max-sessions 2 --max-tasks 2 --progress --json
```

需要真实优化时，明确使用 Codex 后端并限制预算：

```bash
rtk bash scripts/skillopt-sleep.sh run \
  --backend codex \
  --max-sessions 5 \
  --max-tasks 3 \
  --edit-budget 4 \
  --progress
```

`run` 只会把候选写入 `.skillopt-sleep/staging/<timestamp>/`。先阅读 `report.md`、`report.json`、`manifest.json` 和 `proposed_SKILL.md`，再决定是否把候选交给外部 OpenSpec-buddy 仓库审核。只有显式批准后才可执行：

```bash
rtk bash scripts/skillopt-sleep.sh adopt --staging <reviewed-staging-directory>
```

由于目标是外部符号链接，`adopt` 可能直接修改 OpenSpec-buddy 工作树；采用前必须保存该仓库的 `git status --short` 和目标文件 diff，采用后重新核对并在正确仓库提交。

## 会话与隐私

- 默认 `--source codex`，读取 `$CODEX_HOME/archived_sessions`，只处理与 ACT 项目路径匹配的历史会话。
- 默认回看 72 小时，最多挖掘 12 个任务；需要扩大范围时显式传入参数。
- SkillOpt-Sleep 的脱敏逻辑会处理常见 API key、Bearer token、GitHub token、JWT 和私钥模式；仍不得把原始 transcript、凭证或未审查任务 JSON 写入提交。
- 涉及隐私或需要人工筛选时，先使用 `harvest` 输出任务草稿，审阅并脱敏后再交给真实 backend；不要对 `reviewed=false` 的任务文件运行真实后端。

## 来源

运行时固定依赖 `skillopt==0.2.0`。项目封装遵循 Microsoft SkillOpt 的 Codex `skillopt-sleep` 集成与“stage first, adopt explicitly”安全边界：<https://github.com/microsoft/SkillOpt>。
