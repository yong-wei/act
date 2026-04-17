# 3-8 互动课程实现记录

更新时间：2026-04-17

## 设计稿到实现稿对照表（2026-04-17）

| step | 新版页面模板与关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，路径图固定高亮 `3-5 -> 3-7 -> 3-8 -> 3-9`，无作答区 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |
| step-02 | `translation_chain_board`，统一翻译链、三步判断法、课程目标同页，无作答区 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 静态承载检查 |
| step-03 | `question_stack`，四类误判前测题组，教师可独立发放与揭示答案 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 提交流 |
| step-04 | `table_explain_board`，结构变化总表先于聚焦行判断 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 行聚焦交互 |
| step-05 | `curve_compare_panel`，四类结构变化共用 2×2 曲线工作区 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 曲线联动 |
| step-06 | `worked_example_lab`，完整题面、教师逐步显影链与三张例题卡同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 显影/提交 |
| step-07 | `formula_story_board`，幅角原理与 `P/Z` 解释只浏览，由教师控制显影 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 浏览控制 |
| step-08 | `derivation_compare_board`，`F(s)=1+L(s)`、`(-1,0)` 与因果排序链同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 排序交互 |
| step-09 | `worked_example_quadrant`，Nyquist 快判图组、`P/N/Z` 表与四卡题组同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 快判题组 |
| step-10 | `boundary_compare_board`，边界对照图先于分类作答区 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 分类交互 |
| step-11 | `bode_margin_board`，Bode 图、定义式、三语言表与热点标注同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 热点标注 |
| step-12 | `worked_example_locator`，Bode 读图顺序、教师显影与三张作答卡同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 显影/提交 |
| step-13 | `band_focus_board`，三频段总图与职责表先于聚焦层，无占位提交壳 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 静态承载检查 |
| step-14 | `goal_switch_board`，目标切换卡片后接页内 AI，对外只保留这一页可见 AI | `src/lib/unit-3-8-course.ts` + `src/lib/unit-3-8-ai-contexts.ts` + `step-panels.tsx` | 已实现 | 契约单测 + AI 页面约束 |
| step-15 | `case_baseline_board`，航向控制基线证据与问题定位先于结论 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 证据标记 |
| step-16 | `case_translation_board`，航向控制翻译链、指标读回与结构化比较同页 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 结构化比较 |
| step-17 | `scheme_problem_board`，稳定平台先讲“只改增益”的结构性矛盾 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 方案投票 |
| step-18 | `scheme_compare_lab`，三方案对照后再做结构化比较 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 结构化比较 |
| step-19 | `posttest_board`，后测题组回收完整判断链 | `src/lib/unit-3-8-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 后测提交流 |
| step-20 | `summary_reflection_board`，信息图、小结与一句反思卡收束全课 | `src/lib/unit-3-8-course.ts` + `step-panels.tsx` + `student-page.tsx` | 已实现 | 契约单测 + 演示页 |

## 当前实现结论

- 双轨真源以 `design/interactive-page.md` 与 `design/interactive-contract.yaml` 为准，代码已切换到 20 步新版页面流。
- 学生端与教师端已接入新版同步状态：`revealedAnswers`、`releasedActivities`、`browseEnabled`、`teacherRevealProgress`。
- `step-14` 是唯一页内可见 AI 页面，其他步骤只保留隐藏式全局 AI 上下文。
- 展示页不再渲染“无需提交”或空教师汇总壳层；学生总结面板改到 `step-20`。
- 运行时媒体路径、课堂入口、课堂路由、AI 注册表和课堂事件复用当前精品互动课统一基线。

## 本轮实现范围

- 重写 `src/lib/unit-3-8-course.ts`，对齐新版 20 步课程元数据、页面契约与教师同步载荷。
- 重写 `src/lib/unit-3-8-ai-contexts.ts`，保留 `step-14` 可见 AI，其余步骤只提供隐藏式上下文。
- 重写 `src/features/interactive/unit-3-8-frequency-domain-translation-judgment/workspace.ts` 与 `step-panels.tsx`。
- 更新 `student-page.tsx` 与 `teacher-page.tsx`，接入新版浏览控制、教师显影和总结页逻辑。
- 更新 `course-content/runtime/lessons/3-8/lesson.json` 的 `sequence.groups` 到新版 20 步编排。
- 更新 `src/features/interactive/__tests__/unit-3-8-course.test.ts`，覆盖 20 步契约、AI 页面约束与教师同步字段。

## 运行时真源

- `course-content/runtime/lessons/3-8/lesson.json`
- `course-content/runtime/lessons/3-8/graph-overlay.json`
- `course-content/runtime/lessons/3-8/handout.md`
- `course-content/runtime/lessons/3-8/handout.pdf`
- `course-content/runtime/lessons/3-8/media/3-8-media.md`
- `course-content/runtime/lessons/3-8/review/*`
