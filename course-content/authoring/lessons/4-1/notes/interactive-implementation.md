# 4-1 互动课程实现记录

更新时间：2026-04-14

## 设计稿到实现稿对照表（2026-04-14）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，标题回正为“稳定不是任务完成”，无作答区 | `src/lib/unit-4-1-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |
| step-02 | `goal_boundary_slide`，目标卡与边界表同屏，无作答区 | `src/lib/unit-4-1-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页 |
| step-03 | `question_stack`，三题预判，`telemetrySummaryFields` 必须补齐 `teacherRevealSeen` | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮同步 | `unit-4-1-course.test.ts` 契约对齐单测 |
| step-04 | `case_study_dashboard`，客船案例，`parameter_slider`，`2x2` 曲线镜像 + 图下折叠控件 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 严格审查 |
| step-05 | `case_study_dashboard`，平台案例，`parameter_slider`，`layout_mirror=custom-grid`，特殊综合图镜像 + 图下折叠控件 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮同步 | 契约单测 + 演示页 |
| step-06 | `contrast_summary_board`，双案例对照矩阵先于排序区 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮修复 | 契约单测 + 原生矩阵高亮 + 排序交互 |
| step-07 | `formula_table_match`，三类指标问题分工先于 `triple_match` | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮修复 | 契约单测 + 原生角色矩阵 + 配对交互 |
| step-08 | `comparison_panel_with_sort`，角色规则卡先于分类区 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 分类交互 |
| step-09 | `task_card_workspace`，模板卡、证据库和填写区同屏 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮修复 | 契约单测 + 模板逐段显影 + 工作区提交 |
| step-10 | `layered_region_board`，集合关系与分层图示先于判断题，教师聚合与误判标签回正 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮修复 | 契约单测 + 可点击分层图 + 判断交互 |
| step-11 | `misconception_board`，三类误判完整落页，新增“五步清单”静态承载区 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮同步 | 契约单测 + 静态内容单测 |
| step-12 | `summary_quiz_board`，后测、“四句带走”、本讲产出与 `4-2/4-3/4-4` 去向同屏 | `src/lib/unit-4-1-course.ts` + `workspace.ts` + `step-panels.tsx` | 本轮同步 | 契约单测 + 静态内容单测 |

说明：

- 本轮以 `course-content/authoring/lessons/4-1/design/4-1-interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，不接受降级实现。
- AI 继续通过 `useGlobalAI().updatePageContext(...)` 提供隐藏式页面上下文，不在页内暴露显式 AI 助手面板。
- 曲线图步骤优先保证：页面顺序、曲线镜像排布、控件位置和默认基线状态与讲义一致；本轮实现不允许把参数联动页退回成选择题、排序题或纯说明卡。
- `step-06`、`step-07`、`step-09`、`step-10` 已移除静态主图映射，统一改为原生矩阵 / 原生模板卡 / 原生分层图，并按契约补齐逐步揭示。
- 当前作者态与实现侧的主要漂移集中在 `step-03`、`step-05`、`step-10`、`step-11`、`step-12` 的 telemetry / teacher insight / 布局字段，以及 `step-11`、`step-12` 的静态承载内容。
