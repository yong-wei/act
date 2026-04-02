# Lesson 2-3 Interactive Design Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `2-3` 的互动课程设计升级为当前作者态 V2 双轨真源，并完成一次可复现的课程审查导出。

**Architecture:** 以 `course-content/authoring/lessons/2-3/design/handout.md`、`boppps.md` 和现有 `interactive-page.md` 为需求源，参考 `2-2` 的双轨样例，重写人读页面蓝图并新增机读契约。随后运行 `course-content/scripts/review_lesson_content.py --lesson 2-3` 验证 `interactive-page-check.json`、`source-manifest.json` 与 runtime 审查包符合当前链路要求。

**Tech Stack:** Markdown, JSON-as-YAML, Python review script

### Task 1: Baseline Review Failure

**Files:**
- Verify: `course-content/authoring/lessons/2-3/design/interactive-page.md`
- Verify: `course-content/runtime/lessons/2-3/review/interactive-page-check.json`

**Step 1: Run failing review**

Run: `python3 course-content/scripts/review_lesson_content.py --lesson 2-3 --skip-export`

Expected: 审查输出生成 `interactive-page-check.json`，其中包含缺少“讲义核心内容映射”、所有步骤缺少“静态承载内容 / 互动升级点”等问题。

### Task 2: Upgrade Human-Readable Interactive Blueprint

**Files:**
- Modify: `course-content/authoring/lessons/2-3/design/interactive-page.md`
- Reference: `course-content/authoring/lessons/2-2/design/interactive-page.md`
- Reference: `course-content/authoring/lessons/2-3/design/handout.md`
- Reference: `course-content/authoring/lessons/2-3/design/boppps.md`

**Step 1: Add V2 document contract**

Write:
- `文档职责`
- `表述规则`
- `全课总览`
- `讲义核心内容映射`

**Step 2: Rewrite each of the 17 steps**

For every `## 步骤 XX｜...` section, include at minimum:
- `### 页面骨架`
- `### 模块清单`
- `### 静态承载内容`
- `### 互动升级点`
- `### 埋点与教师数据`
- `### AI 边界`
- `### 预览口径`

**Step 3: Align coverage with handout anchors**

Ensure the mapping table covers:
- 引入与频率选择性
- `2.1` 时域到频域过渡
- `2.2` 傅里叶思想
- `2.3` 正弦稳态响应
- `2.4` 频率特性与一阶惯性例子
- `2.5` `s=j\omega`
- `3.1` 与 `3.2` 例题
- `5.1 / 5.2` 总结与衔接

### Task 3: Add Machine-Readable Interactive Contract

**Files:**
- Create: `course-content/authoring/lessons/2-3/design/interactive-contract.yaml`
- Reference: `course-content/authoring/lessons/2-2/design/interactive-contract.yaml`

**Step 1: Define top-level contract**

Include:
- `contract_version`
- `lesson_id`
- `course_title`
- `course_route_segment`
- `preview_mode`
- `telemetry_strategy`
- `teacher_insight_strategy`
- `required_step_fields`

**Step 2: Add 17 step payloads**

Each step must define:
- `layout`
- `modules`
- `content_blocks`
- `interaction_spec`
- `teacher_controls`
- `telemetry_spec`
- `teacher_insight_spec`
- `ai_context_spec`
- `preview_contract`
- `acceptance_checks`

### Task 4: Re-run Review And Export

**Files:**
- Verify: `course-content/runtime/lessons/2-3/review/interactive-page-check.json`
- Verify: `course-content/runtime/lessons/2-3/review/review-report.md`
- Verify: `course-content/runtime/lessons/2-3/review/source-manifest.json`

**Step 1: Run review again**

Run: `python3 course-content/scripts/review_lesson_content.py --lesson 2-3`

Expected:
- `interactive-page-check.json` has empty `issues`
- `summary` includes static coverage and V2 contract detection
- `source-manifest.json` records both `interactive_page_source` and `interactive_contract_source`

**Step 2: Inspect runtime outputs**

Run:
- `sed -n '1,220p' course-content/runtime/lessons/2-3/review/interactive-page-check.json`
- `sed -n '1,220p' course-content/runtime/lessons/2-3/review/review-report.md`
- `sed -n '1,220p' course-content/runtime/lessons/2-3/review/source-manifest.json`

Expected: 审查报告已将互动页与契约纳入正式审查结论。
