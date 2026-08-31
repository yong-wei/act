## Context

控灵数学预计算通过 Wolfram Cloud MCP 执行受治理的 `calc.wls`（见 proposal.md - Why）。执行链路依赖三步：把 `calc.wls` 改写为 Cloud 可运行程序、调用 `WolframLanguageEvaluator`、把返回文本解析为结构化结果。实测发现 Windows CRLF 检出会使多行改写全部失效；Cloud 求值器实际返回带 `During evaluation of In[n]:=` 前缀和 kernel 消息的输出；`tools/call` 偶发连接失败且不重试，导致结果被静默丢弃、控灵降级。

## Goals / Non-Goals

**Goals:**

- 跨平台稳定注入 `calc.wls`，不再依赖检出行尾。
- 解析 Cloud 求值器的真实输出形态，兼容既有 `Out[n]=` 输出。
- 对非超时、非取消的临时失败重试一轮，并受整体预算约束。

**Non-Goals:**

- 不改变 `calculate` 工具对模型的不可见策略，不改变受治理操作集与 API 契约。
- 不引入本地 Wolfram Engine，不改变 Cloud MCP 端点与认证方式。
- 不改变预计算降级语义：无法计算时仍静默回退普通回答。

## Decisions

1. **注入前统一行尾为 LF**。`buildCalcWlsCloudProgram` 先做 `\r\n -> \n` 归一化再执行多行字符串替换。替代方案是逐个替换模式支持 `\r?\n`，但归一化更简单且保证改写后的程序内部一致。
2. **输出解析做格式兼容而非格式猜测**。`unwrapWolframEvaluatorText` 剥离 `Out[n]=` 与 `During evaluation of In[n]:=` 前缀，保留 `"` 引号包裹 JSON 的既有分支，并对裸 JSON 采用首 `{` 到末 `}` 提取，忽略尾随 kernel 消息；非 JSON 文本仍原样返回，由调用方投影失败。
3. **求值整体重试一轮**。把 `initialize + notifications/initialized + tools/call` 包为 `evaluateOnce`，捕获非超时失败且预算未耗尽时重新执行一轮。替代方案是只重试 `tools/call`，但会话状态可能已失效，整体重试更可靠；数学求值只读幂等，重复执行无副作用。

## Risks / Trade-offs

- 重试会引入一次额外云端调用延迟（约数秒）→ 重试受总预算约束，且仅在非超时失败时发生，正常路径无额外开销。
- `{...}` 提取可能把 Wolfram 错误文本中的对象误当作 JSON → 该函数仅用于已知求值输出，解析失败仍由调用方投影为受治理不可用错误，不泄露细节。
- Cloud 服务持续不可用时重试仍失败 → 延迟有限且保持 fail-closed，与现有降级路径一致。
