---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 分离 Schema 驱动无损存储与消费者语义支持

AuthoritativeKnowledgeRepository 按受支持的 ActKG Schema 校验并无损保存 Release 中的合法对象类型、类型专属字段和谓词，不用当前 ACT 的对象或关系白名单裁剪权威数据。未通过 Schema 的未知值仍然阻断导入。

对象存储、画布渲染、详情模板和谓词显示提供可扩展登记点。新合法类型可以先以通用只读形式预览，随后通过新增适配器获得专属视觉、字段解释和业务能力，不需要修改既有权威对象或重构核心存储。

RAG、SAR、KAQ、学习路径和学习事实分别声明其已理解的对象类型和谓词。Repository 能够保存或画布能够显示的语义，未经消费者适配不得自动参与检索扩展、路径或画像计算。
