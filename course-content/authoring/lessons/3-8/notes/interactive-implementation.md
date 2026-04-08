# 3-8 互动课程实现记录

更新时间：2026-04-08

## 设计稿到实现稿对照表（2026-04-08）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，路径图固定高亮 `3-5 -> 3-7 -> 3-8 -> 3-9`，无作答区 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |
| step-02 | `comparison_gallery_with_prompt`，四图对照 + 两问清单 + `binary_choice` | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 静态承载检查 |
| step-03 | `goal_boundary_slide`，目标卡与边界表同屏，无互动 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |
| step-04 | `question_stack`，四题前测，允许一次重提 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 提交流 |
| step-05 | `formula_table_match`，频域翻译总表先于 `triple_match` | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 配对交互 |
| step-06 | `formula_media_compare`，公式链、几何示意与 `reason_check` 同屏 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 顺序判断 |
| step-07 | `comparison_panel_with_sort`，四图判稳表先于 `card_sort` | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 排序交互 |
| step-08 | `dual_graph_indicator_locator`，Bode 图、指标表与 `hotspot_labeling` 同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 标注交互 |
| step-09 | `compare_then_ai`，学生先独立判断三频段，再看 AI 对照 | `src/lib/unit-3-8-course.ts` + `src/lib/unit-3-8-ai-contexts.ts` + `step-panels.tsx` | 已实现 | 契约单测 + AI 页面约束 |
| step-10 | `design_compare_workspace`，航向控制案例 2×2 对照 + `structured_compare` | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 对比填写 |
| step-11 | `design_compare_workspace`，平台稳定案例三方案对照 + `structured_compare` | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 对比填写 |
| step-12 | `summary_quiz_board`，后测题组、小结卡与 `3-9 / 4-1` 去向卡同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |

说明：
- 本轮以 `course-content/authoring/lessons/3-8/design/interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，不接受降级实现。
- runtime 真源统一来自 `course-content/runtime/lessons/3-8/`，入口页媒体、讲义摘要与课堂外资源埋点只消费 runtime 产物。
- 入口页继续复用 `LessonEntryMediaHub` + `LessonEntryRuntimeSections` 统一模板，课堂外资源互动埋点沿用共享链路。
- AI 只在 `step-09` 的 `ai_compare_workspace` 页面开放，其他步骤保持“先独立判断、再看答案/教师揭示”的边界。

## 本轮实现范围

- 新增主线精品互动课路由：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment`
- 新增 `src/lib/unit-3-8-course.ts` 与 `src/lib/unit-3-8-ai-contexts.ts`
- 新增 `src/features/interactive/unit-3-8-frequency-domain-translation-judgment/`
  - `entry-page.tsx`
  - `student-page.tsx`
  - `teacher-page.tsx`
  - `course-header.tsx`
  - `step-panels.tsx`
  - `workspace.ts`
- 新增 `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/` 三类页面入口
- 新增 `src/features/teacher/preset-lessons/presets/unit-3-8-frequency-domain-translation-judgment.ts`
- 接入 `learning-catalog`、`classroom-session-route`、`course-ai-contexts`、`preset index`
- 新增 `src/features/interactive/__tests__/unit-3-8-course.test.ts`

## 运行时真源

- `course-content/runtime/lessons/3-8/lesson.json`
- `course-content/runtime/lessons/3-8/graph-overlay.json`
- `course-content/runtime/lessons/3-8/handout.md`
- `course-content/runtime/lessons/3-8/handout.pdf`
- `course-content/runtime/lessons/3-8/media/3-8-media.md`
- `course-content/runtime/lessons/3-8/review/*`
