# Memory Generator Tooling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `.codex/memory` 增加一个 `memory-maintenance` skill 专用最小模板生成脚本，并把脚本使用方式纳入 `memory-maintenance` skill 与 README 说明。

**Architecture:** 新脚本 `.agents/skills/memory-maintenance/scripts/new_memory_file.py` 只负责按 kind 生成 memory 文件模板，不修改索引、不自动推断分类、不覆盖已有文件。生成后的索引补链和内容细化仍由 `memory-maintenance` skill 负责。测试继续使用 Python 标准库临时目录，覆盖“正确生成”和“拒绝覆盖”两个关键行为。

**Tech Stack:** Python 3、Markdown、标准库 `argparse`/`pathlib`/`subprocess`/`tempfile`

### Task 1: 写失败测试

**Files:**
- Create: `scripts/tests/test_memory_generator.py`

**Step 1: 测试按 kind 生成模板**

至少覆盖：
- `leaf` 生成通用叶子模板
- `incident` 生成 incident 模板

**Step 2: 测试拒绝覆盖**

如果目标文件已存在，脚本应非零退出并提示拒绝覆盖。

**Step 3: 运行测试并确认失败**

Run: `python3 scripts/tests/test_memory_generator.py`

Expected: 因脚本尚不存在或行为未实现而失败。

### Task 2: 实现生成脚本

**Files:**
- Create: `.agents/skills/memory-maintenance/scripts/new_memory_file.py`

**Step 1: 提供最小 CLI**

参数建议：
- `--memory-root`
- `--kind {leaf,index,incident,decision}`
- `--path`
- `--title`

**Step 2: 生成模板正文**

要求：
- 自动写入统一头部字段
- 根据 kind 切换正文骨架
- 不覆盖已有文件

### Task 3: 更新 skill 和 README

**Files:**
- Modify: `.agents/skills/memory-maintenance/SKILL.md`
- Modify: `.codex/memory/README.md`
- Optional Modify: `.agents/skills/memory-maintenance/references/memory-file-template.md`

**Step 1: 在 skill 中加入脚本用法**

说明：
- 何时用脚本快速起稿
- 何时只用参考模板手写更合适

**Step 2: 在 README 中加入脚本命令**

至少给出一个示例命令。

### Task 4: 验证

**Files:**
- Verify: `scripts/tests/test_memory_generator.py`
- Verify: `scripts/tests/test_memory_validate.py`
- Verify: `scripts/memory/new_memory_file.py`
- Verify: `scripts/memory/validate_memory.py`

**Step 1: 运行生成脚本测试**

Run: `python3 scripts/tests/test_memory_generator.py`
Expected: PASS

**Step 2: 回归校验脚本测试**

Run: `python3 scripts/tests/test_memory_validate.py`
Expected: PASS
