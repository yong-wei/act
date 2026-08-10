---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 以 Engineering Release 定义 ACT 的无损导入边界

ACT 对 ActKG Engineering Release 承担无损保存和消费责任：保存原始载荷及哈希，完整导入正式发布对象、关系、类型专属字段、证据、来源引用和版本信息，并以序列化往返及哈希验证证明导入结果没有语义丢失。

完整 CTKGDataset 中的抽取运行、候选对象和审核草稿继续由 ActKG 保存。ACT 只记录数据集哈希、发布标识和可解析位置，以便追溯完整生产血缘，不复制 ActKG 的知识生产内部状态。

这一边界避免以消费投影冒充无损真源，也避免为了运行查询把整个抽取与审核系统复制到 ACT。
