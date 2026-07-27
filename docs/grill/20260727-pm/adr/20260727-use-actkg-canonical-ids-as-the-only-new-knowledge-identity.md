---
status: accepted
context: authoritative-knowledge-graph-migration
supersedes_in_part: docs/adr/0030-preserve-historical-identity-through-canonical-id-mapping.md
---

# 迁移后只使用 ActKG Canonical ID 作为规范知识身份

ActKG Canonical ID 是迁移后规范知识对象的唯一身份。ACT 旧节点 ID 不复用为新规范 ID，也不与 ActKG ID 并列；旧 ID 只存在于完整归档的 legacy snapshot 和旧知识修订中，不建立全局 `LegacyCanonicalMapping`。

当前资源、KAQ、课程目标、学习进度、笔记和未完成路径等仍需继续运行的消费者，分别依据自身内容和用途重新绑定 ActKG Canonical ID，不通过旧节点名称或 ID 继承语义。历史学习事实及其派生状态继续由旧 ID、原知识修订或 legacy snapshot 解释。

这一决定避免把旧图谱缺陷转化为新图谱身份合同，也确保切换后的新事实和消费者只使用 ActKG 规范身份。
