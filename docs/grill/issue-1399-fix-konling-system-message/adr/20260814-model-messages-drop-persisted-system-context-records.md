# 模型消息投影不包含持久化的 system 上下文记录

控灵会话继续在持久化中保留页面上下文记录和助手绑定记录（供审计、恢复和去重），但 `toModelMessages` 只把 user/assistant 消息投影给模型，不再把 system 记录作为第二条 system 消息发送。SiliconFlow 对 OpenAI 消息格式严格校验，system 消息必须位于开头且只能有一条；`streamText` 的 server-owned `system` 参数承担唯一系统提示词，历史上下文记录不进入模型消息数组。

该决策以“跨页连续性由当前页 systemPrompt 与用户消息承担”替代把上下文记录原样回放给模型，是本 issue 修复 `System message must be at the beginning` 400 的边界条件。持久化语义与既有 ADR `20260725-use-user-scoped-cross-page-konling-sessions` 保持一致，仅模型消息投影发生裁剪。
