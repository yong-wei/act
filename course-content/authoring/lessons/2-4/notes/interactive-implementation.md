# 2-4 互动课程实现记录

更新时间：2026-04-06（入口页补强审计）

## 设计稿到实现稿对照表（2026-04-06）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，路径图高亮 `2-3 -> 2-4 -> 3-1`，无作答区 | `src/lib/unit-2-4-course.ts` + `entry-page/step-panels` | 已实现 | 契约单测 + 演示页预览 |
| step-02 | `dual_view_question_slide`，双图主视觉 + 二选一判断，误区限定为“同一对象” | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 教师揭示 |
| step-03 | `goal_boundary_slide`，目标卡与边界表同屏，无互动 | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页预览 |
| step-04 | `question_stack`，三题前测，允许一次重提 | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 学生提交态 |
| step-05 | `formula_media_compare`，两条公式 + 双图对照 + `triple_match` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 静态承载检查 |
| step-06 | `workflow_card_with_reason_check`，四步读法 + `reason_check` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 教师聚合 |
| step-07 | `courseware_top_slider_bottom`，一阶惯性轨迹 + `parameter_slider` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` + `workspace.ts` | 已实现 | 契约单测 + 工作区参数联动 |
| step-08 | `comparison_panel_with_sort`，纯极点系统比较 + `card_sort` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 排序结果 |
| step-09 | `formula_table_match`，五个频域指标公式 + `triple_match` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 静态公式检查 |
| step-10 | `dual_graph_indicator_locator`，双图定位 + `hotspot_labeling` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 热点标注 |
| step-11 | `sketch_workflow_workspace`，Bode 手工绘图检查单 + `workspace_builder` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` + `workspace.ts` | 已实现 | 契约单测 + 工作区构建 |
| step-12 | `workflow_graph_workspace`，Nyquist 关键点规则卡 + `path_highlight` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 高亮逻辑 |
| step-13 | `worked_example_workspace`，含积分环节例题 + 三步法工作区 | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` + `workspace.ts` | 已实现 | 契约单测 + 例题工作链 |
| step-14 | `worked_example_metric_panel`，频域指标例题 + `metric_overlay` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 指标叠加验证 |
| step-15 | `compare_then_ai`，特征图 + 线索表 + `ai_compare_workspace` | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + AI 快问快答 |
| step-16 | `post_quiz_stack`，两题客观题 + 一题解释题，允许教师揭示 | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 教师统计 |
| step-17 | `summary_infographic`，五条结论 + 速查卡 + `3-1` 去向卡 | `src/lib/unit-2-4-course.ts` + `step-panels.tsx` | 已实现 | 契约单测 + 演示页预览 |

说明：
- 2026-04-06 审计确认：`src/lib/unit-2-4-course.ts` 已与双轨真源对齐，本轮不重制 17 步主干，只补入口页预习台、多媒体文案与课堂外资源追踪接入。
- 双轨真源是 `design/2-4-interactive-page.md` 与 `design/2-4-interactive-contract.yaml`；实现时不得降级组件形态。
- runtime 真源统一来自 `course-content/runtime/lessons/2-4/`。
- 对齐校验命令应显式传参：`node scripts/tests/test-interactive-contract-implementation-alignment.mjs --contract course-content/authoring/lessons/2-4/design/2-4-interactive-contract.yaml --implementation src/lib/unit-2-4-course.ts --pageContractConst UNIT_2_4_PAGE_CONTRACTS --stepConst UNIT_2_4_LESSON_STEPS`。
