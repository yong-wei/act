## Why

React Doctor error-only 扫描报告 30 条 `aria-role` error，对应 15 个唯一源码位置。baseline 命中点包括 Unit 4-1、Unit 5-1、Unit 5-2、Unit 5-3 互动课程学生/教师页，以及通过 `AppShell role="student"` 暴露业务身份的 dashboard、profile、adaptive practice、Arena、control workbench 等平台入口调用点。知识图谱页和 data center presentation surface 未出现在 baseline artifact 中，但同样使用 `AppShell` 的业务角色 API，因此随本次 `viewerRole` 迁移一并对齐。问题根因都是把业务身份 `student` 或 `teacher` 放在名为 `role` 的 JSX 属性/prop 上。部分命中点可能是自定义组件 prop，但该命名容易透传到 DOM `role`，并且与 ARIA role 语义冲突。`student` 和 `teacher` 不是合法 ARIA role，辅助技术无法正确解释，且会污染后续可访问性审计。

本变更消除互动课程和相关平台壳层调用点中的非法 ARIA role，并建立课程页面业务角色标注约束。

## What Changes

- 将互动课程页面与 `AppShell` 调用点中非法或易混淆的 `role="student"` / `role="teacher"` 业务属性替换为 `viewerRole`、`surfaceRole` 或其他非 ARIA 命名。
- 业务身份使用组件 prop、`data-role`、测试 id 或可读标签表达，不占用 ARIA role，也不透传为 DOM `role`。
- 若元素承担页面区域语义，使用合法 landmark role 或语义 HTML 元素。
- 增加可访问性/静态检查，确保课程页面不再新增非法业务 role。

## Capabilities

### New Capabilities

- `interactive-course-accessibility-semantics`: Defines valid accessibility semantics for interactive course student and teacher surfaces.

### Modified Capabilities

- None.

## Impact

- Affects currently flagged unit interactive pages under `src/features/interactive/unit-*` and platform entry points that pass business identity into `AppShell`.
- May affect tests or selectors that incorrectly depend on `role="student"` or `role="teacher"` in JSX or DOM; those selectors must migrate to stable non-ARIA attributes.
- Does not change course content, scoring, layout, or role-based authorization.
