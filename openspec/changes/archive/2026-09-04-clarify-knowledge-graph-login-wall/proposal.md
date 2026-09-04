## Why

2026-09-04 QA 巡检（Issue #1939）发现未登录访问 `/knowledge` 时，知识图谱工作区的错误态（`src/features/knowledge/active-authority-graph.tsx:1918-1926`）把 401 映射的「请先登录后查看知识图谱」（:139）与无条件渲染的「当前知识图谱不可用；未请求另一套图谱数据…」（:1923）叠加显示，语义自相矛盾；且错误态只有「重试」按钮，没有直接登录入口，用户只能自己找到顶部「个人中心」。

## What Changes

- 知识图谱客户端区分「未登录（401）」与「图数据不可用」两类错误：401 时进入专用登录引导态，展示明确的登录说明与「前往登录」CTA（携带 `callbackUrl=/knowledge`），不再渲染「图不可用/未请求另一套数据」文案。
- 非 401 错误态保持现状（重试按钮与不可用说明），不叠加登录提示。
- 登录引导态可访问（语义角色与可聚焦 CTA），320px 视口不溢出。
- 增加未登录态渲染契约测试（不出现矛盾文案、CTA 存在且携带回调参数）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `commercial-student-entry-surfaces`: 知识图谱学习者表面的未登录态必须给出清晰、单一语义的登录引导，与登录回跳语义（callbackUrl）闭环。

## Impact

- `src/features/knowledge/active-authority-graph.tsx`（错误态分支）。
- `src/lib/authority-locale-readiness/graph-interface-catalog.ts` 文案键按需补充登录 CTA 文案。
- 相关单元测试（`active-authority-graph.client.test.ts` 等）。
- 依赖 #1936 的 callbackUrl 链路（登录页已支持，无实现阻塞）。
- 不改知识图谱数据链路与鉴权语义（那是 #1942 的范围）。
