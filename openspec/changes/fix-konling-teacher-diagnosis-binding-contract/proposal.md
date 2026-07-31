## Why

`teacher-diagnosis` 已注册为控灵教师助手模式，但会话绑定的模式提示键表遗漏该模式。该表是覆盖所有非通用模式的 TypeScript `Record`，因此当前 integration 无法通过类型检查，教师诊断会话也没有明确的持久化绑定契约。

## What Changes

- 为教师学情诊断模式声明零客户端提示字段的会话绑定。
- 为该绑定增加回归测试，证明浏览器输入不会写入教师、班级或学生范围。
- 记录本次会话绑定与服务端授权边界。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `konling-agent-runtime`: 教师学情诊断模式应能够以不携带客户端上下文提示的方式持久化会话身份。

## Impact

- `src/lib/konling-conversation-library.ts`
- `src/lib/__tests__/konling-conversation-library.test.ts`
- 控灵会话绑定的类型检查与教师诊断会话恢复
