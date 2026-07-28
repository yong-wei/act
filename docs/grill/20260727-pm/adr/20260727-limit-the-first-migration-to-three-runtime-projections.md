---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 首轮迁移只实现三个运行投影

权威基座首轮实现 `act.canvas.v2`、`act.node-detail.v2` 和 `act.migration-review.v1`，分别支撑新版图谱画布、异质对象与证据详情，以及 Release 接入、Legacy 归档和活跃消费者重新绑定审计。每个投影声明源 ReleaseSet、字段范围和被隐藏内容，不作为其他业务的万能 DTO。

RAG、SAR、控灵、KAQ 和学习路径只在首轮获得稳定的 Repository 查询边界、Canonical ID、ReleaseSet 版本和类型合同。专用投影在对应消费者实际迁移时实现；ActKG 尚未发布教学语义前不生成能够被误用的路径投影。

该范围满足底座接入和前端预览需要，同时避免为尚未迁移的消费者预先固化未经真实验证的投影结构。
