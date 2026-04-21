# 3-3 互动实现对照表

## 本轮范围

- 目标：对现有 `unit-3-3-root-locus-rules` 实现做合规收口，不改作者态双轨真源。
- 约束：保持 17 步结构、课程路由、AI context、预习入口和既有媒体映射不变。
- 基线文件：
  - `course-content/authoring/lessons/3-3/design/interactive-page.md`
  - `course-content/authoring/lessons/3-3/design/interactive-contract.yaml`
  - `src/lib/unit-3-3-course.ts`

## 设计稿到实现稿对照

| 步骤 | 页面模板 / 互动类型 | 关键实现文件 | 本轮核对点 | 当前状态 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| `step-01`~`step-06` | 静态页 + `binary_choice` / `short_response` / `reason_check` / `region_highlight` | `src/lib/unit-3-3-course.ts`, `src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx` | 步骤标题、模板、regions、互动类型与契约一致；静态页不再渲染统一提交壳层 | 已收口 | `unit-3-3-course.test.ts` 源码断言 |
| `step-07` | `worked_example_workspace` | `step-panels.tsx` | 完整题面始终可见；双卡标题改为“实轴区段判断”“渐近线重心与角度”；保留正文在前、作答在后 | 已收口 | `unit-3-3-course.test.ts` + 源码核对 |
| `step-08` | `triple_match` | `src/lib/unit-3-3-course.ts`, `step-panels.tsx` | 关键节点职责卡、配对区与契约保持一致 | 维持现状 | 既有契约对齐测试 |
| `step-09` | `worked_example_workspace` | `step-panels.tsx` | 双卡标题改为“真实分离点筛选”“临界增益与虚轴交点”；显影链与参考答案开关保持分离 | 已收口 | `unit-3-3-course.test.ts` + 源码核对 |
| `step-10` | `activity_cards` | `step-panels.tsx` | 双卡标题改为“复极点出射角”“根之和约束”；不再使用“卡片 1 / 卡片 2”泛称 | 已收口 | `unit-3-3-course.test.ts` + 源码核对 |
| `step-11`~`step-17` | `sequence_sort` / `classification_cards` / `formula_ordering` / `tab_switch` / `mapping_highlight` / `quiz_group` / 静态收束 | `src/lib/unit-3-3-course.ts`, `step-panels.tsx`, `student-page.tsx`, `teacher-page.tsx` | 维持契约、媒体映射、隐藏式 AI context 注入与师生页壳层不变 | 维持现状 | 既有测试 + 源码核对 |

## 本轮新增或确认的硬结论

1. `UNIT_3_3StudentActivityForm` 在静态页直接返回 `null`，不再显示“本页无需提交”占位壳层。
2. 例题 / 活动卡标题直接写判断动作，不再使用“卡片 1 / 卡片 2”这类无语义标题。
3. 3-3 已补实现接受文件，`implementation_contract_source` 指向 `src/lib/unit-3-3-course.ts`。
4. 现有 `student-page.tsx` 继续通过 `getUnit33StepAIContext` 把 AI 上下文隐藏式注入 `useGlobalAI().updatePageContext`，本轮未回退成页内显式 AI 文案。

## 本轮未扩 scope 的部分

- 不回改 `interactive-page.md` / `interactive-contract.yaml`。
- 不重写 `teacher-page.tsx` 的课堂台布局。
- 不新增浏览器级课堂回归证据；当前接受文件按 `main_agent_fallback` 记录为代码级验收。
