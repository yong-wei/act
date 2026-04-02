# 3-2 Interactive V2 Upgrade Plan

> **For Codex:** 本计划用于当前会话直接执行；目标是在作者态把 `3-2` 互动课程设计升级为 V2 双轨真源，并完成课程审核复核。

**Goal:** 将 `3-2` 从旧版单稿互动设计升级为 `interactive-page.md` + `interactive-contract.yaml` 的双轨真源，并确保审核脚本产出互动页专项校验结果。

**Architecture:** 以现有 `3-2` 讲义、旧版互动稿和 `2-2` / `2-3` 双轨样例为输入，重写人读稿章节结构，补齐步骤级静态承载与互动升级，再同步新增机读契约。完成后运行 `review_lesson_content.py --lesson 3-2` 验证映射、公式覆盖与契约字段。

**Tech Stack:** Markdown、JSON/YAML 子集、Python 课程审查脚本

### Task 1: 收敛 V2 结构

**Files:**
- Read: `course-content/authoring/lessons/3-2/design/interactive-page.md`
- Read: `course-content/authoring/lessons/2-2/design/interactive-page.md`
- Read: `course-content/authoring/lessons/2-2/design/interactive-contract.yaml`
- Read: `course-content/authoring/lessons/2-3/design/interactive-page.md`
- Read: `course-content/scripts/review_lesson_content.py`

**Step 1:** 确认 `3-2` 当前缺口是缺少 `文档职责 / 表述规则 / 全课总览 / 讲义核心内容映射 / interactive-contract.yaml`。

**Step 2:** 提炼 `3-2` 需要保留的 13 步课堂主线、媒体资源和实践课追踪要求。

### Task 2: 重写人读稿

**Files:**
- Modify: `course-content/authoring/lessons/3-2/design/interactive-page.md`

**Step 1:** 新增 V2 顶层章节：`文档职责`、`表述规则`、`全课总览`、`讲义核心内容映射`。

**Step 2:** 将 13 个旧步骤改写为 V2 结构，每步固定包含：
- `页面骨架`
- `模块清单`
- `静态承载内容`
- `互动升级点`
- `埋点与教师数据`
- `AI 边界`
- `预览口径`

**Step 3:** 在总览与步骤级内容中明确实践课分钟与学生产出，满足“可追踪实践训练”要求。

### Task 3: 新增机读契约

**Files:**
- Create: `course-content/authoring/lessons/3-2/design/interactive-contract.yaml`

**Step 1:** 参照 `2-2` / `2-3` 契约格式，定义课程级字段：`contract_version`、`lesson_id`、`course_title`、`course_route_segment`、`preview_mode`、`required_step_fields` 等。

**Step 2:** 为 `step-01` 到 `step-13` 逐步补齐：
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

### Task 4: 审核与收口

**Files:**
- Verify: `course-content/runtime/lessons/3-2/review/interactive-page-check.json`
- Verify: `course-content/runtime/lessons/3-2/review/review-report.md`

**Step 1:** 运行：

```bash
python3 course-content/scripts/review_lesson_content.py --lesson 3-2
```

**Step 2:** 检查以下项是否为 0 或无缺失：
- `missing_contract_fields`
- `step_contract_issues`
- `missing_target_steps`
- `formula_mapping_issues`

**Step 3:** 若审核脚本返回问题，回写作者态文档并重跑，直到通过。
