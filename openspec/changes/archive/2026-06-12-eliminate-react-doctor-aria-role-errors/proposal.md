## Why

React Doctor error-only 扫描报告 `aria-role` error，唯一命中点覆盖 15 个源码位置：8 个来自互动课程 JSX 中把业务身份 `student` 或 `teacher` 放在名为 `role` 的属性/prop 上，7 个来自平台壳层页面把学生身份传给 `AppShell role`。这些命中点中部分是自定义组件 prop，但该命名仍会被 React Doctor 视为 ARIA role 风险，也容易在后续重构中透传到 DOM `role`。`student` 和 `teacher` 不是合法 ARIA role，辅助技术无法正确解释，且会污染后续可访问性审计。

本变更消除当前 React Doctor `aria-role` 命中，并建立课程页面与平台壳层业务角色标注约束。

## What Changes

- 将互动课程页面与 `AppShell` 调用中非法或易混淆的 `role="student"` / `role="teacher"` 业务属性替换为 `viewerRole`、`surfaceRole` 或其他非 ARIA 命名。
- 业务身份使用组件 prop、`data-role`、测试 id 或可读标签表达，不占用 ARIA role，也不透传为 DOM `role`。
- 若元素承担页面区域语义，使用合法 landmark role 或语义 HTML 元素。
- 增加可访问性/静态检查，确保课程页面和平台壳层入口不再新增非法业务 role。

## Capabilities

### New Capabilities

- `interactive-course-accessibility-semantics`: Defines valid accessibility semantics for interactive course student and teacher surfaces.

### Modified Capabilities

- None.

## Impact

- Affects currently flagged unit interactive pages under `src/features/interactive/unit-*` and platform shell call sites using `AppShell`.
- May affect tests or selectors that incorrectly depend on `role="student"` or `role="teacher"` in JSX or DOM; those selectors must migrate to stable non-ARIA attributes.
- Does not change course content, scoring, layout, or role-based authorization.
