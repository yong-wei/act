# 4-1 互动课程实现记录

更新时间：2026-04-13

## 设计稿到实现稿对照表（2026-04-13）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，标题回正为“稳定不是任务完成”，无作答区 | `src/lib/unit-4-1-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |
| step-02 | `goal_boundary_slide`，目标卡与边界表同屏，无作答区 | `src/lib/unit-4-1-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |
| step-03 | `question_stack`，三题预判，误区标签回正 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 提交流 |
| step-04 | `case_study_dashboard`，客船案例，`parameter_slider`，`2x2` 曲线镜像 + 图下折叠控件 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |
| step-05 | `case_study_dashboard`，平台案例，`parameter_slider`，特殊综合图镜像 + 图下折叠控件 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |
| step-06 | `contrast_summary_board`，双案例对照矩阵先于排序区 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 排序交互 |
| step-07 | `formula_table_match`，三类指标问题分工先于 `triple_match` | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 配对交互 |
| step-08 | `comparison_panel_with_sort`，角色规则卡先于分类区 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 分类交互 |
| step-09 | `task_card_workspace`，模板卡、证据库和填写区同屏 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 工作区提交 |
| step-10 | `layered_region_board`，集合关系与分层图示先于判断题 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 判断交互 |
| step-11 | `misconception_board`，三类误判完整落页 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 误判交互 |
| step-12 | `summary_quiz_board`，后测、小结与去向卡同屏 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |

说明：

- 本轮以 `course-content/authoring/lessons/4-1/design/interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，不接受降级实现。
- AI 继续通过 `useGlobalAI().updatePageContext(...)` 提供隐藏式页面上下文，不在页内暴露显式 AI 助手面板。
- 曲线图步骤优先保证：页面顺序、曲线镜像排布、控件位置和默认基线状态与讲义一致；本轮实现不允许把参数联动页退回成选择题、排序题或纯说明卡。
