# 3-4 互动课程实现记录

更新时间：2026-04-07

## 设计稿到实现稿对照表（2026-04-07）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-01 | `map_hero_slide`，`view_count / sync_status`，路径图+任务卡+边界卡同屏 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 演示页快照 |
| step-02 | `binary_choice_illustration`，误区为“稳定=够好” | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 教师揭示流 |
| step-03 | `goal_chain_slide`，三项固定产出完整落页 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 |
| step-04 | `question_stack`，三题纵向前测，教师看错因分布 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 提交流 |
| step-05 | `workflow_sort_board`，四步读图顺序不可降级 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 排序交互 |
| step-06 | `version_prediction_workspace`，A/B/C 首轮预测 + 记录栏 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 提交流 |
| step-07 | `keynode_annotation_workspace`，四类关键节点标注与一句判断 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 标注提交流 |
| step-08 | `window_judgement_workspace`，稳定窗口与可接受窗口双层标签 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 标签统计 |
| step-09 | `gain_conversion_workspace`，`k = 0.01715K` 换算链不能偷简 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 公式链校验 |
| step-10 | `compare_then_ai`，AI 只做换算链检查，不代做判断 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` + `student-page.tsx` | 待实现 | 契约单测 + AI context 校验 |
| step-11 | `step_compare_workspace`，时域回查与版本含义卡必须同屏 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 面板切换交互 |
| step-12 | `bode_compare_workspace`，频域回查后锁定最终判断 | `src/lib/unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 最终提交流 |
| step-13 | `post_quiz_stack`，解释题关键词覆盖检查 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 提交统计 |
| step-14 | `summary_infographic`，四列表+出口反思，不依赖教师口头补 | `src/lib/unit-3-4-course.ts` + `step-panels.tsx` | 待实现 | 契约单测 + 演示页快照 |

说明：
- 本轮以 `course-content/authoring/lessons/3-4/design/interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，不接受任何降级实现。
- `course-content/runtime/lessons/3-4/` 的 `handout / media / review / graph-overlay / lesson.json` 已存在，可直接作为 runtime-first 输入。
- 当前尚无 `3-4` 课程代码目录、注册点和测试文件，属于本轮主缺口。

## 本轮实现范围

- 新增主线精品互动课路由：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation`
- 新增 `src/lib/unit-3-4-course.ts`，承载 14 步课程定义、平行契约、会话适配与媒体映射
- 新增 `src/lib/unit-3-4-ai-contexts.ts`，并注册到 `src/lib/course-ai-contexts.ts`
- 新增 `src/features/interactive/unit-3-4-root-locus-reading-validation/`
  - `entry-page.tsx`
  - `student-page.tsx`
  - `teacher-page.tsx`
  - `course-header.tsx`
  - `step-panels.tsx`
  - `workspace.ts`
- 新增 `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/` 三类页面入口
- 新增 `src/features/teacher/preset-lessons/presets/unit-3-4-root-locus-reading-validation.ts`
- 接入 `learning-catalog`、`classroom-session-route`、`preset index`
- 新增 `src/features/interactive/__tests__/unit-3-4-course.test.ts`

## 运行时真源

- 统一从 `course-content/runtime/lessons/3-4/` 读取：
  - `lesson.json`
  - `graph-overlay.json`
  - `handout.md`
  - `handout.pdf`
  - `media/3-4-media.md`
  - `review/*`

## 当前取舍

- 优先复用 `3-3` 的页面骨架、会话同步和入口页结构，不新造另一套精品课框架。
- `3-4` 的复杂工作区先尽量落在轻量表单、按钮切换、标签选择、文本记录和教师统计上；如需新增局部交互抽象，只在 `step-panels.tsx / workspace.ts` 内最小扩展。
- 入口页直接复用 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保证课堂外资源埋点沿用统一链路。

## 验证计划

- `npx vitest run src/features/interactive/__tests__/unit-3-4-course.test.ts`
- `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-4`
- `npm run lint`
- `npm run test`
