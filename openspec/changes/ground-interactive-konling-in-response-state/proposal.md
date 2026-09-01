## Why

互动课程页面已根据学生的作答、提交和答案揭示状态生成差异化辅导上下文，但 `/api/ai/chat` 不消费这些字段，控灵运行时只能重建静态课程步骤。学生提交前与提交后得到相同辅导，已持久化作答也无法用于检查和解释，现有“服务端验证最新进度”合同未完整落地。

## What Changes

- 由服务端按认证学生、课堂会话、课程步骤和持久化作答解析当前互动辅导状态。
- 区分未作答、部分作答、已完整提交和教师已揭示答案，并依此约束辅导内容与检查能力。
- 让页面内嵌 AI 和全局控灵共用同一服务端状态投影。
- 忽略或拒绝客户端自报的工具、答案揭示和提示词扩展，不将其当作授权事实。
- 增加作答状态迁移、伪造客户端上下文和答案保密回归。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interactive-ai-context-continuity`: 互动课程 AI 必须从服务端持久化状态解析作答、提交与答案揭示语义。

## Impact

- Affected runtime: `src/lib/konling-agent-runtime.ts`, `src/app/api/ai/chat/route.ts`.
- Affected interactive clients: Unit 1-4 student runtime, embedded interactive AI, Global AI sidebar.
- Affected data source: authenticated classroom/session response state already persisted by the interactive runtime.
- No official score, answer-key publication, learner portrait, or database schema change is authorized by this proposal.

