<!-- openspec-buddy change_id: ground-evidence-copilot -->

## Goal

让 Evidence Copilot 真正基于当前学生经过授权的学习证据提供复盘和下一步练习建议，消除客户端 URL 描述被误认为个人学习事实的问题。

## Scope

- 修复 `/ai/copilot?context=evidence` 到 `/api/ai/chat` 的服务端证据上下文链路。
- 仅使用当前认证学生可见的受治理证据；`source`、`assignment`、`intent` 仅作为导航提示。
- 保留缺失、部分、过期、不可用状态及来源覆盖信息，提供真实可达的学习行动。
- 保持普通 Copilot 兼容，不自动写入成绩、排行榜、LearningFact 或学习画像。

## Reproduction

1. 登录学生账号，打开 `/ai/copilot?context=evidence&source=任意文字`。
2. 观察页面显示“证据摘要”及薄弱点/下一步内容。
3. 发送“请根据当前证据指出薄弱点”。
4. 检查请求体中的 `taskContext`，并对照 `src/app/api/ai/chat/route.ts` 的请求解析和系统提示词构造。

## Actual Result

页面在客户端根据 URL 的 `source` 生成固定证据摘要；聊天 API 未读取并授权对应的受治理学习证据，也未将该 Evidence Copilot 上下文作为服务端事实来源。学生可能看到看似个性化、但无法追溯到本人证据的回答。

## Expected Result

服务端按当前认证身份读取并投影受治理证据。客户端描述不能扩大事实范围；无证据、部分证据、过期证据和服务不可用时必须明确显示限制，不得用模型推测或零值补齐，并提供实际的练习/补证据入口。

## Acceptance

- 服务端证据投影含状态、来源覆盖、置信度/新鲜度和限制说明。
- 伪造或更换 URL 描述不会读取、创建或替换个人证据。
- 空、部分、过期、不可用场景均有服务端和浏览器回归。
- 普通 Copilot 无 Evidence 上下文时行为不回归。

Proposal: `openspec/changes/ground-evidence-copilot/`
