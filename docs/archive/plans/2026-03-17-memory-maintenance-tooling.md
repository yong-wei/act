# Memory Maintenance Tooling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `.codex/memory` 记忆维护体系补一个参考模板文件，并新增一个 `memory-maintenance` skill 专用 Python 校验脚本，帮助持续维护头部字段和目录索引完整性。

**Architecture:** 模板文件放在 `.agents/skills/memory-maintenance/references/`，仅承担“如何写”的静态参考；校验脚本放在 `.agents/skills/memory-maintenance/scripts/validate_memory.py`，只做结构约束检查，不做复杂状态管理。测试采用 Python 标准库 + 临时目录，避免引入额外依赖。

**Tech Stack:** Markdown、Python 3、标准库 `pathlib`/`tempfile`/`subprocess`

### Task 1: 补参考模板

**Files:**
- Create: `.agents/skills/memory-maintenance/references/memory-file-template.md`
- Modify: `.agents/skills/memory-maintenance/SKILL.md`

**Step 1: 提供通用模板**

模板至少覆盖：
- 通用叶子文件头
- `00-index.md` 模板
- incident 模板
- decision 模板

**Step 2: 在 skill 中显式引用模板**

让维护者知道何时直接复制模板，何时只按模板字段补写。

### Task 2: 先写失败测试

**Files:**
- Create: `scripts/tests/test_memory_validate.py`

**Step 1: 写目录结构与头部字段测试**

测试至少覆盖：
- 合法的 memory 目录结构应返回成功
- 缺少 `00-index.md` 的一级目录应返回失败
- 缺少必需头部字段的 Markdown 文件应返回失败

**Step 2: 运行测试并确认失败**

Run: `python3 scripts/tests/test_memory_validate.py`

Expected: 因脚本尚不存在或行为未实现而失败。

### Task 3: 实现最小校验脚本

**Files:**
- Create: `.agents/skills/memory-maintenance/scripts/validate_memory.py`

**Step 1: 实现校验范围**

最小要求：
- 检查 `.codex/memory` 下一级主题目录是否包含 `00-index.md`，`90-archive` 允许使用 `README.md`
- 检查所有 `.md` 文件是否包含：
  - `状态:`
  - `最后更新:`
  - `摘要:`
  - `上游:`
  - `下游:`
  - `相关:`

**Step 2: 提供 CLI 输出**

脚本输出：
- 成功时打印通过摘要
- 失败时逐条列出问题并以非零退出

### Task 4: 更新引用并验证

**Files:**
- Modify: `.codex/memory/README.md`

**Step 1: 在 README 中加入校验脚本入口**

说明维护后可运行：

```bash
python3 .agents/skills/memory-maintenance/scripts/validate_memory.py
```

**Step 2: 运行验证**

Run: `python3 scripts/tests/test_memory_validate.py`
Expected: PASS

Run: `python3 scripts/memory/validate_memory.py`
Expected: PASS，并输出当前 memory 结构通过校验
