# 3-7 互动课程实现记录

更新时间：2026-04-08

## 设计稿到实现稿对照表（2026-04-08）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，路径图高亮 `3-6 -> 3-7 -> 3-8`，无作答区 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 演示页 |
| step-02 | `goal_boundary_slide`，目标卡与边界表同屏，无互动 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 演示页 |
| step-03 | `question_stack`，三题前测，允许一次重提 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 提交流 |
| step-04 | `formula_media_compare`，双通道结构图 + 四式卡 + `hotspot_labeling` | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 静态承载检查 |
| step-05 | `worked_example_workspace`，三步法与例题 1 同屏 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 推导链检查 |
| step-06 | `formula_table_match`，型别定义、误差系数与快判边界完整落页 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 表格静态检查 |
| step-07 | `worked_example_workspace`，例题 2 总误差式与结果 `0.4` 同页 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 双通道列式检查 |
| step-08 | `contrast_summary_board`，增益 vs 型别对照卡不能缺失 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 教师揭示 |
| step-09 | `comparison_panel_with_sort`，PI/lag 图表先于排序区出现 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 排序交互 |
| step-10 | `design_compare_workspace`，两张时域设计图 + 指标卡 + `structured_compare` | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 对比填写 |
| step-11 | `formula_media_compare`，PI 频域设计图 + PI/PD 对照图 + `triple_match` | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 频域过渡检查 |
| step-12 | `summary_quiz_board`，后测、小结卡、规则表、`3-8` 去向卡同页 | `src/lib/unit-3-7-course.ts` + `step-panels.tsx` | 实现中 | 契约单测 + 演示页 |

说明：
- 本轮以 `course-content/authoring/lessons/3-7/design/interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，不接受降级实现。
- runtime 真源统一来自 `course-content/runtime/lessons/3-7/`，入口页媒体与讲义摘要只消费 runtime 产物。
- 入口页沿用 `LessonEntryMediaHub` + `LessonEntryRuntimeSections` 的统一模板，课堂外资源埋点复用共享链路。
- 当前主缺口是 `3-7` 课程代码目录、注册点、AI 上下文与契约对齐测试。

## 本轮实现范围

- 新增主线精品互动课路由：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation`
- 新增 `src/lib/unit-3-7-course.ts` 与 `src/lib/unit-3-7-ai-contexts.ts`
- 新增 `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/`
  - `entry-page.tsx`
  - `student-page.tsx`
  - `teacher-page.tsx`
  - `course-header.tsx`
  - `step-panels.tsx`
  - `workspace.ts`
- 新增 `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/` 三类页面入口
- 新增 `src/features/teacher/preset-lessons/presets/unit-3-7-steady-error-low-frequency-compensation.ts`
- 接入 `learning-catalog`、`classroom-session-route`、`course-ai-contexts`、`preset index`
- 新增 `src/features/interactive/__tests__/unit-3-7-course.test.ts`

## 运行时真源

- `course-content/runtime/lessons/3-7/lesson.json`
- `course-content/runtime/lessons/3-7/graph-overlay.json`
- `course-content/runtime/lessons/3-7/handout.md`
- `course-content/runtime/lessons/3-7/handout.pdf`
- `course-content/runtime/lessons/3-7/media/3-7-media.md`
- `course-content/runtime/lessons/3-7/review/*`
