## Why

`teacher-diagnosis` 会话绑定曾遗漏零提示字段策略，导致完整的非通用模式策略表出现重复键。生产修复与端到端持久化回归测试现已进入 `integration`；本变更保留该契约的决策记录，防止后续将浏览器范围误作持久化授权范围。

## What Changes

- 记录教师学情诊断模式的零客户端提示字段会话绑定契约。
- 明确浏览器输入不会成为教师、班级或学生范围的持久化授权来源。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `konling-agent-runtime`: 教师学情诊断模式应能够以不携带客户端上下文提示的方式持久化会话身份。

## Impact

- `openspec/specs/konling-agent-runtime/spec.md`
- 控灵会话绑定与服务端授权边界的后续维护
