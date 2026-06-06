# 2026-03-20 lesson 技能复刻计划

- 目标：在项目 `.agents/skills/lesson` 下复刻 `.claude/skills/lesson`，并新增 runtime -> authoring 全量知识同步、合并与冲突检测前置步骤。
- 决策：同步范围为全量；发现冲突时中止并输出清单，不自动覆盖。
- 执行项：
  1. 复制原有 `references/` 与 `scripts/` 作为基础。
  2. 新增 `sync_runtime_knowledge.py`，负责全量同步、合并与冲突检测。
  3. 改写 `SKILL.md`，把运行时知识同步写入制作前步骤。
  4. 把 `.claude/skills/lesson` 路径引用替换为 `.agents/skills/lesson`。
  5. 生成 `agents/openai.yaml` 并运行快速校验。
