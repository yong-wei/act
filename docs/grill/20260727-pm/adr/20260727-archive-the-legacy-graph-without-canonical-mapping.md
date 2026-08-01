---
status: accepted
context: authoritative-knowledge-graph-migration
supersedes_in_part: docs/adr/0030-preserve-historical-identity-through-canonical-id-mapping.md
---

# 整体归档旧图并取消新旧规范身份映射

ACT 不建立全局或临时的 legacy ID 到 ActKG Canonical ID 映射。正式切换时，旧图谱节点、关系、旧知识修订及其运行解释能力作为完整 legacy snapshot 归档；历史学习事实及派生状态继续由该快照解释，不迁移到新知识身份。

当前课程、资源、KAQ、学习进度、笔记和未完成路径等仍需继续运行的消费者，在各自迁移阶段根据内容和用途重新绑定 ActKG Canonical ID。旧节点名称、旧 ID 或旧绑定不能自动产生新绑定。

切换后的新消费者和新学习事实只使用 ActKG Canonical ID、Release 和知识修订。该边界去除映射账本、历史 sidecar 和长期双 ID 查询，同时防止旧图谱错误通过身份继承进入新权威基座。
