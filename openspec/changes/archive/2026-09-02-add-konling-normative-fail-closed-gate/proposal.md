## Why

规范性问答的安全边界目前绑定在主意图分类上。仿真结果显示规范内容意图召回仅 15%，缺少权威来源时仍有 13.3% 的不安全确定性断言。意图误判会直接绕过 `verification-required`，因此必须增加独立于路由的 fail-closed 门禁。

## What Changes

- 在 Konling 运行时增加独立的规范性风险检测，覆盖标准号、法规、认证、官方规定和必须/不得/应当类表达。
- 只要检测到规范性风险且缺少服务端确认的权威来源，无论主意图如何分类，都强制进入 `verification-required`。
- 降级提示明确证据缺口、可回答边界和核验建议；允许一般原理解释，但禁止写成确定的官方条款。
- `verified` 只能由服务端确认的权威引用来源产生；客户端自报来源、提示注入或自标记 `verified` 不能抬升状态。
- 增加错误路由和客户端绕过的纵深防御测试。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 规范性安全门禁必须独立于主意图分类，并在缺少服务端权威来源时 fail-closed。

## Impact

- `src/lib/konling-agent-runtime.ts` 的 study-question 合同与引用守卫。
- `src/lib/ai-prompt-builder.ts` 的规范性降级提示。
- 现有 Citation Hydrator / Source Pack 权威来源判定保持不变，不新增外部法规数据库。
- 聚焦运行时与提示词测试；不改聊天入口、检索服务或数据表。
