---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 保持 Release 不可变并独立版本化修订提案登记表

ACT 中的 ActKG 规范对象和工程关系保持只读，本次迁移不提供用户问题反馈、跨项目提交或自动修订入口。规范知识修订只在 ActKG 发布与治理流程中处理。

ActKG 的正式修订提案进入独立版本化的 RevisionProposalRegistry，持续记录提案状态和处置进度。Engineering Release 只保存登记表快照或版本引用；登记表状态变化产生新版本，不修改既有 Release 内容和哈希。Release 使用者定期审阅提案，并决定是否纳入后续版本修订流程。

该方案保留修订治理的可追踪性，同时不在 ACT 中扩大反馈和跨项目工作流范围，也不破坏发布物的不可变身份。
