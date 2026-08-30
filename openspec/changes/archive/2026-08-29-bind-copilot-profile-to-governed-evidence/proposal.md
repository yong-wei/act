## Why

通用 Copilot 当前由浏览器 `usePageAIContext` 构造固定的学习风格、认知水平和能力向量，并将其作为 `userProfile` 发送到 `/api/ai/chat`。服务端在普通页面上下文分支直接使用该画像构建系统提示词。浏览器默认值或篡改值因此可能被模型当作当前学生事实，导致学习陪伴产生虚假个性化建议。

## What Changes

- 将 Copilot 的学生画像来源收敛到当前认证用户的服务端受治理学习状态。
- 把客户端页面定位信息与学生画像事实分开，客户端画像字段不再获得信任。
- 为有效、缺失、低置信度和服务不可用状态保留明确的画像可用性与限制语义。
- 在画像不足时提供与当前课程相关的通用辅导或证据采集行动，不伪造个人能力结论。
- 保持普通 Copilot 的课程页面上下文、会话历史和非个性化回答兼容。

## Capabilities

### New Capabilities

- `governed-copilot-profile-context`: Copilot 使用服务端受治理学习画像并在证据不足时诚实降级。

### Modified Capabilities

<!-- No existing requirement is intentionally replaced; the change adds a trust boundary around the existing Copilot context. -->

## Impact

- `src/hooks/usePageAIContext.ts` 的客户端请求字段边界。
- `src/app/api/ai/chat/route.ts` 的身份校验、服务端画像解析和普通 Copilot 提示词组装。
- 既有 learner-state / portrait projection 读取能力及相关测试。
- `/ai`、`/ai/copilot` 及受影响页面的浏览器验收。
