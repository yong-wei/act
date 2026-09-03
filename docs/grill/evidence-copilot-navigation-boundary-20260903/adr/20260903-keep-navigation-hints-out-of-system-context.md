# Keep Evidence Copilot Navigation Hints Out of System Context

Evidence Copilot 已经由服务端解析当前学生的受治理学习证据，但 `source`、`assignment` 和 `intent` 仍可由客户端提供并被序列化到 system prompt。决定将这些原始导航提示排除在模型私有事实上下文之外；如未来需要表达入口语义，只能使用服务端允许列表映射出的稳定标签或枚举，不能依赖关键词过滤或仅靠提示词声明“不要执行”。这样可以保留入口导航能力，同时避免不可信文本跨越 system-level instruction boundary，且不改变普通 Copilot 的上下文行为。
