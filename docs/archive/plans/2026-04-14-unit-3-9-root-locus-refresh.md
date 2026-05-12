# 3-9 Root Locus Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `3-9` 讲义中的全部根轨迹子图改为基于精确原始样本和分支连续匹配的统一出图结果，消除分离点处不重合现象。

**Architecture:** 保留 `Octave` 负责对象、控制器、时域与频域数据计算；把根轨迹链路改为“原始样本 CSV + 开环极点/零点 CSV + Python 分支匹配 + Matplotlib 复绘”。回归检查直接验证匹配后分支文件和审计报告，避免只靠肉眼判断。

**Tech Stack:** Octave control, Python 3, matplotlib, lesson `root_locus_branch_match.py`

### Task 1: 建立回归检查

**Files:**
- Create: `course-content/authoring/lessons/3-9/media/raw/check_root_locus_alignment.py`

**Step 1: Write the failing test**

实现一个 Python 检查脚本，要求以下文件全部存在：
- `generated-data/<variant>_root_locus_points.csv`
- `generated-data/<variant>_root_locus_audit.json`

并验证：
- `branch_count == expected_branch_count`
- `finite_zero_coverage.all_matched_within_tolerance == true`
- `max_jump <= 0.25`

**Step 2: Run test to verify it fails**

Run: `python3 course-content/authoring/lessons/3-9/media/raw/check_root_locus_alignment.py`

Expected: FAIL，提示匹配后分支文件或审计文件缺失。

### Task 2: 改造数据生成链路

**Files:**
- Modify: `course-content/authoring/lessons/3-9/media/raw/generate_design_data.m`

**Step 1: Export raw root-locus samples**

为每个版本导出：
- `<variant>_root_locus_raw_samples.csv`
- `<variant>_open_loop_poles.csv`
- `<variant>_open_loop_zeros.csv`

要求使用 `rlocus()` 导出根轨迹原始样本，而不是直接依赖 `roots()` 的返回顺序作为最终连线顺序。

**Step 2: Keep existing JSON payload intact where still needed**

保留时域、频域、极点、裕度等 JSON 结构，供出图脚本继续使用。

### Task 3: 改造复绘脚本

**Files:**
- Modify: `course-content/authoring/lessons/3-9/media/raw/render_figures.py`

**Step 1: Match branches with lesson helper**

像 `3-4` 一样，在 Python 侧读取每个版本的原始样本 CSV，调用 `root_locus_branch_match.py` 生成：
- `<variant>_root_locus_points.csv`
- `<variant>_root_locus_audit.json`

**Step 2: Plot from matched branches**

根轨迹子图只使用匹配后的连续分支数据，不再直接按原矩阵行序连线。

### Task 4: 重新生成并验证

**Files:**
- Modify: `course-content/authoring/lessons/3-9/media/raw/generated-data/*`
- Modify: `course-content/authoring/lessons/3-9/media/processed/*.png`

**Step 1: Regenerate**

Run:
- `octave --quiet course-content/authoring/lessons/3-9/media/raw/generate_design_data.m`
- `python3 course-content/authoring/lessons/3-9/media/raw/render_figures.py`

**Step 2: Verify**

Run:
- `python3 course-content/authoring/lessons/3-9/media/raw/check_root_locus_alignment.py`

Expected: PASS，所有版本的分支文件和审计报告齐全，连续性指标满足阈值。
