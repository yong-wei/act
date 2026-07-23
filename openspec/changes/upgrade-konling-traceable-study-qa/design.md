## Context

`generic-chat` 通过 Konling runtime、Source Pack 和引用组件生成受治理回答，但当前只以 `fact-explanation` 表示通用学科问答，无法区分公式、代码、概念或规范性内容。

## Decisions

### 扩展既有 generic-chat 合同

根据最新学生问题和可选结构化表达偏好生成受控的问答意图、必备段落和规范性核验状态；不新增独立聊天模式，以复用既有鉴权、工具范围和流式引用链路。

### 服务端绑定回答单元与引用

模型只能输出与可用内容引用 ID 一致的 `[证据: citation-id]` 标记。服务端只把可映射到已验证 CitationTarget 的标记写入 metadata，伪造 ID 不会成为引用。

### 规范性内容采用既有权威元数据

只有服务端验证、`official-reference` 解析、high confidence 且具有可用目标与地址的引用，才能支持已验证规范结论；其余情况标记为 `verification-required`。

### 偏好仅影响表达

深度、示例、格式和提示强度仅影响组织和表达，不改变问答类型、引用锚点或规范性证据门槛。
