## Why

控灵数学计算工具（Wolfram Cloud MCP）在 Windows/CRLF 检出环境下完全失效：`calc.wls` 多行注入被行尾差异破坏、Cloud 输出形态解析失败、偶发断线不重试，导致计算结果被静默丢弃，控灵退化为普通模型回答，用户无法区分“工具未触发”和“工具计算失败”。

## What Changes

- `buildCalcWlsCloudProgram` 在注入 `calc.wls` 前先归一化 CRLF 行尾，保证多行改写跨平台生效。
- `unwrapWolframEvaluatorText` 兼容 `During evaluation of In[n]:= {...}` 与尾随 kernel 消息，正确提取 JSON 结果。
- `evaluateWolframLanguage` 对 Wolfram Cloud MCP 非超时失败（偶发连接抖动、JSON-RPC 失败）重试一轮。
- 补充单元测试覆盖新输出形态、CRLF 注入与断线重试，并保持既有解析行为不变。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-math-precompute`: 增加共享计算运行时鲁棒性要求，明确脚本注入、输出解析与临时故障重试的行为约束。

## Impact

- 受影响代码：`src/lib/wolfram-cloud-mcp.ts`、`src/lib/__tests__/wolfram-cloud-mcp.test.ts`、`src/lib/__tests__/math-calc.test.ts`。
- 行为影响：受治理的数学预计算在真实 Wolfram Cloud MCP 输出下可稳定返回结果与中间步骤；不改变模型可见工具集、不引入新依赖、不改变 API 契约。
- 验证：相关单测、真实 Wolfram 计算 smoke、控灵端到端回答。
