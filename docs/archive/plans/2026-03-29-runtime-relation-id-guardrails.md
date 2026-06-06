# Runtime Relation ID Guardrails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 authoring -> runtime 知识图谱导出链路中的关系 schema 与 `relation_id` 管理问题，杜绝旧课次关系文件再次把重复 `relation_id` 导入 runtime。

**Architecture:** 在 `course-content/scripts/export_runtime.py` 中对 authoring relation 做统一规范化，再由规范化结果生成 runtime relation。对旧 schema 的 `source_name/target_name/relation` 做兼容映射；对缺失 `relation_id` 的关系生成基于关系内容的稳定 ID；对“同一个 `relation_id` 对应不同关系键”的情况在导出阶段直接失败。测试放在 `course-content/tests/test_export_runtime.py`，覆盖旧 schema 兼容、稳定 ID 和 duplicate guard。

**Tech Stack:** Python 3、pytest、JSONL authoring/runtime knowledge pipeline

### Task 1: 写失败测试

**Files:**
- Modify: `course-content/tests/test_export_runtime.py`

**Step 1: Write the failing test**

- 增加一个测试，构造旧 schema lesson relation（只有 `source_id/source_name/target_id/target_name/relation`），断言导出后：
  - `relation_type` 保留旧值，例如 `contains`
  - `relation_id` 不再是位置型 `rt-*`
  - 多次构造相同关系时 `relation_id` 稳定一致
- 增加一个测试，构造两条不同关系但共享同一显式 `relation_id`，断言导出阶段抛出错误

**Step 2: Run test to verify it fails**

Run: `pytest course-content/tests/test_export_runtime.py -q`

Expected: 新增测试失败，说明当前导出脚本不能正确处理旧 schema 与 duplicate `relation_id`

### Task 2: 规范化 relation 输入

**Files:**
- Modify: `course-content/scripts/export_runtime.py`

**Step 1: Add normalization helper**

- 为 relation record 增加规范化函数，统一读取：
  - `source_id` / `target_id`
  - `source` 或 `source_name`
  - `target` 或 `target_name`
  - `relation_type` 或 `relation`
  - `relation_id`

**Step 2: Add stable ID helper**

- 为缺失 `relation_id` 的关系生成内容型稳定 ID，基于 `source_id + target_id + relation_type`
- ID 空间不得继续复用 `rt-{index}`

### Task 3: 加 duplicate guard

**Files:**
- Modify: `course-content/scripts/export_runtime.py`

**Step 1: Fail fast on conflicting IDs**

- 若两条不同关系键共用同一个 `relation_id`，导出时直接抛错
- 若同一关系键重复出现，仍允许按现有强度优先规则 dedupe

**Step 2: Keep runtime export behavior**

- 保持现有 runtime 输出结构不变，只修正关系 schema 与 ID 安全性

### Task 4: 验证与回归

**Files:**
- Verify: `course-content/tests/test_export_runtime.py`
- Verify: `.agents/skills/lesson/scripts/sync_runtime_knowledge.py`

**Step 1: Run focused tests**

Run: `pytest course-content/tests/test_export_runtime.py -q`

Expected: PASS

**Step 2: Re-export runtime**

Run: `python3 course-content/scripts/export_runtime.py`

Expected: runtime 知识图谱重新生成且无 duplicate `relation_id`

**Step 3: Run sync check**

Run: `python3 .agents/skills/lesson/scripts/sync_runtime_knowledge.py --check`

Expected: 至少不再出现由 duplicate `relation_id` 导致的 relation 冲突
